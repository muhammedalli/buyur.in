import { whatsappDigits } from "@/lib/phone";

// İşletme sahibi kullanıcı adı ("alphacafe") ya da tam URL yapıştırabilir;
// panelde ne yazıldıysa o saklanır, link sadece görüntülenirken kurulur.
function toUrl(base: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${base}${trimmed.replace(/^@/, "")}`;
}

export function instagramUrl(value: string): string {
  return toUrl("https://instagram.com/", value);
}

export function tiktokUrl(value: string): string {
  return toUrl("https://tiktok.com/@", value.replace(/^@/, ""));
}

export function youtubeUrl(value: string): string {
  return toUrl("https://youtube.com/", value);
}

export function facebookUrl(value: string): string {
  return toUrl("https://facebook.com/", value);
}

export function whatsappUrl(value: string): string {
  // "0532…" ya da "532…" diye yazılmış Türkiye numarasına 90 eklenir; aksi
  // hâlde wa.me numarayı bulamıyor ve bağlantı çalışmıyordu.
  const digits = whatsappDigits(value);
  return digits ? `https://wa.me/${digits}` : "";
}
