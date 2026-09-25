import { describe, expect, it } from "vitest";
import type PocketBase from "pocketbase";
import {
  RESET_TTL_MINUTES,
  generateResetToken,
  hashResetToken,
  isValidResetToken,
  resetExpiresAt,
  resetUrl,
} from "@/lib/password-reset";
import { hashOtpCode, isOtpExpired } from "@/lib/otp";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, newPasswordError } from "@/lib/password";
import { clearOtpRecords, findOtpRecord, findResetRecord, type OtpRecord } from "@/lib/otp-store";

// Şifremi unuttum akışının sözleşmesi: belirteç, süre, şifre kuralları ve
// kayıt kodlarıyla aynı koleksiyonu paylaşırken birbirine dokunmama.

describe("sıfırlama belirteci", () => {
  it("her seferinde farklı, 43 karakter base64url", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
    expect(isValidResetToken(a)).toBe(true);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("biçimi bozuk belirteç reddedilir", () => {
    for (const value of ["", "kısa", "a".repeat(44), "a".repeat(42) + "!", 42, null]) {
      expect(isValidResetToken(value)).toBe(false);
    }
  });

  it("yalnızca özet saklanır ve kayıt kodunun özetiyle çakışamaz", () => {
    const token = generateResetToken();
    const hash = hashResetToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    // Kayıt kodu özeti e-postayla tuzlanır; sıfırlama özeti amaç önekiyle.
    expect(hash).not.toBe(hashOtpCode("a@b.co", token));
  });

  it(`${RESET_TTL_MINUTES} dakika sonra süresi dolar`, () => {
    const from = new Date("2026-09-24T10:00:00Z");
    const expires = resetExpiresAt(from);
    expect(isOtpExpired(expires, new Date(from.getTime() + (RESET_TTL_MINUTES - 1) * 60_000))).toBe(false);
    expect(isOtpExpired(expires, new Date(from.getTime() + RESET_TTL_MINUTES * 60_000))).toBe(true);
  });

  it("bağlantı yapılandırılmış siteye kurulur, belirteç kodlanır", () => {
    expect(resetUrl("https://buyur.in/", "abc_-")).toBe("https://buyur.in/panel/reset-password?token=abc_-");
  });
});

describe("yeni şifre kuralları", () => {
  it("kısa, çok uzun ve eşleşmeyen şifre reddedilir", () => {
    expect(newPasswordError("a".repeat(MIN_PASSWORD_LENGTH - 1), "a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/en az/);
    expect(newPasswordError("a".repeat(MAX_PASSWORD_LENGTH + 1), "a".repeat(MAX_PASSWORD_LENGTH + 1))).toMatch(/en fazla/);
    expect(newPasswordError("gizli-sifre-1", "gizli-sifre-2")).toBe("Şifreler eşleşmiyor.");
    expect(newPasswordError(undefined, undefined)).not.toBeNull();
  });

  it("geçerli şifre kabul edilir", () => {
    expect(newPasswordError("gizli-sifre-1", "gizli-sifre-1")).toBeNull();
  });
});

/** buyur_otps için bellek içi sahte istemci — yalnızca kullanılan çağrılar. */
function fakePb(records: OtpRecord[]) {
  const store = [...records];
  const pb = {
    filter: (expr: string, params: Record<string, string>) => ({ expr, params }),
    collection: () => ({
      getFullList: async ({ filter }: { filter: { params: { email: string } } }) =>
        store
          .filter((record) => record.email === filter.params.email)
          .sort((a, b) => b.created.localeCompare(a.created)),
      getFirstListItem: async (filter: { params: { hash: string } }) => {
        const found = store.find((record) => record.code_hash === filter.params.hash);
        if (!found) throw Object.assign(new Error("yok"), { status: 404 });
        return found;
      },
      delete: async (id: string) => {
        store.splice(
          store.findIndex((record) => record.id === id),
          1
        );
      },
    }),
  };
  return { pb: pb as unknown as PocketBase, store };
}

const record = (overrides: Partial<OtpRecord>): OtpRecord => ({
  id: Math.random().toString(36).slice(2),
  email: "sahip@kafe.com",
  code_hash: "x",
  expires_at: "2999-01-01 00:00:00.000Z",
  attempts: 0,
  created: "2026-09-24 10:00:00.000Z",
  ...overrides,
});

describe("kayıt kodu ile sıfırlama kaydı ayrımı", () => {
  it("kayıt akışı sıfırlama kaydını görmez ve silemez", async () => {
    const reset = record({ purpose: "password_reset", code_hash: "reset" });
    const { pb, store } = fakePb([reset]);

    expect(await findOtpRecord(pb, "sahip@kafe.com")).toBeNull();
    await clearOtpRecords(pb, "sahip@kafe.com");
    expect(store).toContain(reset);
  });

  it("amacı olmayan eski kayıtlar kayıt kodu sayılır", async () => {
    const legacy = record({ code_hash: "eski" });
    const { pb } = fakePb([legacy]);
    expect(await findOtpRecord(pb, "sahip@kafe.com")).toEqual(legacy);
    expect(await findOtpRecord(pb, "sahip@kafe.com", "password_reset")).toBeNull();
  });

  it("sıfırlama belirteci, açıkça kayıt amaçlı bir kaydı açamaz", async () => {
    const { pb } = fakePb([record({ purpose: "register", code_hash: "ortak" })]);
    expect(await findResetRecord(pb, "ortak")).toBeNull();
  });

  it("sıfırlama temizliği yalnızca sıfırlama kayıtlarını siler", async () => {
    const register = record({ purpose: "register", code_hash: "kod" });
    const reset = record({ purpose: "password_reset", code_hash: "reset" });
    const { pb, store } = fakePb([register, reset]);
    await clearOtpRecords(pb, "sahip@kafe.com", "password_reset");
    expect(store).toEqual([register]);
  });
});
