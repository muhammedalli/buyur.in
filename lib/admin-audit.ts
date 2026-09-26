// Merkezi denetim kaydının Next.js YAZMA katmanı (buyur_admin_logs). Eylem
// sözlüğü, etiketler ve önce/sonra gösterimi lib/audit-log.ts'te; işletme
// panelinden gelen yazmaları PocketBase hook'u (pocketbase/pb_hooks) yazar.
// Sözleşmesi tests/admin-audit.test.ts.
//
// Her yönetim ucu değişikliği buradaki üç sarmalayıcıdan biriyle yapar:
// runAuditedUpdate / runAuditedCreate / runAuditedDelete. Uçlar kendi
// kayıt kodunu yazmaz; böylece "önce ne vardı, sonra ne oldu" her işlemde aynı
// biçimde tutulur.
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
import { AUDIT_LOG_COLLECTION } from "@/lib/audit-log";
import type { Admin, AuditActorType, AuditLog } from "@/lib/types";

export const ADMIN_LOG_COLLECTION = AUDIT_LOG_COLLECTION;

export interface AuditActor {
  type: AuditActorType;
  id: string;
  email: string;
}

/** Tek bir kaydın bütün bilgisi: kim → ne → hangi işletmede → hangi kayıtta →
 *  önce/sonra → neden → nereden. */
export interface AuditEntry {
  actor: AuditActor;
  action: string;
  targetCollection?: string;
  targetId?: string;
  /** Kaydın ait olduğu işletme. İşletmenin kendisi hedefse verilmese de olur. */
  businessId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  ip?: string;
  meta?: Record<string, unknown> | null;
}

export interface AdminActionEntry extends Omit<AuditEntry, "actor"> {
  admin: Pick<Admin, "id" | "email">;
}

/** Tek bir denetim kaydı yazar. Geçici hatada yeniden dener; `op_id` sayesinde
 *  yanıtı kaybolan bir yazım ikinci kez eklenmez.
 *
 *  `admin` alanına kaydı YAZAN hesap girer (kural: yazan kendi adına yazar).
 *  Yönetici kendi işlemini, servis hesabı işletme/sistem işlemlerini yazar. */
export async function recordAudit(pb: PocketBase, entry: AuditEntry, options: RetryOptions = {}): Promise<AuditLog> {
  const opId = randomUUID();
  const writerId = pb.authStore?.record?.id || (entry.actor.type === "admin" ? entry.actor.id : "");
  const businessId =
    entry.businessId ?? (entry.targetCollection === "buyur_businesses" ? entry.targetId ?? "" : "");
  return withRetry(
    () =>
      pb.collection(AUDIT_LOG_COLLECTION).create<AuditLog>(
        {
          op_id: opId,
          admin: writerId,
          // İlk sürümle uyum: eski ekranlar yöneticinin e-postasını buradan okur.
          admin_email: entry.actor.type === "admin" ? entry.actor.email : "",
          actor_type: entry.actor.type,
          actor_id: entry.actor.id,
          actor_email: entry.actor.email.slice(0, 200),
          business_id: businessId,
          action: entry.action,
          target_collection: entry.targetCollection ?? "",
          target_id: entry.targetId ?? "",
          before: entry.before ?? null,
          after: entry.after ?? null,
          reason: entry.reason?.trim().slice(0, 500) ?? "",
          ip: entry.ip?.slice(0, 64) ?? "",
          meta: entry.meta ?? null,
        },
        { requestKey: null }
      ),
    {
      ...options,
      verify: () =>
        pb
          .collection(AUDIT_LOG_COLLECTION)
          .getFirstListItem<AuditLog>(pb.filter("op_id = {:opId}", { opId }), { requestKey: null }),
    }
  );
}

export function adminActor(admin: Pick<Admin, "id" | "email">): AuditActor {
  return { type: "admin", id: admin.id, email: admin.email };
}

/** Yöneticinin kendi işlemi (giriş, çıkış, e-posta gönderme gibi kayıt
 *  değiştirmeyen işlemler dahil). */
export async function recordAdminAction(
  pb: PocketBase,
  entry: AdminActionEntry,
  options: RetryOptions = {}
): Promise<AuditLog> {
  const { admin, ...rest } = entry;
  return recordAudit(pb, { ...rest, actor: adminActor(admin) }, options);
}

/** Kaydın yalnızca değişen alanlarını alır; olmayan alan null yazılır ki geri
 *  alma sırasında "boştu" bilgisi kaybolmasın. */
function pickFields(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, record[key] ?? null]));
}

/** Kayda asla girmeyen alanlar: şifreler. */
const SECRET_FIELDS = new Set(["password", "passwordConfirm", "oldPassword"]);

/** Silinen kaydın geri yaratılabilir kopyası: sistem alanları olmadan. */
const SYSTEM_FIELDS = new Set(["collectionId", "collectionName", "created", "updated", "expand"]);
function restorable(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !SYSTEM_FIELDS.has(key)));
}

export type AuditFailure = "write_failed" | "log_failed" | "rollback_failed";

export type AuditedResult<T> =
  | { ok: true; record: T; log: AuditLog }
  | { ok: false; reason: AuditFailure; error: unknown };

type AuditedBase = Omit<AdminActionEntry, "before" | "after" | "targetCollection" | "targetId">;

