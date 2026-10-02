// Ürünün menü dışı ayrıntıları (alerjen, rozet, kalori, hazırlanma süresi)
// için AI katmanının ortak sözlüğü. Saf modül; menü asistanı ve kaynak
// çıkarma bunu kullanır (tests/ai-menu-assistant.test.ts).
//
// Bu alanlar sağlık ve beklenti taşır: kaynakta yazan değer "kaynaktan",
// modelin önerdiği değer "öneri" sayılır ve önizlemede ayrıca işaretlenir.
// Model değerleri serbest metinle de verebilir ("Süt", "10-15 dk"); burada
// şemadaki sabit anahtarlara çevrilir, tanınmayan değer atılır.

import { normalizeEntryName } from "@/lib/ai/import-plan";
import { allergenLabels, badgeLabels } from "@/lib/labels";
import type { Allergen, Badge } from "@/lib/types";

export type DetailField = "allergens" | "badges" | "calories" | "prep_time";
export const DETAIL_FIELDS: DetailField[] = ["allergens", "badges", "calories", "prep_time"];

export interface ProductDetails {
  allergens: Allergen[];
  badges: Badge[];
  /** Bilinmiyorsa null (0 "kalorisiz" demek değil). */
  calories: number | null;
  prep_time_min: number | null;
  prep_time_max: number | null;
}

export const ALLERGENS = Object.keys(allergenLabels.tr) as Allergen[];
export const BADGES = Object.keys(badgeLabels.tr) as Badge[];
/** Akla yatkın üst sınırlar: bunun üstü yanlış okunmuş bir sayıdır. */
export const MAX_CALORIES = 5000;
export const MAX_PREP_MINUTES = 240;

// Menülerde alerjen ve rozetler çoğu zaman şemadaki adla değil gündelik
// karşılığıyla yazılır ("süt", "ceviz", "acılı"). Eşleşme bu terimlerle yapılır.
const ALLERGEN_TERMS: Record<Allergen, string[]> = {
  gluten: ["gluten", "buğday", "un", "arpa", "çavdar"],
  laktoz: ["laktoz", "süt", "süt ürünü", "süt ürünleri", "peynir", "tereyağı", "krema", "yoğurt"],
  yumurta: ["yumurta"],
  findik_fistik: ["fındık", "fıstık", "fındık fıstık", "ceviz", "badem", "kaju", "antep fıstığı", "kuruyemiş", "sert kabuklu yemiş"],
  yer_fistigi: ["yer fıstığı", "yerfıstığı"],
  soya: ["soya"],
  balik: ["balık", "hamsi", "somon", "levrek", "çipura", "alabalık"],
  kabuklu_deniz_urunu: ["kabuklu deniz ürünü", "karides", "midye", "kalamar", "ahtapot", "yengeç", "istakoz"],
  susam: ["susam", "tahin"],
  hardal: ["hardal"],
  kereviz: ["kereviz"],
  sulfit: ["sülfit", "sülfür dioksit"],
};

const BADGE_TERMS: Record<Badge, string[]> = {
  yeni: ["yeni"],
  sefin_onerisi: ["şefin önerisi", "şef önerisi", "şefin tavsiyesi"],
  populer: ["popüler", "en çok satan", "çok satan"],
  vejetaryen: ["vejetaryen", "vejeteryan"],
  vegan: ["vegan"],
  aci: ["acı", "acılı"],
  glutensiz: ["glutensiz", "gluten free", "gluten içermez"],
};

function termsOf<T extends string>(key: T, labels: Record<T, string>, extra: Record<T, string[]>): string[] {
  return [key.replace(/_/g, " "), labels[key], ...extra[key]].map(normalizeEntryName).filter(Boolean);
}

function matchKeys<T extends string>(value: unknown, keys: T[], labels: Record<T, string>, extra: Record<T, string[]>): T[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;/]+/) : [];
  const found: T[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const normalized = normalizeEntryName(entry);
    if (!normalized) continue;
    const key = keys.find((candidate) => termsOf(candidate, labels, extra).includes(normalized));
    if (key && !found.includes(key)) found.push(key);
  }
  return found;
}

function readInt(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^\d.,]/g, "").replace(",", ".")) : NaN;
  if (!Number.isFinite(number) || number <= 0 || number > max) return null;
  return Math.round(number);
}

export function emptyDetails(): ProductDetails {
  return { allergens: [], badges: [], calories: null, prep_time_min: null, prep_time_max: null };
}

