// Yönetim paneli denetim kaydı (buyur_admin_logs). Sözleşmesi
// tests/admin-audit.test.ts.
//
// Kural: kaydı yazılamayan admin değişikliği başarılı sayılmaz, GERİ ALINIR.
// Uyarıyla bırakmak yerine geri almayı seçtik: kaydı olmayan bir plan
// değişikliği ya da askıya alma, kimin yaptığı bilinmeyen bir yetki
// değişikliğidir. Kayıt koleksiyonu geçici olarak yazılamıyorsa admin
// işlemi birkaç saniye sonra tekrarlar; iz kaybolursa geri gelmez.
//
// Giriş/çıkış kaydı bu kurala dahil değildir (bkz. app/api/admin/auth): orada
// geri alınacak bir değişiklik yoktur ve kayıt koleksiyonundaki bir arıza
// bütün yöneticileri panelin dışında bırakmamalıdır.

import { randomUUID } from "node:crypto";
import type PocketBase from "pocketbase";
import { withRetry, type RetryOptions } from "@/lib/pb-retry";
import type { Admin, AdminLog } from "@/lib/types";

export const ADMIN_LOG_COLLECTION = "buyur_admin_logs";

/** Kayıt ekranında gösterilen işlem adları. Listede olmayan işlem ham adıyla
 *  görünür: yeni bir işlem eklenip burası unutulsa da kayıt okunabilir kalır. */
export const ADMIN_LOG_ACTION_LABELS: Record<string, string> = {
  "admin.login": "Giriş yaptı",
  "admin.logout": "Çıkış yaptı",
  "admin.password_change": "Şifresini değiştirdi",
  "business.plan_assign": "Plan atadı",
  "business.trial_extend": "Süreyi uzattı",
  "business.ai_quota_reset": "AI kotasını sıfırladı",
  "business.suspend": "Askıya aldı",
  "business.unsuspend": "Askıyı kaldırdı",
  "business.slug_change": "Menü adresini değiştirdi",
  "business.password_reset": "Şifre sıfırlama e-postası gönderdi",
  "plans.edit": "Planı düzenledi",
};

export function adminLogActionLabel(action: string): string {
  return ADMIN_LOG_ACTION_LABELS[action] ?? action;
}

const showValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "boş";
  if (Array.isArray(value)) return value.length === 0 ? "boş" : value.map(showValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Değişen alanların okunur özeti: "plan: freemium → premium". İç içe nesneler
 *  (plan limitleri gibi) bir düzey açılır ve yalnızca değişen anahtarlar
 *  yazılır: "limits.menu_views: 5000 → 6000". */
export function adminLogChangeLines(log: Pick<AdminLog, "before" | "after">): string[] {
  const before = log.before ?? {};
  const after = log.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const lines: string[] = [];
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (isPlainObject(a) && isPlainObject(b)) {
      for (const sub of Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))) {
        if (JSON.stringify(a[sub]) !== JSON.stringify(b[sub])) lines.push(`${key}.${sub}: ${showValue(a[sub])} → ${showValue(b[sub])}`);
      }
      continue;
    }
    lines.push(`${key}: ${showValue(a)} → ${showValue(b)}`);
  }
  return lines;
}

export interface AdminActionEntry {
  admin: Pick<Admin, "id" | "email">;
  action: string;
  targetCollection?: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  ip?: string;
}

/** Tek bir denetim kaydı yazar. Geçici hatada yeniden dener; `op_id` sayesinde
 *  yanıtı kaybolan bir yazım ikinci kez eklenmez. */
export async function recordAdminAction(
  pb: PocketBase,
  entry: AdminActionEntry,
  options: RetryOptions = {}
): Promise<AdminLog> {
  const opId = randomUUID();
  return withRetry(
    () =>
      pb.collection(ADMIN_LOG_COLLECTION).create<AdminLog>(
        {
          op_id: opId,
          admin: entry.admin.id,
          admin_email: entry.admin.email,
          action: entry.action,
          target_collection: entry.targetCollection ?? "",
          target_id: entry.targetId ?? "",
          before: entry.before ?? null,
          after: entry.after ?? null,
          reason: entry.reason?.trim().slice(0, 500) ?? "",
          ip: entry.ip?.slice(0, 64) ?? "",
        },
        { requestKey: null }
      ),
    {
      ...options,
      verify: () =>
        pb
          .collection(ADMIN_LOG_COLLECTION)
          .getFirstListItem<AdminLog>(pb.filter("op_id = {:opId}", { opId }), { requestKey: null }),
    }
  );
}

/** Kaydın yalnızca değişen alanlarını alır; olmayan alan null yazılır ki geri
 *  alma sırasında "boştu" bilgisi kaybolmasın. */
function pickFields(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, record[key] ?? null]));
}

export type AuditFailure = "write_failed" | "log_failed" | "rollback_failed";

export type AuditedResult<T> =
  | { ok: true; record: T; log: AdminLog }
  | { ok: false; reason: AuditFailure; error: unknown };

export interface AuditedUpdate extends Omit<AdminActionEntry, "before" | "after" | "targetCollection" | "targetId"> {
  collection: string;
  id: string;
  patch: Record<string, unknown>;
}

/** Kaydı günceller ve denetim kaydını yazar. Kayıt yazılamazsa değişikliği
 *  eski değerlere döndürür. Geri alma da başarısız olursa bunu ayrı bir
 *  sonuçla söyler: bu, elle bakılması gereken tek durumdur. */
export async function runAuditedUpdate<T extends Record<string, unknown>>(
  pb: PocketBase,
  update: AuditedUpdate,
  options: RetryOptions = {}
): Promise<AuditedResult<T>> {
  const { collection, id, patch, ...entry } = update;
  const keys = Object.keys(patch);

  let before: Record<string, unknown>;
  let record: T;
  try {
    const current = await withRetry(() => pb.collection(collection).getOne<T>(id, { requestKey: null }), options);
    before = pickFields(current, keys);
    // Güncelleme aynı veriyi tekrar yazar; yanıtı kaybolsa da tekrar denemek
    // çift kayıt üretmez.
    record = await withRetry(() => pb.collection(collection).update<T>(id, patch, { requestKey: null }), options);
  } catch (error) {
    return { ok: false, reason: "write_failed", error };
  }

  try {
    const log = await recordAdminAction(
      pb,
      { ...entry, targetCollection: collection, targetId: id, before, after: pickFields(record, keys) },
      options
    );
    return { ok: true, record, log };
  } catch (logError) {
    try {
      await withRetry(() => pb.collection(collection).update(id, before, { requestKey: null }), options);
      return { ok: false, reason: "log_failed", error: logError };
    } catch (rollbackError) {
      console.error("[admin-audit] denetim kaydı yazılamadı ve değişiklik geri alınamadı", {
        collection,
        id,
        action: entry.action,
        before,
      }, rollbackError);
      return { ok: false, reason: "rollback_failed", error: rollbackError };
    }
  }
}

/** Başarısız denetimli işlemin kullanıcıya söylenecek hâli. */
export function auditFailureMessage(reason: AuditFailure): string {
  switch (reason) {
    case "write_failed":
      return "Değişiklik kaydedilemedi. Biraz sonra tekrar deneyin.";
    case "log_failed":
      return "Denetim kaydı yazılamadığı için değişiklik geri alındı. Biraz sonra tekrar deneyin.";
    case "rollback_failed":
      return "Değişiklik uygulandı ama denetim kaydı yazılamadı ve geri alınamadı. Teknik ekibe haber verin.";
  }
}
