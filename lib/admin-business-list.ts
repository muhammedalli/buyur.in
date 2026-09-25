// Yönetim panelindeki işletme listesinin SAF kuralları: durum, arama, filtre,
// sıralama, sayfalama. Sözleşmesi tests/admin-business-list.test.ts.
//
// Liste bellekte süzülür, PocketBase filtresinde değil: e-posta alanı auth
// kayıtlarında filtrelenemiyor (yalnızca superuser; bkz. lib/business-auth.ts →
// findBusinessByEmail) ve durum gibi türetilmiş alanlar sorguya çevrilemiyor.
// İşletme sayısı binlerle ölçülene kadar tek turda hepsini okumak yeterince hızlı.

import { isSuspended } from "@/lib/business-suspension";
import { PLAN_ORDER } from "@/lib/entitlements";
import type { Business, Plan } from "@/lib/types";

export type AdminBusinessRow = Pick<
  Business,
  | "id"
  | "name"
  | "slug"
  | "email"
  | "plan"
  | "is_active"
  | "suspended_at"
  | "plan_expires_at"
  | "menu_views"
  | "created"
  | "updated"
>;

/** Listede istenen alanlar — yanıt küçük kalsın. */
export const ADMIN_BUSINESS_ROW_FIELDS =
  "id,name,slug,email,plan,is_active,suspended_at,plan_expires_at,menu_views,created,updated";

export type BusinessStatus = "live" | "setup" | "offline" | "suspended";

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  live: "Yayında",
  setup: "Kurulum bekliyor",
  offline: "Yayında değil",
  suspended: "Askıda",
};

/** Askı her şeyin önüne geçer; slug yoksa kurulum bitmemiştir. */
export function businessStatus(row: Pick<AdminBusinessRow, "slug" | "is_active" | "suspended_at">): BusinessStatus {
  if (isSuspended(row)) return "suspended";
  if (!row.slug) return "setup";
  return row.is_active ? "live" : "offline";
}

export type BusinessSort = "newest" | "oldest" | "name" | "expiring" | "updated";

export const BUSINESS_SORT_LABELS: Record<BusinessSort, string> = {
  newest: "En yeni kayıt",
  oldest: "En eski kayıt",
  name: "Ada göre",
  expiring: "Bitişi en yakın",
  updated: "Son güncellenen",
};

export interface BusinessListQuery {
  q: string;
  plan: Plan | "";
  status: BusinessStatus | "";
  sort: BusinessSort;
  page: number;
}

export const BUSINESS_PAGE_SIZE = 25;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Adres çubuğundaki parametreleri güvenli bir sorguya çevirir; tanınmayan
 *  değer varsayılana düşer. */
export function parseBusinessListQuery(params: Record<string, string | undefined>): BusinessListQuery {
  const page = Number.parseInt(params.sayfa ?? "", 10);
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    plan: pick(params.plan, ["", ...PLAN_ORDER], ""),
    status: pick(params.durum, ["", "live", "setup", "offline", "suspended"], ""),
    sort: pick(params.sirala, ["newest", "oldest", "name", "expiring", "updated"], "newest"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function normalize(value: string | undefined): string {
  return (value ?? "").toLocaleLowerCase("tr-TR").trim();
}

function time(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value.trim().replace(" ", "T"));
  return Number.isNaN(ms) ? null : ms;
}

export interface BusinessListResult {
  items: AdminBusinessRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function queryBusinesses(rows: AdminBusinessRow[], query: BusinessListQuery): BusinessListResult {
  const q = normalize(query.q);
  const filtered = rows.filter((row) => {
    if (query.plan && row.plan !== query.plan) return false;
    if (query.status && businessStatus(row) !== query.status) return false;
    if (!q) return true;
    return [row.name, row.slug, row.email, row.id].some((field) => normalize(field).includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "oldest":
        return (time(a.created) ?? 0) - (time(b.created) ?? 0);
      case "name": {
        // Adı olmayan (kurulumu bitmemiş) hesaplar sona.
        const na = a.name || a.slug;
        const nb = b.name || b.slug;
        if (!na || !nb) return na ? -1 : nb ? 1 : 0;
        return na.localeCompare(nb, "tr");
      }
      case "updated":
        return (time(b.updated) ?? 0) - (time(a.updated) ?? 0);
      case "expiring": {
        // Bitişi olmayanlar sona; süresi geçmişler başa (en acil olan).
        const ea = time(a.plan_expires_at);
        const eb = time(b.plan_expires_at);
        if (ea === null && eb === null) return 0;
        if (ea === null) return 1;
        if (eb === null) return -1;
        return ea - eb;
      }
      default:
        return (time(b.created) ?? 0) - (time(a.created) ?? 0);
    }
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / BUSINESS_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * BUSINESS_PAGE_SIZE;
  return { items: sorted.slice(start, start + BUSINESS_PAGE_SIZE), total: sorted.length, page, totalPages };
}

/** Sorguyu adres çubuğu parametrelerine geri çevirir (sayfa bağlantıları için). */
export function businessListHref(query: BusinessListQuery, patch: Partial<BusinessListQuery> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.plan) params.set("plan", next.plan);
  if (next.status) params.set("durum", next.status);
  if (next.sort !== "newest") params.set("sirala", next.sort);
  if (next.page > 1) params.set("sayfa", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/businesses?${qs}` : "/admin/businesses";
}
