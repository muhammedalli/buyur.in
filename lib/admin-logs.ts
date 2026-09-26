// Denetim kaydı ekranlarının sunucu okuma katmanı. Filtrelerin PocketBase
// sorgusuna çevrilmesi saf katmanda (lib/audit-log.ts → buildAuditFilter);
// burada yalnızca istekler var. Okumalar yöneticinin kendi istemcisiyle
// yapılır: kayıt koleksiyonu ve işletme adları her yöneticiye açık.

import type PocketBase from "pocketbase";
import {
  AUDIT_LOG_COLLECTION,
  AUDIT_PAGE_SIZE,
  auditBusinessId,
  buildAuditFilter,
  looksLikeRecordId,
  type AuditLogQuery,
} from "@/lib/audit-log";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import type { AuditLog } from "@/lib/types";

/** İşletme filtresindeki metni kimliklere çevirir: kimlik, menü adresi ya da
 *  ad parçası. En fazla 20 işletme (belirsiz bir aramada sorgu şişmesin). */
export async function resolveBusinessIds(pb: PocketBase, input: string): Promise<string[]> {
  const value = input.trim();
  if (!value) return [];
  if (looksLikeRecordId(value)) return [value];
  const found = await pb.collection(BUSINESS_COLLECTION).getList<{ id: string }>(1, 20, {
    filter: pb.filter("slug = {:v} || name ~ {:v}", { v: value }),
    fields: "id",
    requestKey: null,
  });
  return found.items.map((item) => item.id);
}

export interface AuditPage {
  items: AuditLog[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export async function loadAuditPage(pb: PocketBase, query: AuditLogQuery, perPage = AUDIT_PAGE_SIZE): Promise<AuditPage> {
  const filter = buildAuditFilter(query, (expr, params) => pb.filter(expr, params));
  const result = await pb.collection(AUDIT_LOG_COLLECTION).getList<AuditLog>(query.page, perPage, {
    sort: "-created",
    ...(filter ? { filter } : {}),
    requestKey: null,
  });
  return { items: result.items, page: result.page, totalPages: result.totalPages, totalItems: result.totalItems };
}

/** Sayfadaki kayıtların işletme adları, tek sorguda. Okunamazsa boş: ad
 *  yerine kimlik görünür, sayfa açılır. */
export async function loadBusinessNames(pb: PocketBase, logs: AuditLog[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(logs.map(auditBusinessId).filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const filter = ids.map((id, i) => pb.filter(`id = {:id${i}}`, { [`id${i}`]: id })).join(" || ");
    const rows = await pb.collection(BUSINESS_COLLECTION).getFullList<{ id: string; name: string; slug: string }>({
      filter,
      fields: "id,name,slug",
      requestKey: null,
    });
    return Object.fromEntries(rows.map((row) => [row.id, row.name || row.slug || "Adsız hesap"]));
  } catch (err) {
    console.error("[admin-logs] işletme adları okunamadı", err);
    return {};
  }
}

/** Kimlik → son giriş zamanı (verilen eylem için). Tek sorgu: son N kayıt
 *  okunur, her aktörün ilki alınır. */
export async function loadLastEvents(
  pb: PocketBase,
  action: string,
  field: "actor_id" | "business_id",
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  try {
    const filter =
      pb.filter("action = {:action}", { action }) +
      " && (" +
      ids.map((id, i) => pb.filter(`${field} = {:id${i}}`, { [`id${i}`]: id })).join(" || ") +
      ")";
    const rows = await pb.collection(AUDIT_LOG_COLLECTION).getList<AuditLog>(1, 500, {
      filter,
      sort: "-created",
      fields: `${field},created`,
      requestKey: null,
    });
    const out: Record<string, string> = {};
    for (const row of rows.items) {
      const key = row[field];
      if (key && !out[key]) out[key] = row.created;
    }
    return out;
  } catch (err) {
    console.error("[admin-logs] son olaylar okunamadı", action, err);
    return {};
  }
}
