import { tField, type Locale } from "@/lib/i18n";
import type { Business } from "@/lib/types";

// İşletmenin kayan yazısı ("✦ Taze ürünler ✦ Günün favorileri ✦ …").
//
// Veri: `marquee_enabled` + `marquee_text` (her satır bir mesaj, ana dilde);
// diğer diller `translations[dil].marquee_text` kutusunda. Menü, işletme sitesi
// ve karşılama sayfası aynı yardımcıdan okur — üç yüzde aynı mesajlar görünür.

/** Ekrana sığacak ve okunur kalacak üst sınırlar. Panelde de bu sınırlar söylenir. */
export const MARQUEE_MAX_ITEMS = 8;
export const MARQUEE_MAX_ITEM_LENGTH = 80;

/** Serbest metni mesaj listesine çevirir: satır satır, boşlar ve tekrarlar atılır. */
export function parseMarqueeText(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of (text ?? "").split(/\r?\n/)) {
    // Kullanıcı ayırıcıyı kendisi yazdıysa ("✦ Taze ürünler") çift ayırıcı çıkmasın.
    const line = raw.replace(/^[\s✦•·*\-–—|]+|[\s✦•·*\-–—|]+$/g, "").slice(0, MARQUEE_MAX_ITEM_LENGTH).trim();
    if (!line) continue;
    const key = line.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(line);
    if (items.length >= MARQUEE_MAX_ITEMS) break;
  }
  return items;
}

/** İşletmenin istenen dildeki kayan yazı mesajları; kapalıysa ya da boşsa []. */
export function businessMarqueeItems(
  business: Pick<Business, "marquee_enabled" | "marquee_text" | "translations">,
  locale: Locale,
  baseLocale: Locale
): string[] {
  if (!business.marquee_enabled) return [];
  return parseMarqueeText(tField(business, "marquee_text", locale, baseLocale));
}
