// Ana dil (main_language) değişiminde menü içeriğini yeniden temellendirir.
//
// Veri modeli: bir varlığın baz alanları (name/description/…) ana dilde tutulur,
// diğer diller `translations` içindedir (bkz. lib/i18n.ts tField). Ana dil TR→EN
// olarak değişirse baz alanlar hâlâ Türkçe metni tutar ama artık İngilizce kabul
// edilir; İngilizce çeviri ise baz alan tarafından gölgelenir. Yani taşıma
// yapılmazsa eski ana dilin metinleri erişilemez hâle gelir (kullanıcının
// gördüğü "dil değişince veriler uçuyor" hatası).
//
// Çözüm: dil değişiminde her kayıt için baz alanlar eski ana dilin çeviri
// kutusuna taşınır, yeni ana dilin çevirisi baz alanlara yükseltilir.

import type PocketBase from "pocketbase";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type Translatable,
  type TranslatableField,
  type Translations,
} from "@/lib/i18n";

/** Çevrilebilir varlığın taşınacak baz alanları + PocketBase koleksiyonu. */
interface RebaseTarget {
  collection: string;
  fields: readonly TranslatableField[];
  /** İşletmeye ait kayıtları süzen PocketBase filtresi. */
  filter: string;
}

// İşletme kaydı ayarlar formunun kendi update çağrısıyla yazıldığı için burada yok
// (bkz. rebaseEntity + settings sayfası).
const REBASE_TARGETS: readonly RebaseTarget[] = [
  { collection: "buyur_categories", fields: ["name", "description"], filter: "business = {:id}" },
  { collection: "buyur_products", fields: ["name", "description", "campaign_label"], filter: "business = {:id}" },
  { collection: "buyur_product_options", fields: ["group_name", "name"], filter: "product.business = {:id}" },
  { collection: "buyur_popups", fields: ["title", "message"], filter: "business = {:id}" },
];

/** İşletme kaydının çevrilebilir alanları (ad tüm dillerde ortak olduğu için yok). */
export const BUSINESS_REBASE_FIELDS = ["description", "marquee_text"] as const;

/** Tek bir kaydın ana dil değişimi sonrası yazılacak hâli. */
export interface RebaseResult {
  base: Partial<Record<TranslatableField, string>>;
  translations: Translations;
}

