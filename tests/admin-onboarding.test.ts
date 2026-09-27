import { describe, expect, it } from "vitest";
import { adminPhone, buildNewBusiness, generatePassword, loginEmailAlias } from "@/lib/admin-onboarding";
import type { Plan } from "@/lib/types";

// Yönetimden yeni işletme açmanın sözleşmesi: e-posta kodu yok, telefon
// engellemez, kayıtlı e-posta takma adla kabul edilir, menü tek dilde ve
// kurulum adımı tamamlanmış açılır.

const now = new Date("2026-09-27T10:00:00.000Z");
const durations: Record<Plan, number | null> = { freemium: 1, premium: null, elite: null };
const durationOf = (plan: Plan) => durations[plan];

const valid = {
  name: "Kuzey Kafe",
  email: "Sahip@Ornek.com ",
  phone: "0532 123 45 67",
  password: "gizli-sifre-1",
  slug: "Kuzey Kafe",
  sector: "kafe",
  mainLanguage: "tr",
  plan: "freemium",
};

describe("buildNewBusiness", () => {
  it("geçerli girdiyi kurulumu bitmiş hesap kaydına çevirir", () => {
    const result = buildNewBusiness(valid, durationOf, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      email: "sahip@ornek.com",
      passwordConfirm: "gizli-sifre-1",
      emailVisibility: false,
      name: "Kuzey Kafe",
      slug: "kuzey-kafe",
      main_language: "tr",
      languages: [],
      is_active: true,
      plan: "freemium",
      freemium_started_at: now.toISOString(),
      menu_views: 0,
    });
    // Süreli planda bitiş verilmediyse kayıt ekranı gibi: bugün + plan süresi.
    expect(result.data.plan_expires_at).toBe("2026-10-27T10:00:00.000Z");
  });

  it("süresiz planda bitiş boş kalır; verilen gün sonuna yazılır", () => {
    const open = buildNewBusiness({ ...valid, plan: "premium" }, durationOf, now);
    expect(open.ok && open.data.plan_expires_at).toBe("");
    const dated = buildNewBusiness({ ...valid, plan: "premium", expiresOn: "2027-01-31" }, durationOf, now);
    expect(dated.ok && dated.data.plan_expires_at).toBe("2027-01-31T23:59:59.000Z");
    expect(dated.ok && dated.data.freemium_started_at).toBe("");
  });

  it("yayına almak istenmezse hesap taslak açılır", () => {
    const result = buildNewBusiness({ ...valid, publish: false }, durationOf, now);
    expect(result.ok && result.data.is_active).toBe(false);
  });

  it.each([
    [{ name: "" }, "name"],
    [{ email: "gecersiz" }, "email"],
    [{ password: "kısa" }, "password"],
    [{ slug: "ab" }, "slug"],
    [{ slug: "admin" }, "slug"],
    [{ sector: "uzay" }, "sector"],
    [{ mainLanguage: "xx" }, "mainLanguage"],
    [{ plan: "platinum" }, "plan"],
    [{ expiresOn: "2026-01-01" }, "expiresOn"],
    [{ expiresOn: "yarın" }, "expiresOn"],
  ])("geçersiz girdi alanıyla reddedilir: %o", (patch, field) => {
    const result = buildNewBusiness({ ...valid, ...patch }, durationOf, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe(field);
  });
});

describe("telefon ve e-posta engel olmaz", () => {
  it("telefon boş, yabancı ya da alışılmadık biçimde olabilir", () => {
    expect(adminPhone("")).toBe("");
    expect(adminPhone(undefined)).toBe("");
    expect(adminPhone("0532 123 45 67")).toBe("+90 532 123 45 67");
    expect(adminPhone("0212 555 00 11")).toBe("+90 212 555 00 11");
    expect(adminPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(adminPhone("444 1 234")).toBe("444 1 234");
    expect(adminPhone("x".repeat(40))).toHaveLength(30);
    for (const phone of ["", "123", "dahili 12"]) {
      expect(buildNewBusiness({ ...valid, phone }, durationOf, now).ok).toBe(true);
    }
  });

  it("kayıtlı e-posta için artı adresli takma ad üretilir, sayıyla çoğalır", () => {
    expect(loginEmailAlias("sahip@ornek.com", "kuzey-kafe")).toBe("sahip+kuzey-kafe@ornek.com");
    expect(loginEmailAlias("sahip@ornek.com", "kuzey-kafe", 2)).toBe("sahip+kuzey-kafe-2@ornek.com");
    const long = loginEmailAlias(`${"a".repeat(50)}@ornek.com`, "cok-uzun-bir-menu-adresi-burada");
    expect(long.split("@")[0].length).toBeLessThanOrEqual(64);
    expect(long).toMatch(/^a{50}\+[a-z0-9-]*[a-z0-9]@ornek\.com$/);
  });
});

describe("yardımcılar", () => {
  it("üretilen şifre kurallara uyar ve karışan karakter içermez", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      expect(password).toHaveLength(12);
      expect(password).not.toMatch(/[0O1lI]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[2-9]/);
    }
  });
});
