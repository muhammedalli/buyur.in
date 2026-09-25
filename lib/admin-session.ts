// Admin oturum çerezinin saf kuralları (ağ ve Next yok; sözleşmesi
// tests/admin-session.test.ts).
//
// Neden PocketBase token'ı doğrudan tarayıcıya verilmiyor: ADMIN_BYPASS kuralı
// rol ayırmaz. Token'ı eline alan bir destek hesabı PocketBase'e doğrudan
// giderek plan ve sayaç alanlarını yazabilirdi. Token bu yüzden AES-GCM ile
// şifrelenip httpOnly çerezde durur; tarayıcı onu okuyamaz, yalnızca sunucu
// açar ve yetki matrisini (lib/admin-roles.ts) uygular.
//
// Neden kendi imzalı kimliğimiz değil de PocketBase token'ı: token her
// istekte authRefresh ile doğrulanır. Şifre değişince ya da hesap silinince
// oturum kendiliğinden düşer; rol değişikliği bir sonraki istekte geçerli olur.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { OTP_TTL_MINUTES } from "@/lib/otp-client";

/** Tam oturum ile "şifre doğru, kod bekleniyor" ara durumu ayrı anahtar
 *  bağlamıyla şifrelenir: ara çerez içinde de geçerli bir token taşıdığı
 *  için oturum çerezi yerine kullanılabilseydi e-posta kodu atlanmış olurdu. */
export type AdminCookieKind = "session" | "pending";

export interface AdminCookiePayload {
  /** Admin'in PocketBase auth token'ı. */
  token: string;
  email: string;
  /** Bitiş zamanı (ms). */
  exp: number;
}

/** Bir iş günü: uzun süre açık kalan admin oturumu, unutulmuş bir dizüstünde
 *  bütün platformun anahtarıdır. */
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const ADMIN_PENDING_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;

const MIN_SECRET_LENGTH = 32;

/** Sır tanımlı değilse ya da kısaysa null: admin girişi kapalı kalır. Burada
 *  "serbestlik" varsayılmaz; yapılandırılmamış bir sırla açık kalan panel,
 *  herkesin tahmin edebileceği bir anahtarla kilitlenmiş demektir. */
export function readSessionSecret(value: string | undefined = process.env.ADMIN_SESSION_SECRET): string | null {
  const secret = value?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

function keyFor(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function aadFor(kind: AdminCookieKind): Buffer {
  return Buffer.from(`buyur-admin:${kind}`, "utf8");
}

export function sealAdminCookie(kind: AdminCookieKind, payload: AdminCookiePayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  cipher.setAAD(aadFor(kind));
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv, body, cipher.getAuthTag()].map((part) => part.toString("base64url")).join(".");
}

/** Bozuk, süresi dolmuş, başka türde ya da başka sırla şifrelenmiş çerez
 *  null döner; nedeni ayırt edilmez, çağıran için hepsi "oturum yok"tur. */
export function openAdminCookie(
  kind: AdminCookieKind,
  value: string | undefined | null,
  secret: string,
  now: number = Date.now()
): AdminCookiePayload | null {
  if (typeof value !== "string" || value === "") return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, body, tag] = parts.map((part) => Buffer.from(part, "base64url"));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv);
    decipher.setAAD(aadFor(kind));
    decipher.setAuthTag(tag);
    const data = JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
    if (typeof data?.token !== "string" || data.token === "") return null;
    if (typeof data.email !== "string" || typeof data.exp !== "number") return null;
    if (data.exp <= now) return null;
    return { token: data.token, email: data.email, exp: data.exp };
  } catch {
    return null;
  }
}

/** Durum değiştiren admin isteği başka bir siteden gelmemeli. Çerez zaten
 *  SameSite=Lax; bu ikinci kilit. Origin başlığı yoksa (tarayıcı dışı istemci)
 *  geçer: onun elinde zaten çerez olmaz. */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
