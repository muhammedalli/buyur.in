// Fiziksel menü taramasının SÖZLEŞMESİ.
//
// Model çıktısı asla doğrudan kayda yazılmaz: buradaki normalize katmanı
// modelin döndürdüğü serbest JSON'u kesin bir şekle sokar, okunamayan alanları
// TAHMİN ETMEK YERİNE işaretler ve güvenilmez her şeyi eler.
//
// Ürünün en pahalı hatası uydurulmuş bir fiyattır: menüye yanlış fiyat giren
// işletme müşterisiyle karşı karşıya kalır. Bu yüzden okunamayan fiyat `null`
// döner ve `uncertain` listesine "price" eklenir — kullanıcı önizlemede görür.

import { msg } from "@/lib/ui-i18n";

/** Bir alanın modelce okunamadığını/belirsiz olduğunu belirten anahtar. */
export type UncertainField = "name" | "description" | "price" | "currency";

export interface ScannedProduct {
  /** İstemci tarafı liste anahtarı; kayıt kimliği değil. */
  id: string;
  name: string;
  description: string;
  /** Okunamadıysa null — 0 ile karıştırılmamalı ("ücretsiz" demek değil). */
  price: number | null;
  /** ISO 4217 kodu (TRY, USD, EUR, GBP) ya da boş. */
  currency: string;
  /** Kullanıcının kontrol etmesi gereken alanlar. */
  uncertain: UncertainField[];
}

export interface ScannedCategory {
  id: string;
  name: string;
  uncertain: UncertainField[];
  products: ScannedProduct[];
}

export interface ScanResult {
  categories: ScannedCategory[];
  /** Menüde baskın görünen para birimi — içe aktarmada bilgi amaçlı. */
  currency: string;
  /** Kontrol edilmesi gereken toplam alan sayısı. */
  uncertainCount: number;
}

// ── Girdi: sayfa veri URI'leri ──────────────────────────────────────────

/** Tek bir sayfanın veri URI üst sınırı (~8MB base64 ≈ 6MB dosya). */
export const MAX_PAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_PREFIX = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;
const PDF_PREFIX = /^data:application\/pdf;base64,/;

export type MenuPage = { kind: "image"; data: string } | { kind: "pdf"; data: string };

/** Girdiyi doğrular: yalnızca beklenen veri URI biçimleri ve boyut sınırı.
 *  Panel taraması (/api/ai/scan) ve yönetim asistanı aynı kapıdan geçer. */
export function parseMenuPages(value: unknown, maxPages: number): { pages: MenuPage[] } | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: msg("Görsel bulunamadı.") };
  }
  if (value.length > maxPages) {
    return { error: `Tek seferde en fazla ${maxPages} sayfa menü tarayabilirsiniz.` };
  }

  const pages: MenuPage[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return { error: msg("Geçersiz dosya biçimi.") };
    if (entry.length > MAX_PAGE_BYTES) {
      return { error: msg("Dosyalardan biri çok büyük. Her sayfa en fazla 6 MB olmalı.") };
    }
    if (IMAGE_PREFIX.test(entry)) {
      pages.push({ kind: "image", data: entry });
    } else if (PDF_PREFIX.test(entry)) {
      pages.push({ kind: "pdf", data: entry });
    } else {
      return { error: msg("Yalnızca görsel (jpg, png, webp) veya PDF yükleyebilirsiniz.") };
    }
  }

  return { pages };
}

// Tek bir taramanın makul üst sınırları. Model bozuk/çok uzun çıktı üretirse
// paneli ve PocketBase'i boğmasın diye kesiliyor.
export const MAX_CATEGORIES = 60;
export const MAX_PRODUCTS_PER_CATEGORY = 120;
export const MAX_NAME_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 600;

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "₺": "TRY",
  tl: "TRY",
  try: "TRY",
  "$": "USD",
  usd: "USD",
  "€": "EUR",
  eur: "EUR",
  "£": "GBP",
  gbp: "GBP",
};

/** Serbest metinden ISO para birimi kodu. Tanınmazsa boş string. */
export function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string") return "";
  const key = value.trim().toLowerCase();
  if (key === "") return "";
  return CURRENCY_BY_SYMBOL[key] ?? (/^[a-z]{3}$/.test(key) ? key.toUpperCase() : "");
}

/** Fiyat metnini sayıya çevirir. Okunamıyorsa null döner — ASLA tahmin etmez.
 *
 *  "45,50 ₺" → 45.5 · "1.250" → 1250 · "12.50" → 12.5 · "" / "?" / "SS" → null
 *  Binlik ayracı ile ondalık ayracını ayırt etmek için son ayracın
 *  konumuna bakılır (son ayraçtan sonra tam 2 hane varsa ondalıktır). */
