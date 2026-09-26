// AI ile çoklu dil içerik üretiminin SÖZLEŞMESİ.
//
// Çeviri YALNIZCA metin alanlarına dokunur. Fiyat, sayı, para birimi, alerjen
// kodu ve doğrulanması gereken hiçbir veri bu yoldan geçmez — modele zaten
// gönderilmez, dolayısıyla değiştiremez. Model çıktısı da buradaki birleştirme
// katmanından geçmeden kayda yazılmaz: istenmeyen dil, tanınmayan alan ve boş
// çeviri elenir.

import { activeLocales, SUPPORTED_LOCALES, type LangConfig, type Locale, type TranslatableField, type Translations } from "@/lib/i18n";

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
  const lowered = raw.trim().toLowerCase();
  const primary = lowered.split(/[-_]/)[0];
  if (isLocale(primary)) return primary;
  // Model zaman zaman kod yerine dilin adını anahtar yapıyor ("English",
  // "Arabic", "Русский"); bunlar da tanınır.
  return LOCALE_NAME_ALIASES[lowered] ?? null;
}

const LOCALE_NAME_ALIASES: Record<string, Locale> = {
  turkish: "tr",
  türkçe: "tr",
  turkce: "tr",
  english: "en",
  ingilizce: "en",
  "i̇ngilizce": "en",
  arabic: "ar",
  arapça: "ar",
  arapca: "ar",
  العربية: "ar",
  russian: "ru",
  rusça: "ru",
  rusca: "ru",
  русский: "ru",
};

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
 *  modelin ara sıra yaptığı biçim sapmaları da kabul edilir: içerik doğruyken
 *  kullanıcıya "çeviri üretilemedi" denmesin. Kimlik kuralı gevşemez.
 *   - çıplak dizi: `[{ id, translations }]`
 *   - tek öğe doğrudan: `{ id, translations }`
 *   - kimliğe göre sözlük: `{ "form": { "en": {...} } }`
 *   - farklı kök anahtar: `{ "results": [...] }` */
function extractItems(raw: unknown, allowedIds: Set<string>): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (record.translations && typeof record.translations === "object") return [record];

  const byId = Object.entries(record).filter(([key, value]) => allowedIds.has(key.trim()) && value && typeof value === "object");
  if (byId.length > 0) return byId.map(([id, value]) => ({ id: id.trim(), translations: unwrapTranslations(value) }));

  const arrays = Object.values(record).filter(Array.isArray);
  if (arrays.length === 1) return arrays[0] as unknown[];
  return [];
}

/** `{ translations: {...} }` sarmalı varsa içini, yoksa kendisini döner. */
function unwrapTranslations(value: unknown): unknown {
  const record = value as Record<string, unknown>;
  return record.translations && typeof record.translations === "object" ? record.translations : value;
}

/** Öğenin dil sözlüğünü bulur. `translations` sarmalı yoksa dil anahtarları
 *  öğenin kökünde olabilir: `{ id, en: {...}, ar: {...} }`. Değer dizi
 *  biçiminde de gelebilir: `[{ locale: "en", name: "..." }]`. */
function itemTranslations(item: Record<string, unknown>): Record<string, unknown> | null {
  const incoming = item.translations;
  if (Array.isArray(incoming)) {
    const byLocale: Record<string, unknown> = {};
    for (const row of incoming) {
      if (!row || typeof row !== "object") continue;
      const { locale, language, lang, ...fields } = row as Record<string, unknown>;
      const key = [locale, language, lang].find((value) => typeof value === "string");
      if (typeof key === "string") byLocale[key] = fields;
    }
    return byLocale;
  }
  if (incoming && typeof incoming === "object") return incoming as Record<string, unknown>;

  const rootLocales = Object.fromEntries(
    Object.entries(item).filter(([key, value]) => key !== "id" && normalizeLocaleKey(key) && value && typeof value === "object")
  );
  return Object.keys(rootLocales).length > 0 ? rootLocales : null;
}

const FIELD_BY_LOWER = new Map(TRANSLATABLE_FIELDS.map((field) => [field.toLowerCase(), field]));

/** Model çıktısını `id → Translations` haritasına indirger.
 *  İstenmeyen dil, tanınmayan alan, boş ya da metin olmayan değer elenir.
 *  Dil ve alan adları büyük/küçük harf duyarsız okunur ("EN", "Name").
 *
 *  `sourceFields` verilirse her kayıtta YALNIZCA gönderilen alanlar kabul
 *  edilir: ana dilde açıklaması olmayan ürüne model bir açıklama uydurursa o
 *  metin yalnızca çeviride yaşar ve menüde bir dilde görünüp diğerinde
 *  görünmezdi. */
