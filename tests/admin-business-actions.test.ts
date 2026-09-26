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

describe("admin işletme silme, düzenleme ve e-posta", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const base = { plan: "freemium" as const, plan_expires_at: "2026-10-01 00:00:00.000Z", freemium_started_at: "", suspended_at: "", slug: "kafe" };

  beforeEach(() => resetPlanCatalog());

  it("silme yumuşaktır: askıyı da koyar; önceden askıdaysa askıya dokunmaz", () => {
    const deleted = buildBusinessPatch("delete", {}, base, now, "Sahibi hesabı kapatmak istedi");
    expect(deleted).toEqual({
      ok: true,
      patch: {
        deleted_at: now.toISOString(),
        deletion_reason: "Sahibi hesabı kapatmak istedi",
        suspended_at: now.toISOString(),
        suspension_reason: "",
      },
    });
    const suspended = { ...base, suspended_at: "2026-09-01 10:00:00.000Z" };
    expect(buildBusinessPatch("delete", {}, suspended, now, "gerekçe")).toEqual({
      ok: true,
      patch: { deleted_at: now.toISOString(), deletion_reason: "gerekçe" },
    });
  });

  it("silme yayından da kaldırır; geri alma yayın durumunu yalnızca silme kaydı söylüyorsa geri getirir", () => {
    const live = { ...base, is_active: true };
    expect(buildBusinessPatch("delete", {}, live, now, "gerekçe")).toMatchObject({ ok: true, patch: { is_active: false } });
    const at = "2026-09-20 10:00:00.000Z";
    const deleted = { ...base, is_active: false, deleted_at: at, suspended_at: at };
    expect(buildBusinessPatch("restore", { wasActive: true }, deleted, now)).toMatchObject({ ok: true, patch: { is_active: true } });
    const unknown = buildBusinessPatch("restore", {}, deleted, now);
    expect(unknown.ok && "is_active" in unknown.patch).toBe(false);
    // Menü adresi yoksa yayına alınmaz.
    const noSlug = buildBusinessPatch("restore", { wasActive: true }, { ...deleted, slug: "" }, now);
    expect(noSlug.ok && "is_active" in noSlug.patch).toBe(false);
  });

  it("geri alma, silmenin koyduğu askıyı kaldırır; önceki askı kalır", () => {
    const at = "2026-09-20 10:00:00.000Z";
    expect(buildBusinessPatch("restore", {}, { ...base, deleted_at: at, suspended_at: at }, now)).toEqual({
      ok: true,
      patch: { deleted_at: "", deletion_reason: "", suspended_at: "", suspension_reason: "" },
    });
    expect(buildBusinessPatch("restore", {}, { ...base, deleted_at: at, suspended_at: "2026-09-01 10:00:00.000Z" }, now)).toEqual({
      ok: true,
      patch: { deleted_at: "", deletion_reason: "" },
    });
    expect(buildBusinessPatch("restore", {}, base, now)).toMatchObject({ ok: false });
  });

  it("silinmiş işletmede geri almaktan başka işlem yapılmaz", () => {
    const deleted = { ...base, deleted_at: "2026-09-20 10:00:00.000Z", suspended_at: "2026-09-20 10:00:00.000Z" };
    for (const kind of ["plan_assign", "trial_extend", "ai_quota_reset", "unsuspend", "slug_change", "edit", "email_change", "delete"] as const) {
      expect(buildBusinessPatch(kind, { plan: "premium", days: 5, slug: "yeni-adres", fields: { name: "X" }, email: "a@b.co" }, deleted, now)).toMatchObject({
        ok: false,
        error: "İşletme silinmiş. Önce silmeyi geri alın.",
      });
    }
  });

  it("bilgi düzenleme yalnızca değişen ve izinli alanları yazar", () => {
    const business = { ...base, name: "Kafe", phone: "0555", is_active: true };
    expect(buildBusinessPatch("edit", { fields: { name: " Kafe Yeni ", phone: "0555", is_active: false } }, business, now)).toEqual({
      ok: true,
      patch: { name: "Kafe Yeni", is_active: false },
    });
    expect(buildBusinessPatch("edit", { fields: { name: "Kafe" } }, business, now)).toEqual({ ok: false, error: "Değişiklik yok." });
    // Plan gibi korumalı alanlar bu yoldan yazılamaz.
    expect(buildBusinessPatch("edit", { fields: { plan: "elite" } }, business, now)).toMatchObject({ ok: false });
    expect(buildBusinessPatch("edit", { fields: { name: "" } }, business, now)).toMatchObject({ ok: false });
    expect(buildBusinessPatch("edit", { fields: { contact_email: "yanlış" } }, business, now)).toMatchObject({ ok: false });
    // Menü adresi olmayan hesap yayına alınamaz.
    expect(buildBusinessPatch("edit", { fields: { is_active: true } }, { ...base, slug: "", is_active: false }, now)).toMatchObject({ ok: false });
  });

  it("giriş e-postası geçerli ve farklı olmalı; küçük harfe indirilir", () => {
    const business = { ...base, email: "sahip@kafe.com" };
    expect(buildBusinessPatch("email_change", { email: " Yeni@Kafe.com " }, business, now)).toEqual({ ok: true, patch: { email: "yeni@kafe.com" } });
    expect(buildBusinessPatch("email_change", { email: "SAHIP@kafe.com" }, business, now)).toMatchObject({ ok: false });
    expect(buildBusinessPatch("email_change", { email: "olmaz" }, business, now)).toMatchObject({ ok: false });
  });

  it("silme, düzenleme ve e-posta değiştirme yalnızca süper yöneticide", () => {
    for (const kind of ["delete", "restore", "edit", "email_change"] as const) {
      expect(canPerform("support", BUSINESS_ACTIONS[kind].permission)).toBe(false);
      expect(canPerform("super_admin", BUSINESS_ACTIONS[kind].permission)).toBe(true);
    }
  });
});
