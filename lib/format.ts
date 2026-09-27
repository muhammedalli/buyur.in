const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return `${currencyFormatter.format(value)}₺`;
}

/** Kayıt zamanı: bugünse "14:32", değilse "12 Eyl 14:32". `tag` arayüz
 *  dilinin BCP 47 etiketi (panel İngilizceyse "en-US"). */
export function formatSavedTime(value: number | string, tag = "tr-TR"): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  if (sameDay) return time;
  return `${date.toLocaleDateString(tag, { day: "numeric", month: "short" })} ${time}`;
}
