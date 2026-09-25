// Telefon numarası kuralları — kayıt ekranı, /api/auth/register, işletme
// kurulumu ve ayarlar aynı fonksiyonları kullanır; ön yüz ile sunucu
// doğrulaması ayrışamaz. Saf modül: tarayıcıda ve sunucuda çalışır.
//
// Türkiye numaraları tek biçimde saklanır ("+90 532 123 45 67"): kullanıcı
// "0532…", "532…", "90532…" ya da "+90 (532)…" yazsa da aynı numara aynı
// metin olur ve tel:/wa.me bağlantıları ülke kodu eksik diye kırılmaz.

/** Ülke kodu ve baştaki 0 olmadan 10 hane. İlk hane: 5 (mobil), 2–4 (sabit
 *  hat), 8 (850 gibi ulusal numaralar). */
const TR_NATIONAL_RE = /^[2-58]\d{9}$/;

/** Uluslararası numara: + ile başlar, 8–15 hane (E.164 üst sınırı). */
const INTERNATIONAL_RE = /^\+\d{8,15}$/;

/** Girilen metni 10 haneli Türkiye numarasına indirger; Türkiye numarası
 *  değilse null. */
export function turkishNationalNumber(value: string): string | null {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("0090")) digits = digits.slice(4);
  else if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  // "+" ile yazılmış başka bir ülke kodu Türkiye numarası sayılmaz.
  else if (trimmed.startsWith("+")) return null;

  return TR_NATIONAL_RE.test(digits) ? digits : null;
}

export function isValidTurkishPhone(value: unknown): value is string {
  return typeof value === "string" && turkishNationalNumber(value) !== null;
}

/** "+90 532 123 45 67" biçimi. Türkiye numarası değilse null. */
export function formatTurkishPhone(value: string): string | null {
  const national = turkishNationalNumber(value);
  if (!national) return null;
  return `+90 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}`;
}

export type PhoneCheck = { ok: true; value: string } | { ok: false; error: string };

export const PHONE_ERROR_TR = "Geçerli bir telefon numarası gir (ör. 0532 123 45 67).";

/** Hesap sahibinin kayıt numarası: Türkiye numarası zorunlu. */
export function checkSignupPhone(value: unknown): PhoneCheck {
  const formatted = typeof value === "string" ? formatTurkishPhone(value) : null;
  return formatted ? { ok: true, value: formatted } : { ok: false, error: PHONE_ERROR_TR };
}

/** İşletme iletişim numarası (menüde görünür). Boş bırakılabilir; Türkiye
 *  numarası tek biçime getirilir, turist bölgesindeki işletmeler için "+"
 *  ile yazılmış yabancı numara da kabul edilir. */
export function checkBusinessPhone(value: string): PhoneCheck {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };

  const turkish = formatTurkishPhone(trimmed);
  if (turkish) return { ok: true, value: turkish };

  const compact = trimmed.replace(/[\s().-]/g, "");
  if (INTERNATIONAL_RE.test(compact)) return { ok: true, value: trimmed };

  return { ok: false, error: "Geçerli bir telefon numarası gir (ör. 0532 123 45 67 ya da +44 20 7946 0958)." };
}

/** tel: bağlantısı için boşluksuz biçim. */
export function telHref(value: string): string {
  const national = turkishNationalNumber(value);
  if (national) return `tel:+90${national}`;
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

/** wa.me için yalnızca hane; ülke kodu eksik Türkiye numarasına 90 eklenir. */
export function whatsappDigits(value: string): string {
  const national = turkishNationalNumber(value);
  if (national) return `90${national}`;
  return value.replace(/\D/g, "");
}