export function normalizeTranslationResult(
  raw: unknown,
  targetLocales: Locale[],
  allowedIds: Set<string>,
  sourceFields?: Map<string, Set<TranslatableField>>
): Map<string, Translations> {
  const allowedLocales = new Set(targetLocales);
  const output = new Map<string, Translations>();
  const items = extractItems(raw, allowedIds);

  for (const entry of items) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;

    // Kimlik gönderilenlerden biri olmalı: model uydurduysa çeviri yanlış
    // kayda yazılabilirdi.
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!allowedIds.has(id)) continue;

    const incoming = itemTranslations(item);
    if (!incoming) continue;
    const allowedFields = sourceFields?.get(id);

    const translations: Translations = { ...(output.get(id) ?? {}) };
    for (const [rawLocale, value] of Object.entries(incoming)) {
      const localeKey = normalizeLocaleKey(rawLocale);
      if (!localeKey || !allowedLocales.has(localeKey)) continue;
      if (!value || typeof value !== "object") continue;

      const fields: Partial<Record<TranslatableField, string>> = {};
      for (const [rawField, text] of Object.entries(value as Record<string, unknown>)) {
        const field = FIELD_BY_LOWER.get(rawField.trim().toLowerCase());
        if (!field || (allowedFields && !allowedFields.has(field))) continue;
        if (typeof text === "string" && text.trim() !== "") fields[field] = text.trim();
      }
      if (Object.keys(fields).length > 0) translations[localeKey] = { ...(translations[localeKey] ?? {}), ...fields };
    }

    if (Object.keys(translations).length > 0) output.set(id, translations);
  }

  return output;
}

/** Her kaydın gönderilen alanları — dönen çıktıda yalnızca bunlar kabul edilir. */
export function entrySourceFields(entries: TranslationEntry[]): Map<string, Set<TranslatableField>> {
  return new Map(entries.map((entry) => [entry.id, new Set(Object.keys(entry.fields) as TranslatableField[])]));
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

/** Formda görünen ama işletme kaydında henüz açık olmayan diller (ayarlarda
 *  eklenip kaydedilmemiş). Sunucu yalnızca kayıtlı dilleri çevirir; bunlar
 *  sessizce atlanmasın, kullanıcıya "önce kaydedin" denir. */
export function unsavedLocales(config: LangConfig, visibleLocales?: Locale[]): Locale[] {
  if (!visibleLocales) return [];
  const saved = new Set(activeLocales(config));
  return visibleLocales.filter((locale) => !saved.has(locale));
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
 *  en kritik cümlesidir. Şema örneği GÖNDERİLEN alanlardan kurulur: örnekte
 *  hep "name/description" durunca model kampanya başlığını (title) "name"
 *  anahtarıyla döndürüyor, çeviri de hiçbir alana düşmüyordu. */
export function buildTranslationPrompt(
  targetLocales: Locale[],
  localeNames: Record<Locale, string>,
  fields: TranslatableField[] = ["name", "description"]
): string {
  const targets = targetLocales.map((locale) => `"${locale}" (${localeNames[locale]})`).join(", ");
  const usedFields = fields.length > 0 ? fields : (["name", "description"] as TranslatableField[]);
  const fieldShape = `{ ${usedFields.map((field) => `"${field}": "string"`).join(", ")} }`;
  return `Sen bir restoran menüsü çevirmenisin. Sana verilen menü içeriklerini şu dillere çevireceksin: ${targets}.

KURALLAR:
1. YALNIZCA metin çevir. Sayı, fiyat, para birimi, ölçü ve kalori değerlerine dokunma — zaten sana gönderilmiyor.
2. Yemek adlarında yerel mutfak terimlerini koru. "Adana Kebap" gibi özel adlar çevrilmez, gerekiyorsa parantez içinde kısa açıklama eklenebilir.
3. Marka adlarını, özel isimleri ve ölçü birimlerini olduğu gibi bırak.
4. Menü diline uygun, kısa ve iştah açıcı yaz. Birebir sözlük çevirisi yapma.
5. Bir metni çeviremiyorsan o alanı sonuçtan tamamen çıkar — uydurma.
6. Gönderilen her öğenin "id" değerini yanıtta AYNEN koru.
7. Her öğede YALNIZCA o öğenin "fields" içinde gönderilen alan adlarını kullan (ör. "title" geldiyse "title" döndür, "name" değil). Gönderilmeyen alanı ekleme.
8. Dil anahtarları yalnızca şu kodlar olur: ${targetLocales.map((l) => `"${l}"`).join(", ")}.

Yanıtı MUTLAKA şu JSON şemasında ver:
{
  "items": [
    { "id": "<gönderilen id>", "translations": { ${targetLocales.map((l) => `"${l}": ${fieldShape}`).join(", ")} } }
  ]
}`;
}
