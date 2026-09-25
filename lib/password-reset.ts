// Şifre sıfırlama bağlantısının saf kuralları (ağ ve PocketBase yok —
// tests/password-reset.test.ts sözleşme olarak sabitler).
//
// Bağlantı 256 bit rastgele bir belirteç taşır; veritabanında yalnızca sha256
// özeti durur (kayıt kodlarıyla aynı ilke: sızan tablo hesap açmaya yetmesin).
// Belirteç tek kullanımlıktır ve kısa ömürlüdür. Kayıt kodlarıyla aynı
// koleksiyonda (buyur_otps) tutulur; özete "password_reset:" öneki katıldığı
// için bir kayıt kodu hiçbir koşulda sıfırlama belirteci yerine geçemez.

import { createHash, randomBytes } from "node:crypto";

export const RESET_PURPOSE = "password_reset";
/** Bağlantının geçerlilik süresi. */
export const RESET_TTL_MINUTES = 60;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** 32 bayt → 43 karakter base64url. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isValidResetToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(`${RESET_PURPOSE}:${token}`).digest("hex");
}

export function resetExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + RESET_TTL_MINUTES * 60_000).toISOString();
}

/** Bağlantı tam adresle kurulur. Taban adres isteğin Host başlığından DEĞİL
 *  yapılandırmadan gelir: Host'a güvenmek, saldırganın kurbana kendi alan
 *  adını taşıyan bir sıfırlama e-postası göndertmesine yol açar. */
export function resetUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/panel/reset-password?token=${encodeURIComponent(token)}`;
}
