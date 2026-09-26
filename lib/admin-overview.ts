// Yönetim paneli genel bakışının SAF hesapları: hesap sayıları, plan dağılımı,
// bitişi yaklaşan/geçen işletmeler, AI kullanımı. Sözleşmesi
// tests/admin-overview.test.ts. Girdi, işletme listesinin satırlarıdır
// (lib/admin-businesses.ts → loadBusinessRows); ek sorgu yapılmaz.

import { businessStatus, type AdminBusinessRow, type BusinessStatus } from "@/lib/admin-business-list";
import { PLAN_ORDER, aiPeriodKey, entitlementsFor, normalizePlan } from "@/lib/entitlements";
import type { Plan } from "@/lib/types";

const DAY_MS = 86_400_000;

/** İstanbul'da bugünün başlangıcı (UTC+3, yaz saati yok). Vercel UTC'de
 *  çalışır; "bugün açılan hesap" ekibin takvimine göre sayılmalı. */
export function istanbulDayStart(now: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
  return new Date(`${day}T00:00:00+03:00`);
}

function time(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value.trim().replace(" ", "T"));
  return Number.isNaN(ms) ? null : ms;
}

export interface ExpiringBusiness {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  expiresAt: string;
  /** Kalan tam gün; geçmişse negatif. */
  daysLeft: number;
  /** Süre dolunca menü kapanır mı (süreli plan) yoksa yalnızca yenileme tarihi mi. */
  closesMenu: boolean;
}

export interface PlatformOverview {
  total: number;
  newToday: number;
  newThisWeek: number;
  byStatus: Record<BusinessStatus, number>;
  byPlan: Record<Plan, number>;
  /** Kurulumu bitmiş hesaplar içinde ücretli plandakilerin oranı (0–1). */
  paidShare: number | null;
  expiring7: ExpiringBusiness[];
  expiring30: ExpiringBusiness[];
  expired: ExpiringBusiness[];
  aiScansThisMonth: number;
  /** Tüm zamanların menü görüntülenme sayacı toplamı. */
  menuViewsTotal: number;
}

export function computeOverview(rows: AdminBusinessRow[], now: Date = new Date()): PlatformOverview {
  const todayStart = istanbulDayStart(now).getTime();
  const weekStart = todayStart - 6 * DAY_MS;
  const period = aiPeriodKey(now);

  const byStatus: Record<BusinessStatus, number> = { live: 0, setup: 0, offline: 0, suspended: 0, deleted: 0 };
  const byPlan = Object.fromEntries(PLAN_ORDER.map((p) => [p, 0])) as Record<Plan, number>;
  let newToday = 0;
  let newThisWeek = 0;
  let aiScansThisMonth = 0;
  let menuViewsTotal = 0;
  let setUp = 0;
  let paid = 0;
  const withExpiry: ExpiringBusiness[] = [];

  for (const row of rows) {
    const status = businessStatus(row);
    byStatus[status] += 1;
    // Silinen hesap hiçbir platform sayısına girmez; yalnızca kendi sayısı tutulur.
    if (status === "deleted") continue;
    const plan = normalizePlan(row.plan);
    byPlan[plan] += 1;

    const created = time(row.created);
    if (created !== null && created >= todayStart) newToday += 1;
    if (created !== null && created >= weekStart) newThisWeek += 1;

    if (row.ai_scans_period === period) aiScansThisMonth += Math.max(0, row.ai_scans_used ?? 0);
    menuViewsTotal += Math.max(0, row.menu_views ?? 0);

    if (status !== "setup") {
      setUp += 1;
      // Ücretli = süre ve görüntülenme sınırı olmayan plan; plan adına bakılmaz.
      const { limits } = entitlementsFor(plan);
      if (limits.durationMonths === null && limits.menuViews === null) paid += 1;
    }

    const expires = time(row.plan_expires_at);
    // Askıdaki ve kurulumu bitmemiş hesap satış takibinin konusu değil.
    if (expires !== null && status !== "suspended" && status !== "setup") {
      withExpiry.push({
        id: row.id,
        name: row.name || row.slug || "Adsız hesap",
        slug: row.slug,
        plan,
        expiresAt: row.plan_expires_at as string,
        daysLeft: Math.ceil((expires - now.getTime()) / DAY_MS),
        closesMenu: entitlementsFor(plan).limits.durationMonths !== null,
      });
    }
  }

  withExpiry.sort((a, b) => a.daysLeft - b.daysLeft);
  return {
    total: rows.length - byStatus.deleted,
    newToday,
    newThisWeek,
    byStatus,
    byPlan,
    paidShare: setUp > 0 ? paid / setUp : null,
    expiring7: withExpiry.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 7),
    expiring30: withExpiry.filter((b) => b.daysLeft > 7 && b.daysLeft <= 30),
    expired: withExpiry.filter((b) => b.daysLeft < 0),
    aiScansThisMonth,
    menuViewsTotal,
  };
}