export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  // Rakam ve ayraç dışındaki her şeyi (para simgesi, boşluk, harf) at.
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (cleaned === "") return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);

  let normalized: string;
  if (lastSeparator === -1) {
    normalized = cleaned;
  } else {
    const decimals = cleaned.length - lastSeparator - 1;
    if (decimals === 1 || decimals === 2) {
      // Ondalık ayracı: öncesindeki tüm ayraçlar binliktir.
      normalized = cleaned.slice(0, lastSeparator).replace(/[.,]/g, "") + "." + cleaned.slice(lastSeparator + 1);
    } else {
      // Ayraçların tamamı binlik (ör. "1.250" veya "1,250").
      normalized = cleaned.replace(/[.,]/g, "");
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** Modelin bildirdiği belirsiz alanları süzer — bilinmeyen anahtarlar atılır. */
function reportedUncertain(value: unknown): UncertainField[] {
  if (!Array.isArray(value)) return [];
  const allowed: UncertainField[] = ["name", "description", "price", "currency"];
  return allowed.filter((field) => value.includes(field));
}

function addUncertain(list: UncertainField[], field: UncertainField): UncertainField[] {
  return list.includes(field) ? list : [...list, field];
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ham model çıktısını güvenli, kesin şekle sokar.
 *
 *  - Adı olmayan ürün/kategori elenir (tahmin edilmez)
 *  - Okunamayan fiyat null + "price" işareti olur
 *  - Ürünü kalmayan kategori elenir
 *  - Beklenmeyen alanlar atılır, uzunluklar kırpılır */
export function normalizeScanResult(raw: unknown): ScanResult {
  const rawCategories = (raw as { categories?: unknown })?.categories;
  if (!Array.isArray(rawCategories)) {
    return { categories: [], currency: "", uncertainCount: 0 };
  }

  const currencyVotes = new Map<string, number>();
  const categories: ScannedCategory[] = [];

  for (const rawCategory of rawCategories.slice(0, MAX_CATEGORIES)) {
    if (!rawCategory || typeof rawCategory !== "object") continue;
    const category = rawCategory as Record<string, unknown>;

    const name = cleanText(category.name, MAX_NAME_LENGTH);
    // Adı okunamayan kategori taşınmaz: altındaki ürünler "Diğer" gibi
    // uydurma bir başlığa gömülürse kullanıcı hatayı fark edemez.
    if (name === "") continue;

    const rawProducts = Array.isArray(category.products) ? category.products : [];
    const products: ScannedProduct[] = [];

    for (const rawProduct of rawProducts.slice(0, MAX_PRODUCTS_PER_CATEGORY)) {
      if (!rawProduct || typeof rawProduct !== "object") continue;
      const product = rawProduct as Record<string, unknown>;

      const productName = cleanText(product.name, MAX_NAME_LENGTH);
      if (productName === "") continue;

      const price = parsePrice(product.price);
      const currency = normalizeCurrency(product.currency);

      let uncertain: UncertainField[] = reportedUncertain(product.uncertain).filter((field) => field !== "name");
      if (price === null) uncertain = addUncertain(uncertain, "price");

      if (currency !== "") {
        currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);
      }

      products.push({
        id: nextId("p"),
        name: productName,
        description: cleanText(product.description, MAX_DESCRIPTION_LENGTH),
        price,
        currency,
        uncertain,
      });
    }

    // Ürünü kalmayan kategori menüye boş bir başlık olarak düşmesin.
    if (products.length === 0) continue;

    categories.push({
      id: nextId("c"),
      name,
      uncertain: reportedUncertain(category.uncertain).filter((field) => field === "description"),
      products,
    });
  }

  let dominantCurrency = "";
  let topVotes = 0;
  for (const [code, votes] of currencyVotes) {
    if (votes > topVotes) {
      dominantCurrency = code;
      topVotes = votes;
    }
  }

  const uncertainCount = categories.reduce(
    (total, category) =>
      total + category.uncertain.length + category.products.reduce((sum, p) => sum + p.uncertain.length, 0),
    0
  );

  return { categories, currency: dominantCurrency, uncertainCount };
}

/** Modele verilen görev tanımı. Şema burada açıkça yazılır; "bilmiyorsan boş
 *  bırak" talimatı promptun en kritik cümlesidir. */
export function buildScanPrompt(localeName: string): string {
  return `Sen bir menü veri çıkarma asistanısın. Sana verilen fiziksel menü sayfalarını (fotoğraf veya PDF) inceleyip kategorileri ve her kategorinin altındaki ürünleri çıkaracaksın.

KURALLAR:
1. ASLA TAHMİN ETME. Bir bilgiyi net okuyamıyorsan boş bırak ve o alanı "uncertain" listesine ekle. Yanlış bir fiyat, eksik fiyattan çok daha kötüdür.
2. Fiyatı yalnızca sayı olarak ver (para birimi simgesini ayır). Fiyat okunamıyorsa price alanını null yap ve uncertain listesine "price" ekle.
3. Para birimini "currency" alanında ISO kodu olarak ver (TRY, USD, EUR, GBP). Emin değilsen boş bırak.
4. Sayfada görünmeyen ürün veya kategori UYDURMA. Yalnızca gerçekten gördüklerini çıkar.
5. Kategori başlığı okunamıyorsa o kategoriyi atla; ürünleri uydurma bir başlığa toplama.
6. Açıklamada alerjen, kalori veya hazırlanma süresi yazıyorsa bunları açıklama metni içinde bırak.
7. Aynı ürün birden fazla sayfada görünüyorsa bir kez ekle.
8. Kategori adı, ürün adı ve açıklamayı menüde yazdığı gibi bırak; çevirme. Menü ${localeName} dışında bir dilde yazılmış olsa bile olduğu gibi aktar.
9. Menüde bir ürünün açıklaması YAZMIYORSA description alanını boş bırak. Ürün adından açıklama türetme, kendi cümleni yazma. Açıklama yazman gerekirse bile yalnızca ${localeName} dilinde yaz, asla başka dilde yazma.

Yanıtı MUTLAKA şu JSON şemasında ver:
{
  "categories": [
    {
      "name": "string",
      "uncertain": ["description"],
      "products": [
        {
          "name": "string",
          "description": "string",
          "price": number | null,
          "currency": "TRY" | "USD" | "EUR" | "GBP" | "",
          "uncertain": ["price"]
        }
      ]
    }
  ]
}`;
}
