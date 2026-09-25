import { beforeEach, describe, expect, it } from "vitest";
import {
  BUSINESS_ACTIONS,
  buildBusinessPatch,
  normalizeSlugInput,
  reasonError,
  slugError,
} from "@/lib/admin-business-actions";
import { canPerform } from "@/lib/admin-roles";
import { resetPlanCatalog } from "@/lib/entitlements";

// Yönetimden işletmeye uygulanan işlemlerin sözleşmesi. Bir işlemin ne yazdığı
// değişiyorsa önce bu test değişir.
describe("admin işletme işlemleri", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const base = { plan: "freemium" as const, plan_expires_at: "2026-10-01 00:00:00.000Z", freemium_started_at: "", suspended_at: "", slug: "kafe" };

  beforeEach(() => resetPlanCatalog());

  it("destek yalnızca süre, AI kotası, şifre sıfırlama ve not işlemlerini yapabilir", () => {
    const support = Object.entries(BUSINESS_ACTIONS)
      .filter(([, meta]) => canPerform("support", meta.permission))
      .map(([kind]) => kind)
      .sort();
    expect(support).toEqual(["ai_quota_reset", "note", "password_reset", "trial_extend"]);
    for (const meta of Object.values(BUSINESS_ACTIONS)) expect(canPerform("super_admin", meta.permission)).toBe(true);
  });

  it("gerekçe zorunlu ve sınırlı", () => {
    expect(reasonError("")).toBeTruthy();
    expect(reasonError("  ok  ")).toBeTruthy();
    expect(reasonError("ödeme alındı")).toBeNull();
    expect(reasonError("x".repeat(501))).toBeTruthy();
  });

  it("ücretli plana geçiş bitiş tarihiyle ya da süresiz yazılır", () => {
    expect(buildBusinessPatch("plan_assign", { plan: "premium", expiresOn: "2027-09-25" }, base, now)).toEqual({
      ok: true,
      // Gün sonu İstanbul saatiyle: ekranda seçilen gün görünsün.
      patch: { plan: "premium", plan_expires_at: "2027-09-25T20:59:59.000Z" },
    });
    expect(buildBusinessPatch("plan_assign", { plan: "elite" }, base, now)).toEqual({
      ok: true,
      patch: { plan: "elite", plan_expires_at: "" },
    });
  });

  it("süreli plana geçişte bitiş zorunlu ve süre bugünden başlar", () => {
    const paid = { ...base, plan: "premium" as const, plan_expires_at: "" };
    expect(buildBusinessPatch("plan_assign", { plan: "freemium" }, paid, now).ok).toBe(false);
    expect(buildBusinessPatch("plan_assign", { plan: "freemium", expiresOn: "2026-10-25" }, paid, now)).toEqual({
      ok: true,
      patch: { plan: "freemium", plan_expires_at: "2026-10-25T20:59:59.000Z", freemium_started_at: now.toISOString() },
    });
  });

  it("geçersiz plan, geçmiş tarih ve değişmeyen atama reddedilir", () => {
    expect(buildBusinessPatch("plan_assign", { plan: "gold" }, base, now).ok).toBe(false);
    expect(buildBusinessPatch("plan_assign", { plan: "premium", expiresOn: "2026-01-01" }, base, now).ok).toBe(false);
    expect(buildBusinessPatch("plan_assign", { plan: "premium", expiresOn: "25.09.2027" }, base, now).ok).toBe(false);
    const same = { ...base, plan: "elite" as const, plan_expires_at: "" };
    expect(buildBusinessPatch("plan_assign", { plan: "elite" }, same, now).ok).toBe(false);
  });

  it("süre uzatma, dolmamış süreye eklenir; dolmuşsa bugünden başlar", () => {
    expect(buildBusinessPatch("trial_extend", { days: 10 }, base, now)).toEqual({
      ok: true,
      patch: { plan_expires_at: "2026-10-11T00:00:00.000Z" },
    });
    const expired = { ...base, plan_expires_at: "2026-09-01 00:00:00.000Z" };
    expect(buildBusinessPatch("trial_extend", { days: 7 }, expired, now)).toEqual({
      ok: true,
      patch: { plan_expires_at: "2026-10-02T12:00:00.000Z" },
    });
  });

  it("süresiz işletme uzatılamaz, gün sınırı aşılamaz", () => {
    expect(buildBusinessPatch("trial_extend", { days: 10 }, { ...base, plan_expires_at: "" }, now).ok).toBe(false);
    for (const days of [0, -3, 1.5, 366, "abc"]) {
      expect(buildBusinessPatch("trial_extend", { days }, base, now).ok).toBe(false);
    }
  });

  it("AI kotası bu dönem için sıfırlanır", () => {
    expect(buildBusinessPatch("ai_quota_reset", {}, base, now)).toEqual({
      ok: true,
      patch: { ai_scans_used: 0, ai_scans_period: "2026-09" },
    });
  });

  it("askıya alma ve kaldırma durumu kontrol eder", () => {
    expect(buildBusinessPatch("suspend", { ownerMessage: " Ödeme bekleniyor " }, base, now)).toEqual({
      ok: true,
      patch: { suspended_at: now.toISOString(), suspension_reason: "Ödeme bekleniyor" },
    });
    const suspended = { ...base, suspended_at: now.toISOString() };
    expect(buildBusinessPatch("suspend", {}, suspended, now).ok).toBe(false);
    expect(buildBusinessPatch("unsuspend", {}, base, now).ok).toBe(false);
    expect(buildBusinessPatch("unsuspend", {}, suspended, now)).toEqual({
      ok: true,
      patch: { suspended_at: "", suspension_reason: "" },
    });
    expect(buildBusinessPatch("suspend", { ownerMessage: "x".repeat(301) }, base, now).ok).toBe(false);
  });

  it("menü adresi kurulum ekranıyla aynı kurallarla doğrulanır", () => {
    expect(normalizeSlugInput("Köşe Kafe!")).toBe("kose-kafe");
    expect(slugError("ab", "kafe")).toBeTruthy();
    expect(slugError("admin", "kafe")).toBeTruthy();
    expect(slugError("kafe", "kafe")).toBeTruthy();
    expect(slugError("yeni-kafe", "kafe")).toBeNull();
    expect(buildBusinessPatch("slug_change", { slug: "Yeni Kafe" }, base, now)).toEqual({ ok: true, patch: { slug: "yeni-kafe" } });
  });
});

describe("admin tarih gösterimi", () => {
  it("seçilen bitiş günü ekranda aynı gün görünür", async () => {
    const { toDateInputValue, formatAdminDay } = await import("@/lib/admin-format");
    const result = buildBusinessPatch("plan_assign", { plan: "premium", expiresOn: "2027-09-25" }, {
      plan: "freemium", plan_expires_at: "", freemium_started_at: "", suspended_at: "", slug: "kafe",
    }, new Date("2026-09-25T12:00:00.000Z"));
    if (!result.ok) throw new Error(result.error);
    const stored = result.patch.plan_expires_at as string;
    expect(toDateInputValue(stored)).toBe("2027-09-25");
    expect(formatAdminDay(stored)).toBe("25.09.2027");
  });
});