export interface AuditedUpdate extends AuditedBase {
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
  const keys = Object.keys(patch).filter((key) => !SECRET_FIELDS.has(key));

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

export interface AuditedCreate extends AuditedBase {
  collection: string;
  data: Record<string, unknown>;
}

/** Kaydı oluşturur ve denetim kaydını yazar; kayıt yazılamazsa oluşturulan
 *  kaydı siler. Oluşturma tekrar denenmez: yanıtı kaybolan bir create ikinci
 *  kez çalışırsa çift kayıt olur (CLAUDE.md §3.7) — hata yöneticiye döner,
 *  yönetici listeye bakıp gerekirse tekrarlar. */
export async function runAuditedCreate<T extends Record<string, unknown> & { id: string }>(
  pb: PocketBase,
  create: AuditedCreate,
  options: RetryOptions = {}
): Promise<AuditedResult<T>> {
  const { collection, data, ...entry } = create;
  let record: T;
  try {
    record = await pb.collection(collection).create<T>(data, { requestKey: null });
  } catch (error) {
    return { ok: false, reason: "write_failed", error };
  }
  try {
    const log = await recordAdminAction(
      pb,
      {
        ...entry,
        targetCollection: collection,
        targetId: record.id,
        before: null,
        after: pickFields(record, Object.keys(data).filter((key) => !SECRET_FIELDS.has(key))),
      },
      options
    );
    return { ok: true, record, log };
  } catch (logError) {
    try {
      await withRetry(() => pb.collection(collection).delete(record.id, { requestKey: null }), options);
      return { ok: false, reason: "log_failed", error: logError };
    } catch (rollbackError) {
      console.error("[admin-audit] denetim kaydı yazılamadı ve oluşturulan kayıt silinemedi", { collection, id: record.id }, rollbackError);
      return { ok: false, reason: "rollback_failed", error: rollbackError };
    }
  }
}

export interface AuditedDelete extends AuditedBase {
  collection: string;
  id: string;
  /** Silmeyle birlikte (cascade) giden bağlı kayıtlar: kayıt yazılamazsa
   *  bunlar da geri yaratılır. Ör. ürünün seçenekleri. */
  dependents?: { collection: string; field: string }[];
}

/** Kaydı siler ve silinmeden önceki anlık görüntüsünü denetim kaydına yazar.
 *  Kayıt yazılamazsa silinen kaydı (ve bağlılarını) AYNI kimlikle geri
 *  yaratır; bağlantılar ve geçmiş kopmaz. */
export async function runAuditedDelete<T extends Record<string, unknown> & { id: string }>(
  pb: PocketBase,
  del: AuditedDelete,
  options: RetryOptions = {}
): Promise<AuditedResult<T>> {
  const { collection, id, dependents = [], ...entry } = del;
  let snapshot: T;
  const children: { collection: string; rows: Record<string, unknown>[] }[] = [];
  try {
    snapshot = await withRetry(() => pb.collection(collection).getOne<T>(id, { requestKey: null }), options);
    for (const dep of dependents) {
      const rows = await withRetry(
        () =>
          pb.collection(dep.collection).getFullList<Record<string, unknown>>({
            filter: pb.filter(`${dep.field} = {:id}`, { id }),
            requestKey: null,
          }),
        options
      );
      children.push({ collection: dep.collection, rows });
    }
    await withRetry(
      () => pb.collection(collection).delete(id, { requestKey: null }),
      {
        ...options,
        // 503 "silinmedi" demek değildir: tekrar denemeden önce kayıt hâlâ var mı bak.
        verify: async () => {
          try {
            await pb.collection(collection).getOne(id, { requestKey: null });
            return null;
          } catch (err) {
            if ((err as { status?: number })?.status === 404) return true;
            throw err;
          }
        },
      }
    );
  } catch (error) {
    return { ok: false, reason: "write_failed", error };
  }

  const before = restorable(snapshot);
  try {
    const log = await recordAdminAction(
      pb,
      {
        ...entry,
        targetCollection: collection,
        targetId: id,
        before,
        after: null,
        meta: {
          ...(entry.meta ?? {}),
          ...(children.some((c) => c.rows.length) ? { cascaded: Object.fromEntries(children.map((c) => [c.collection, c.rows.length])) } : {}),
        },
      },
      options
    );
    return { ok: true, record: snapshot, log };
  } catch (logError) {
    try {
      await pb.collection(collection).create(before, { requestKey: null });
      // Sıralı: toplu create yok (CLAUDE.md §3.7).
      for (const child of children) {
        for (const row of child.rows) await pb.collection(child.collection).create(restorable(row), { requestKey: null });
      }
      return { ok: false, reason: "log_failed", error: logError };
    } catch (rollbackError) {
      console.error("[admin-audit] denetim kaydı yazılamadı ve silinen kayıt geri yaratılamadı", { collection, id, before }, rollbackError);
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

/** Denetimli işlem sonucu → HTTP yanıtı için durum kodu ve mesaj. PocketBase
 *  kuralı reddederse 404 döner (kayıt "yok" gibi görünür): bu bir yetki
 *  sorunudur. */
export function auditFailureResponse(result: { reason: AuditFailure; error: unknown }): { status: number; error: string } {
  const status = (result.error as { status?: number })?.status;
  if (result.reason === "write_failed" && (status === 404 || status === 403)) {
    return { status: 403, error: "Bu işlem için yetkiniz yok." };
  }
  if (result.reason === "write_failed" && status === 400) {
    return { status: 400, error: "Değişiklik kaydedilemedi: girilen değerlerden biri geçersiz." };
  }
  return { status: 500, error: auditFailureMessage(result.reason) };
}
