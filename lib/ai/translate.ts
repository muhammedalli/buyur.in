// AI ile çoklu dil içerik üretiminin SÖZLEŞMESİ.
//
// Çeviri YALNIZCA metin alanlarına dokunur. Fiyat, sayı, para birimi, alerjen
// kodu ve doğrulanması gereken hiçbir veri bu yoldan geçmez — modele zaten
// gönderilmez, dolayısıyla değiştiremez. Model çıktısı da buradaki birleştirme
// katmanından geçmeden kayda yazılmaz: istenmeyen dil, tanınmayan alan ve boş
// çeviri elenir.

import { SUPPORTED_LOCALES, type Locale, type TranslatableField, type Translations } from "@/lib/i18n";

/** Modele gönderilen tek bir çevrilebilir varlık. Yalnızca metin taşır. */
export interface TranslationEntry {
  /** Varlığı geri eşleştirmek için anahtar (kategori/ürün/seçenek kimliği). */
  id: string;
  /** Kullanıcıya bağlamı anlatan tür etiketi — çeviri kalitesini artırır. */
  kind: TranslationKind;
  /** Ana dildeki metinler. Boş alanlar gönderilmez. */
  fields: Partial<Record<TranslatableField, string>>;
}

/** Çevrilen içeriğin türü. İşletme açıklaması da çevrilebilir bir metindir. */
export type TranslationKind = "category" | "product" | "option" | "popup" | "business";

const TRANSLATION_KINDS: readonly TranslationKind[] = ["category", "product", "option", "popup", "business"];

/** Çevrilebilir alanların tamamı; bunun dışındaki hiçbir anahtar kabul edilmez. */
const TRANSLATABLE_FIELDS: TranslatableField[] = [
  "name",
  "description",
  "campaign_label",
  "group_name",
  "title",
  "message",
];

export const MAX_ENTRIES_PER_REQUEST = 120;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Modelin döndürdüğü dil anahtarını sistemin koduna indirger: "EN", "en-US",
 *  "en_GB" → "en". Tanınmayan anahtar null döner. Böyle bir sapma sessizce
 *  elenirse kullanıcı "dolduruldu" yerine anlamsız bir "üretilemedi" görürdü. */
export function normalizeLocaleKey(raw: string): Locale | null {
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : null;
}

/** İstenen hedef dilleri süzer: desteklenmeyenler ve ana dil elenir.
 *  Ana dil hedefe girerse model ana metni "çevirip" bozabilir. */
export function resolveTargetLocales(requested: unknown, mainLocale: Locale, activeLocales: Locale[]): Locale[] {
  const active = new Set(activeLocales.filter(isLocale));
  const candidates = Array.isArray(requested) ? requested.filter(isLocale) : [...active];
  return [...new Set(candidates)].filter((locale) => locale !== mainLocale && active.has(locale));
}

/** Gönderilecek girdiyi temizler: boş metinler ve tanınmayan alanlar atılır,
 *  hiç metni kalmayan varlık listeye girmez. */
export function sanitizeEntries(entries: unknown): TranslationEntry[] {
  if (!Array.isArray(entries)) return [];
  const result: TranslationEntry[] = [];

  for (const raw of entries.slice(0, MAX_ENTRIES_PER_REQUEST)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (id === "") continue;

    const kind = TRANSLATION_KINDS.includes(entry.kind as TranslationKind) ? (entry.kind as TranslationKind) : "product";

    const source = (entry.fields ?? {}) as Record<string, unknown>;
    const fields: Partial<Record<TranslatableField, string>> = {};
    for (const field of TRANSLATABLE_FIELDS) {
      const value = source[field];
      if (typeof value === "string" && value.trim() !== "") {
        fields[field] = value.trim();
      }
    }

    if (Object.keys(fields).length === 0) continue;
    result.push({ id, kind, fields });
  }

  return result;
}

/** Model çıktısındaki öğe listesini bulur. Beklenen biçim `{ items: [...] }`;
 *  modelin ara sıra yaptığı biçim sapmaları da kabul edilir (çıplak dizi, tek
 *  öğenin doğrudan `{ id, translations }` olarak dönmesi): içerik doğruyken
 *  kullanıcıya "çeviri üretilemedi" denmesin. Kimlik kuralı gevşemez. */
function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (record.translations && typeof record.translations === "object") return [record];
  return [];
}

const FIELD_BY_LOWER = new Map(TRANSLATABLE_FIELDS.map((field) => [field.toLowerCase(), field]));

/** Model çıktısını `id → Translations` haritasına indirger.
 *  İstenmeyen dil, tanınmayan alan, boş ya da metin olmayan değer elenir.
 *  Dil ve alan adları büyük/küçük harf duyarsız okunur ("EN", "Name"). */
