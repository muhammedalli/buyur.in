import { describe, expect, it } from "vitest";
import {
  checkBusinessPhone,
  checkSignupPhone,
  formatTurkishPhone,
  isValidTurkishPhone,
  telHref,
  whatsappDigits,
} from "@/lib/phone";
import { whatsappUrl } from "@/lib/social";

// Telefon kuralları: kayıt ekranı ve /api/auth/register aynı fonksiyonu
// kullanır. Canlıdaki gerçek biçimler ("05357631908", "5376774625",
// "+90 212 555 24 68", "+1 (506) 973-7176") burada sabitlendi.

describe("Türkiye numarası", () => {
  it.each([
    ["05321234567", "+90 532 123 45 67"],
    ["5321234567", "+90 532 123 45 67"],
    ["0532 123 45 67", "+90 532 123 45 67"],
    ["+90 (532) 123-45-67", "+90 532 123 45 67"],
    ["905321234567", "+90 532 123 45 67"],
    ["00905321234567", "+90 532 123 45 67"],
    ["+90 212 555 24 68", "+90 212 555 24 68"],
    ["0850 123 45 67", "+90 850 123 45 67"],
  ])("%s → %s", (input, expected) => {
    expect(formatTurkishPhone(input)).toBe(expected);
    expect(isValidTurkishPhone(input)).toBe(true);
  });

  it.each(["", "123", "0532 123 45", "1234567890", "+1 (506) 973-7176", "0932 123 45 67", "abc"])(
    "%s geçersiz",
    (input) => {
      expect(isValidTurkishPhone(input)).toBe(false);
      expect(checkSignupPhone(input).ok).toBe(false);
    }
  );

  it("kayıt numarası zorunludur ve metin olmayan değer reddedilir", () => {
    expect(checkSignupPhone(undefined).ok).toBe(false);
    expect(checkSignupPhone(5321234567).ok).toBe(false);
  });
});

describe("işletme numarası", () => {
  it("boş bırakılabilir", () => {
    expect(checkBusinessPhone("  ")).toEqual({ ok: true, value: "" });
  });

  it("Türkiye numarası tek biçime getirilir", () => {
    expect(checkBusinessPhone("5376774625")).toEqual({ ok: true, value: "+90 537 677 46 25" });
  });

  it("+ ile yazılmış yabancı numara olduğu gibi kabul edilir", () => {
    expect(checkBusinessPhone("+1 (506) 973-7176")).toEqual({ ok: true, value: "+1 (506) 973-7176" });
  });

  it("numaraya benzemeyen metin reddedilir", () => {
    expect(checkBusinessPhone("ara bizi").ok).toBe(false);
  });
});

describe("bağlantılar", () => {
  it("ülke kodu yazılmamış Türkiye numarası wa.me'de 90 ile başlar", () => {
    expect(whatsappDigits("0532 123 45 67")).toBe("905321234567");
    expect(whatsappUrl("5321234567")).toBe("https://wa.me/905321234567");
    expect(whatsappUrl("")).toBe("");
  });

  it("tel: bağlantısı uluslararası biçimde kurulur", () => {
    expect(telHref("0532 123 45 67")).toBe("tel:+905321234567");
    expect(telHref("+1 (506) 973-7176")).toBe("tel:+15069737176");
  });
});
