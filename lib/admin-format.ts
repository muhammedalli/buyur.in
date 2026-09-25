// Yönetim ekranlarında tarih gösterimi. Sunucu bileşeninde çalıştığı için
// saat dilimi sabittir: Vercel UTC'de çalışır, ekip İstanbul saatine bakar.

const DATE_TIME = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** PocketBase tarihi ("2026-09-25 10:00:00.000Z" ya da ISO). Okunamazsa boş. */
export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : DATE_TIME.format(date);
}

const DAY = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** Yalnızca gün (liste satırları için). Okunamazsa boş. */
export function formatAdminDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : DAY.format(date);
}

/** <input type="date"> için YYYY-MM-DD (İstanbul günü). */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date);
}