export function normalizeTranslationResult(
  raw: unknown,
  targetLocales: Locale[],
  allowedIds: Set<string>
): Map<string, Translations> {
  const allowedLocales = new Set(targetLocales);
  const output = new Map<string, Translations>();

  for (const entry of extractItems(raw)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;

    // Kimlik gönderilenlerden biri olmalı: model uydurduysa çeviri yanlış
    // kayda yazılabilirdi.
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!allowedIds.has(id)) continue;

    const incoming = item.translations;
    if (!incoming || typeof incoming !== "object") continue;

    const translations: Translations = { ...(output.get(id) ?? {}) };
    for (const [rawLocale, value] of Object.entries(incoming as Record<string, unknown>)) {
      const localeKey = normalizeLocaleKey(rawLocale);
      if (!localeKey || !allowedLocales.has(localeKey)) continue;
      if (!value || typeof value !== "object") continue;

      const fields: Partial<Record<TranslatableField, string>> = {};
      for (const [rawField, text] of Object.entries(value as Record<string, unknown>)) {
        const field = FIELD_BY_LOWER.get(rawField.trim().toLowerCase());
        if (field && typeof text === "string" && text.trim() !== "") fields[field] = text.trim();
      }
      if (Object.keys(fields).length > 0) translations[localeKey] = { ...(translations[localeKey] ?? {}), ...fields };
    }

    if (Object.keys(translations).length > 0) output.set(id, translations);
  }

  return output;
}

/** İstenen dillerden hiçbir çevirisi dönmeyenler — kullanıcıya "şu dil
 *  üretilemedi" diye açıkça söylenir, sessizce eksik kalmaz. */
export function missingLocales(result: Map<string, Translations>, targetLocales: Locale[]): Locale[] {
  const produced = new Set<string>();
  for (const translations of result.values()) {
    for (const [locale, fields] of Object.entries(translations)) {
      if (fields && Object.keys(fields).length > 0) produced.add(locale);
    }
  }
  return targetLocales.filter((locale) => !produced.has(locale));
}

function isBlank(value: string | undefined): boolean {
  return (value ?? "").trim() === "";
}

/** "Tamamla" için eksikler: ana dilde metni olup hedef dilde boş kalan
 *  alanlar, dil dil. Dolu çeviri buraya girmez — elle yazılmış ya da daha önce
 *  onaylanmış bir çeviri yeniden üretilip ezilmesin. */
export function missingTranslations(
  source: Partial<Record<TranslatableField, string>>,
  translations: Translations | undefined,
  targetLocales: Locale[]
): Partial<Record<Locale, TranslatableField[]>> {
  const filled = (Object.keys(source) as TranslatableField[]).filter((field) => !isBlank(source[field]));
  const result: Partial<Record<Locale, TranslatableField[]>> = {};
  for (const locale of targetLocales) {
    const fields = filled.filter((field) => isBlank(translations?.[locale]?.[field]));
    if (fields.length > 0) result[locale] = fields;
  }
  return result;
}

/** Üretilen çeviriyi YALNIZCA boş alanlara yazar; dolu alana dokunmaz.
 *  `applied` gerçekten yazılanlardır — kullanıcıya söylenen özet bundan
 *  kurulur ki "dolduruldu" denip alanın boş kaldığı bir durum olmasın. */
export function fillMissingTranslations(
  existing: Translations | undefined,
  incoming: Translations
): { merged: Translations; applied: Translations } {
  const merged: Translations = { ...(existing ?? {}) };
  const applied: Translations = {};
  for (const [locale, fields] of Object.entries(incoming)) {
    if (!isLocale(locale) || !fields) continue;
    const bucket = { ...(merged[locale] ?? {}) };
    for (const [field, text] of Object.entries(fields) as [TranslatableField, string | undefined][]) {
      if (isBlank(text) || !isBlank(bucket[field])) continue;
      bucket[field] = text;
      applied[locale] = { ...(applied[locale] ?? {}), [field]: text };
    }
    if (applied[locale] || merged[locale]) merged[locale] = bucket;
  }
  return { merged, applied };
}

/** Modele verilen görev tanımı. Sayısal veriye dokunmama talimatı buranın
 *  en kritik cümlesidir. */
export function buildTranslationPrompt(targetLocales: Locale[], localeNames: Record<Locale, string>): string {
  const targets = targetLocales.map((locale) => `"${locale}" (${localeNames[locale]})`).join(", ");
  return `Sen bir restoran menüsü çevirmenisin. Sana verilen menü içeriklerini şu dillere çevireceksin: ${targets}.

KURALLAR:
1. YALNIZCA metin çevir. Sayı, fiyat, para birimi, ölçü ve kalori değerlerine dokunma — zaten sana gönderilmiyor.
2. Yemek adlarında yerel mutfak terimlerini koru. "Adana Kebap" gibi özel adlar çevrilmez, gerekiyorsa parantez içinde kısa açıklama eklenebilir.
3. Marka adlarını, özel isimleri ve ölçü birimlerini olduğu gibi bırak.
4. Menü diline uygun, kısa ve iştah açıcı yaz. Birebir sözlük çevirisi yapma.
5. Bir metni çeviremiyorsan o alanı sonuçtan tamamen çıkar — uydurma.
6. Gönderilen her öğenin "id" değerini yanıtta AYNEN koru.

Yanıtı MUTLAKA şu JSON şemasında ver:
{
  "items": [
    { "id": "<gönderilen id>", "translations": { ${targetLocales.map((l) => `"${l}": { "name": "string", "description": "string" }`).join(", ")} } }
  ]
}`;
}