/** Tek bir PocketBase kaydına uygulanacak, önceden hesaplanmış güncelleme. */
export interface RebasePatch {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

function isBlank(value: string | undefined): boolean {
  return (value ?? "").trim() === "";
}

/** Boş değerleri atılmış kutu; geriye bir şey kalmazsa null. */
function pruneBucket(
  bucket: Partial<Record<TranslatableField, string>> | undefined
): Partial<Record<TranslatableField, string>> | null {
  const next: Partial<Record<TranslatableField, string>> = {};
  for (const [field, value] of Object.entries(bucket ?? {})) {
    if (typeof value === "string" && !isBlank(value)) next[field as TranslatableField] = value;
  }
  return Object.keys(next).length > 0 ? next : null;
}

function cloneTranslations(translations: Translations | undefined): Translations {
  const next: Translations = {};
  for (const locale of SUPPORTED_LOCALES) {
    const bucket = translations?.[locale];
    if (bucket) next[locale] = { ...bucket };
  }
  // Desteklenmeyen/eski dil kodlarını da koru — veri kaybetmemek esas.
  for (const [locale, bucket] of Object.entries(translations ?? {})) {
    if (!isSupportedLocale(locale) && bucket) (next as Record<string, unknown>)[locale] = { ...bucket };
  }
  return next;
}

/**
 * Bir varlığın baz alanlarını `from` dilinden `to` diline taşır:
 * baz metinler `translations[from]` kutusuna yazılır, `translations[to]`
 * çevirisi baz alanlara yükseltilir ve o kutu kaldırılır. Yeni dilde çeviri
 * yoksa baz metin olduğu gibi kalır (müşteri menüsündeki ana dile düşme
 * davranışıyla aynı) — böylece hiçbir alan boşalmaz.
 */
export function rebaseEntity(
  entity: Translatable,
  fields: readonly TranslatableField[],
  from: Locale,
  to: Locale
): RebaseResult {
  const translations = cloneTranslations(entity.translations);
  const base: Partial<Record<TranslatableField, string>> = {};

  if (from === to) {
    for (const field of fields) base[field] = entity[field] ?? "";
    return { base, translations };
  }

  // Eski ana dilin kutusu: baz metinler oraya taşınır. Tutarlı veride ana dilin
  // çeviri kutusu hiç yazılmaz (panel de seed'ler de yazmaz), dolayısıyla kutuda
  // bir değer varsa bu ana dili taşımadan değiştirmiş eski bir kayıttır — o
  // değerin üzerine yazılmaz, aksi hâlde gerçek çeviri kaybolur.
  const previous: Partial<Record<TranslatableField, string>> = { ...translations[from] };

  for (const field of fields) {
    const current = entity[field] ?? "";
    const incoming = translations[to]?.[field] ?? "";
    base[field] = isBlank(incoming) ? current : incoming;
    if (!isBlank(current) && isBlank(previous[field])) previous[field] = current;
    // Yeni ana dilin çevirisi baz alana yükseldi; kutuda kopyası kalmasın.
    if (translations[to]) delete translations[to][field];
  }

  const fromBucket = pruneBucket(previous);
  if (fromBucket) translations[from] = fromBucket;
  else delete translations[from];

  const toBucket = pruneBucket(translations[to]);
  if (toBucket) translations[to] = toBucket;
  else delete translations[to];

  return { base, translations };
}

/** Kaydın gerçekten değişip değişmediği — değişmeyen kayıtlar için istek atılmaz. */
function hasChanges(entity: Translatable, result: RebaseResult): boolean {
  for (const [field, value] of Object.entries(result.base)) {
    if ((entity[field as TranslatableField] ?? "") !== value) return true;
  }
  return JSON.stringify(entity.translations ?? {}) !== JSON.stringify(result.translations);
}

/** Bir kayıt için PocketBase update gövdesi (baz alanlar + translations). */
export function rebasePatchData(
  entity: Translatable,
  fields: readonly TranslatableField[],
  from: Locale,
  to: Locale
): Record<string, unknown> | null {
  const result = rebaseEntity(entity, fields, from, to);
  if (!hasChanges(entity, result)) return null;
  return { ...result.base, translations: result.translations };
}

/**
 * İşletmenin tüm kategori/ürün/seçenek/popup kayıtlarını okuyup uygulanacak
 * güncellemeleri önceden hesaplar. Patch'ler önceden hesaplandığı için yarıda
 * kalan bir taşıma, aynı patch listesiyle güvenle tekrar denenebilir
 * (tekrar hesaplansaydı taşınmış kayıtlar ikinci kez taşınırdı).
 */
export async function buildRebasePatches(
  client: PocketBase,
  businessId: string,
  from: Locale,
  to: Locale
): Promise<RebasePatch[]> {
  if (from === to) return [];
  const patches: RebasePatch[] = [];

  for (const target of REBASE_TARGETS) {
    const records = await client.collection(target.collection).getFullList<Translatable & { id: string }>({
      filter: client.filter(target.filter, { id: businessId }),
      requestKey: null,
    });
    for (const record of records) {
      const data = rebasePatchData(record, target.fields, from, to);
      if (data) patches.push({ collection: target.collection, id: record.id, data });
    }
  }

  return patches;
}

/**
 * Hesaplanmış güncellemeleri uygular; başarısız olanları geri döndürür.
 * Her kayıt tek istekte (baz alanlar + çeviriler birlikte) yazıldığı için
 * kısmi başarısızlıkta bile tek tek kayıtlar tutarlı kalır.
 */
export async function applyRebasePatches(
  client: PocketBase,
  patches: RebasePatch[],
  concurrency = 4
): Promise<RebasePatch[]> {
  const failed: RebasePatch[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < patches.length) {
      const patch = patches[cursor++];
      try {
        // requestKey: null — SDK'nın aynı anahtarlı istekleri otomatik iptal
        // etmesini engeller (paralel update'ler aksi hâlde birbirini keser).
        await client.collection(patch.collection).update(patch.id, patch.data, { requestKey: null });
      } catch {
        failed.push(patch);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, patches.length) }, worker));
  return failed;
}
