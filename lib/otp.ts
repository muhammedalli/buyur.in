// Kayıt doğrulama kodlarının (OTP) saf kuralları. Ağ ve PocketBase burada yok —
// böylece süre, deneme hakkı ve karşılaştırma mantığı tests/otp.test.ts ile
// sözleşme olarak sabitlenebiliyor.
//
// Kod veritabanında düz metin tutulmaz: sızan bir OTP tablosu, o an kayıt olan
// herkesin hesabını açmaya yeter. Bu yüzden yalnızca sha256 özeti saklanır.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  isValidEmail,
  normalizeEmail,
} from "@/lib/otp-client";

// Sabitler ve e-posta biçimi kayıt ekranıyla ortak — tek kaynak lib/otp-client.ts.
export { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_MINUTES, isValidEmail, normalizeEmail };

const CODE_RE = /^\d{6}$/;

export function isValidOtpCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value.trim());
}

/** 6 haneli kod. Math.random yerine crypto: tahmin edilebilir kod, kod olmamak
 *  demektir. Baştaki sıfırlar korunur (ör. "004213"). */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Özete e-posta da katılır: aynı kod başka bir adres için kullanılamasın. */
export function hashOtpCode(email: string, code: string): string {
  return createHash("sha256").update(`${normalizeEmail(email)}:${code.trim()}`).digest("hex");
}

/** Sabit zamanlı karşılaştırma — özetler eşit uzunlukta olmalı. */
export function matchesOtpHash(stored: string, candidate: string): boolean {
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function otpExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + OTP_TTL_MINUTES * 60_000).toISOString();
}

/** PocketBase tarihleri "2026-09-18 10:00:00.000Z" biçiminde döner; ISO da
 *  gelebilir. İkisini de kabul ediyoruz. Okunamayan tarih süresi dolmuş sayılır —
 *  belirsiz bir kodu geçerli saymaktansa kullanıcıdan yenisini istemek yeğdir. */
export function parsePbDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isOtpExpired(expiresAt: unknown, now: Date = new Date()): boolean {
  const date = parsePbDate(expiresAt);
  if (!date) return true;
  return date.getTime() <= now.getTime();
}

/** Yeniden gönderim hakkı doldu mu? `createdAt` okunamazsa gönderime izin
 *  verilir — altyapı hatası kullanıcıyı kayıt akışının dışında bırakmamalı. */
export function canResendOtp(createdAt: unknown, now: Date = new Date()): boolean {
  const date = parsePbDate(createdAt);
  if (!date) return true;
  return now.getTime() - date.getTime() >= OTP_RESEND_SECONDS * 1000;
}
