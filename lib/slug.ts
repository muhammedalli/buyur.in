const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

// NFD ayrıştırmasından sonra kalan birleşen aksan işaretlerini (Unicode
// Combining Diacritical Marks bloğu, U+0300–U+036F) kod noktasına göre eler.
const COMBINING_MARK_START = 0x0300;
const COMBINING_MARK_END = 0x036f;

function stripDiacritics(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_MARK_START || code > COMBINING_MARK_END;
    })
    .join("");
}

export const RESERVED_SLUGS = new Set([
  "www",
  "panel",
  "admin",
  "api",
  "app",
  "mail",
  "smtp",
  "cdn",
  "static",
  "assets",
  "blog",
  "destek",
  "support",
  "help",
  "docs",
  "status",
  "yasal",
  "legal",
  // Pazarlama sitesinin dil kökleri (buyur.in/en) — bir işletme bu adı alırsa
  // kök alan yolundaki menüsü sitenin İngilizce sayfasıyla çakışırdı.
  "en",
  "tr",
  // İşletme vitrininin ve menünün sabit yolları.
  "site",
  "menu",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function slugify(input: string): string {
  const mapped = input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("");

  return stripDiacritics(mapped.toLowerCase().normalize("NFD"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
