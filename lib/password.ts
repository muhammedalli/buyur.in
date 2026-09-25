// Şifre kuralları — kayıt ve şifre sıfırlama ekranları ile ilgili API uçları
// aynı kontrolü kullanır. Saf modül: tarayıcıda da çalışır.

export const MIN_PASSWORD_LENGTH = 8;
/** PocketBase şifreyi bcrypt ile saklar; bcrypt 72 bayttan sonrasını yok sayar. */
export const MAX_PASSWORD_LENGTH = 71;

/** Yeni şifre geçerliyse null, değilse kullanıcıya gösterilecek hata. */
export function newPasswordError(password: unknown, confirm: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Şifre en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`;
  }
  if (password !== confirm) return "Şifreler eşleşmiyor.";
  return null;
}
