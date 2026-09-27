// Şifre kuralları — kayıt ve şifre sıfırlama ekranları ile ilgili API uçları
// aynı kontrolü kullanır. Saf modül: tarayıcıda da çalışır.

import { msg } from "@/lib/ui-i18n";

export const MIN_PASSWORD_LENGTH = 8;
/** PocketBase şifreyi bcrypt ile saklar; bcrypt 72 bayttan sonrasını yok sayar. */
export const MAX_PASSWORD_LENGTH = 71;

/** Şifre sorunu: çevrilebilir kaynak metin + yer tutucu değerleri. Panel bunu
 *  arayüz dilinde gösterir (t(message, vars)); API uçları doldurulmuş Türkçe
 *  metni döndürür (newPasswordError). */
export interface PasswordProblem {
  message: string;
  vars?: Record<string, number>;
}

export function passwordProblem(password: unknown, confirm: unknown): PasswordProblem | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return { message: msg("Şifre en az {min} karakter olmalı."), vars: { min: MIN_PASSWORD_LENGTH } };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { message: msg("Şifre en fazla {max} karakter olabilir."), vars: { max: MAX_PASSWORD_LENGTH } };
  }
  if (password !== confirm) return { message: msg("Şifreler eşleşmiyor.") };
  return null;
}

/** Yeni şifre geçerliyse null, değilse kullanıcıya gösterilecek hata (Türkçe). */
export function newPasswordError(password: unknown, confirm: unknown): string | null {
  const problem = passwordProblem(password, confirm);
  if (!problem) return null;
  return problem.message.replace(/\{(\w+)\}/g, (whole, key: string) => String(problem.vars?.[key] ?? whole));
}