/** Serbest girdiyi ayrıntılara çevirir. `prep_time` "10-15" gibi aralık
 *  metni olarak da gelebilir; tek değer verilmişse alt ve üst aynı olur. */
export function normalizeDetails(raw: unknown): ProductDetails {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let min = readInt(value.prep_time_min, MAX_PREP_MINUTES);
  let max = readInt(value.prep_time_max, MAX_PREP_MINUTES);
  if (min === null && max === null && value.prep_time !== undefined) {
    const parts = String(value.prep_time).match(/\d+/g) ?? [];
    min = readInt(parts[0], MAX_PREP_MINUTES);
    max = readInt(parts[1] ?? parts[0], MAX_PREP_MINUTES);
  }
  if (min === null && max !== null) min = max;
  if (max === null && min !== null) max = min;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    allergens: matchKeys(value.allergens, ALLERGENS, allergenLabels.tr, ALLERGEN_TERMS),
    badges: matchKeys(value.badges, BADGES, badgeLabels.tr, BADGE_TERMS),
    calories: readInt(value.calories, MAX_CALORIES),
    prep_time_min: min,
    prep_time_max: max,
  };
}

/** Girdide hangi ayrıntı alanlarının AÇIKÇA verildiği (kısmi güncelleme için). */
export function providedDetailFields(raw: unknown): DetailField[] {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(value, key);
  return DETAIL_FIELDS.filter((field) =>
    field === "prep_time" ? has("prep_time") || has("prep_time_min") || has("prep_time_max") : has(field)
  );
}

export function hasDetail(details: ProductDetails, field: DetailField): boolean {
  switch (field) {
    case "allergens":
      return details.allergens.length > 0;
    case "badges":
      return details.badges.length > 0;
    case "calories":
      return details.calories !== null;
    case "prep_time":
      return details.prep_time_min !== null;
  }
}

/** Ayrıntıların yalnızca verilen alanlarını kopyalar. */
export function pickDetails(details: ProductDetails, fields: DetailField[]): Partial<ProductDetails> {
  const patch: Partial<ProductDetails> = {};
  if (fields.includes("allergens")) patch.allergens = details.allergens;
  if (fields.includes("badges")) patch.badges = details.badges;
  if (fields.includes("calories")) patch.calories = details.calories;
  if (fields.includes("prep_time")) {
    patch.prep_time_min = details.prep_time_min;
    patch.prep_time_max = details.prep_time_max;
  }
  return patch;
}

/** Ayrıntılardan kaynak metninde DAYANAĞI olmayanları atar: kalori ve süre
 *  sayısı metinde geçmeli, alerjen/rozetin terimlerinden biri metinde geçmeli.
 *  Kaynaktan çıkarma sırasında modelin "bilgi" diye eklediği tahmin böyle
 *  elenir. `numbers` kaynakta geçen sayılardır. */
export function groundDetails(details: ProductDetails, normalizedSource: string, numbers: Set<number>): ProductDetails {
  const padded = ` ${normalizedSource} `;
  const mentioned = (terms: string[]) => terms.some((term) => padded.includes(` ${term} `));
  const prepOk = details.prep_time_min !== null && numbers.has(details.prep_time_min) && numbers.has(details.prep_time_max ?? details.prep_time_min);
  return {
    allergens: details.allergens.filter((key) => mentioned(termsOf(key, allergenLabels.tr, ALLERGEN_TERMS))),
    badges: details.badges.filter((key) => mentioned(termsOf(key, badgeLabels.tr, BADGE_TERMS))),
    calories: details.calories !== null && numbers.has(details.calories) ? details.calories : null,
    prep_time_min: prepOk ? details.prep_time_min : null,
    prep_time_max: prepOk ? details.prep_time_max : null,
  };
}

/** Modele gösterilecek kısa özet ("alerjen: gluten, laktoz · 350 kcal · 10-15 dk"). */
export function detailsSummary(details: ProductDetails): string {
  const parts: string[] = [];
  if (details.allergens.length) parts.push(`alerjen: ${details.allergens.join(", ")}`);
  if (details.badges.length) parts.push(`rozet: ${details.badges.join(", ")}`);
  if (details.calories !== null) parts.push(`${details.calories} kcal`);
  if (details.prep_time_min !== null) {
    parts.push(details.prep_time_min === details.prep_time_max ? `${details.prep_time_min} dk` : `${details.prep_time_min}-${details.prep_time_max} dk`);
  }
  return parts.join(" · ");
}
