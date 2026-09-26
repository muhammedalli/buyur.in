import { beforeEach, describe, expect, it } from "vitest";
import { computeOverview, istanbulDayStart } from "@/lib/admin-overview";
import type { AdminBusinessRow } from "@/lib/admin-business-list";
import { resetPlanCatalog } from "@/lib/entitlements";

// Yönetim paneli genel bakışının sözleşmesi.
function row(patch: Partial<AdminBusinessRow>): AdminBusinessRow {
  return {
    id: "id",
    name: "İşletme",
    slug: "isletme",
    email: "",
    plan: "freemium",
    is_active: true,
    suspended_at: "",
    plan_expires_at: "",
    menu_views: 0,
    ai_scans_used: 0,
    ai_scans_period: "",
    created: "2026-09-01 10:00:00.000Z",
    updated: "2026-09-01 10:00:00.000Z",
    ...patch,
  };
}

describe("admin genel bakış", () => {
  // 25 Eylül 2026, İstanbul 00:30 (UTC 24 Eylül 21:30).
  const now = new Date("2026-09-24T21:30:00.000Z");
  beforeEach(() => resetPlanCatalog());

  it("gün İstanbul saatine göre başlar", () => {
    expect(istanbulDayStart(now).toISOString()).toBe("2026-09-24T21:00:00.000Z");
  });

  it("bugün ve bu hafta açılan hesapları İstanbul gününe göre sayar", () => {
    const rows = [
      row({ id: "a", created: "2026-09-24 21:10:00.000Z" }), // İstanbul 25 Eylül 00:10 → bugün
      row({ id: "b", created: "2026-09-24 20:50:00.000Z" }), // İstanbul 24 Eylül → dün
      row({ id: "c", created: "2026-09-19 12:00:00.000Z" }), // 6 gün önce → bu hafta
      row({ id: "d", created: "2026-09-10 12:00:00.000Z" }),
    ];
    const o = computeOverview(rows, now);
    expect(o.newToday).toBe(1);
    expect(o.newThisWeek).toBe(3);
  });

  it("durum, plan dağılımı ve ücretli oranı", () => {
    const rows = [
      row({ id: "a", plan: "premium" }),
      row({ id: "b", plan: "elite" }),
      row({ id: "c", plan: "freemium" }),
      row({ id: "d", slug: "", name: "", plan: "freemium" }),
      row({ id: "e", plan: "premium", suspended_at: "2026-09-20 10:00:00.000Z" }),
    ];
    const o = computeOverview(rows, now);
    expect(o.byStatus).toEqual({ live: 3, setup: 1, offline: 0, suspended: 1, deleted: 0 });
    expect(o.byPlan).toEqual({ freemium: 2, premium: 2, elite: 1 });
    // Kurulumu bitmiş 4 hesaptan 3'ü ücretli (askıdaki de dahil).
    expect(o.paidShare).toBe(0.75);
  });

  it("silinen hesap hiçbir platform sayısına girmez", () => {
    const at = "2026-09-20 10:00:00.000Z";
    const rows = [
      row({ id: "a", plan: "premium" }),
      row({ id: "x", plan: "elite", deleted_at: at, suspended_at: at, menu_views: 900, ai_scans_used: 3, ai_scans_period: "2026-09" }),
    ];
    const o = computeOverview(rows, now);
    expect(o.total).toBe(1);
    expect(o.byStatus.deleted).toBe(1);
    expect(o.byStatus.suspended).toBe(0);
    expect(o.byPlan.elite).toBe(0);
    expect(o.menuViewsTotal).toBe(0);
    expect(o.aiScansThisMonth).toBe(0);
  });

  it("bitişe göre 7 gün, 30 gün ve geçmiş listeleri; askı ve kurulum hariç", () => {
    const rows = [
      row({ id: "soon", plan_expires_at: "2026-09-28 10:00:00.000Z" }),
      row({ id: "month", plan: "premium", plan_expires_at: "2026-10-20 10:00:00.000Z" }),
      row({ id: "far", plan_expires_at: "2026-12-20 10:00:00.000Z" }),
      row({ id: "gone", plan_expires_at: "2026-09-20 10:00:00.000Z" }),
      row({ id: "susp", plan_expires_at: "2026-09-26 10:00:00.000Z", suspended_at: "2026-09-20 10:00:00.000Z" }),
      row({ id: "setup", slug: "", plan_expires_at: "2026-09-26 10:00:00.000Z" }),
    ];
    const o = computeOverview(rows, now);
    expect(o.expiring7.map((b) => b.id)).toEqual(["soon"]);
    expect(o.expiring30.map((b) => b.id)).toEqual(["month"]);
    expect(o.expired.map((b) => b.id)).toEqual(["gone"]);
    // Süreli planda bitiş menüyü kapatır; ücretli planda yalnızca yenileme tarihidir.
    expect(o.expiring7[0].closesMenu).toBe(true);
    expect(o.expiring30[0].closesMenu).toBe(false);
  });

  it("AI kullanımını yalnızca bu dönem için toplar", () => {
    const rows = [
      row({ id: "a", ai_scans_used: 3, ai_scans_period: "2026-09" }),
      row({ id: "b", ai_scans_used: 5, ai_scans_period: "2026-08" }),
      row({ id: "c", menu_views: 120 }),
    ];
    const o = computeOverview(rows, now);
    expect(o.aiScansThisMonth).toBe(3);
    expect(o.menuViewsTotal).toBe(120);
  });
});
