// Yönetim panelindeki menü asistanının (sohbet) SÖZLEŞMESİ.
//
// Asistan menüyü kendisi yeniden yazmaz: modelden yalnızca küçük, adlandırılmış
// işlemler (ops) istenir ve bunlar burada, kodla uygulanır. Nedeni fiyattır:
// "fiyatlara %10 ekle" dendiğinde 200 fiyatı modelin tek tek yeniden yazması
// hem pahalı hem de sessizce yanlış bir rakam üretmeye açıktır. Yüzde, yuvarlama
// ve taşıma burada deterministik hesaplanır; model yalnızca NE yapılacağını söyler.
//
// Kaynaktan menü çıkarma (bağlantı, JSON, metin, fotoğraf) lib/ai/menu-scan.ts
// kurallarıyla normalize edilir ve taslağa EKLENİR; taslak yazılana kadar hiçbir
// şey kayda gitmez. Saf modül; sözleşmesi tests/ai-menu-assistant.test.ts.

import { dedupeScanned, normalizeEntryName } from "@/lib/ai/import-plan";
import {
  MAX_CATEGORIES,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PRODUCTS_PER_CATEGORY,
  normalizeScanResult,
  parsePrice,
  type ScanResult,
  type UncertainField,
} from "@/lib/ai/menu-scan";
import { IMAGE_PROVIDERS, isAllowedImageHost, type ProductImageSource } from "@/lib/ai/image-source";

export interface DraftProduct {
  id: string;
  name: string;
  description: string;
  /** Okunamadıysa null: yazmadan önce yönetici doldurmalı. */
  price: number | null;
  uncertain: UncertainField[];
  image_url: string;
  image_source: ProductImageSource | null;
}

export interface DraftCategory {
  id: string;
  name: string;
  products: DraftProduct[];
}

export interface MenuDraft {
  categories: DraftCategory[];
  /** Kaynakta baskın görünen para birimi (bilgi amaçlı). */
  currency: string;
}

/** Yazılabilecek en yüksek fiyat (lib/admin-content.ts ile aynı sınır). */
export const MAX_PRICE = 1_000_000;
/** Tek bir yanıtta uygulanacak en fazla işlem. */
export const MAX_OPS = 200;
/** Bir mesajda okunacak en fazla bağlantı. */
export const MAX_LINKS = 3;

export function emptyDraft(): MenuDraft {
  return { categories: [], currency: "" };
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const price = parsePrice(value);
  return price !== null && price <= MAX_PRICE ? Math.round(price * 100) / 100 : null;
}

const UNCERTAIN_FIELDS: UncertainField[] = ["name", "description", "price", "currency"];

function cleanImageSource(value: unknown, imageUrl: string): ProductImageSource | null {
  if (!imageUrl || !value || typeof value !== "object") return null;
  const source = value as ProductImageSource;
  if (!IMAGE_PROVIDERS.includes(source.provider) || source.original_url !== imageUrl) return null;
  return source;
}

/** İstemciden gelen taslağı güvenli şekle sokar. Taslak yöneticinin
 *  tarayıcısında durur; sunucu ona güvenmez: uzunluk, sayı ve görsel adresi
 *  burada yeniden sınırlanır. Kimlikler baştan verilir (c1, p1…). */
export function normalizeDraft(raw: unknown): MenuDraft {
  const rawCategories = (raw as { categories?: unknown })?.categories;
  const currency = cleanText((raw as { currency?: unknown })?.currency, 3).toUpperCase();
  if (!Array.isArray(rawCategories)) return { categories: [], currency };

  const categories: DraftCategory[] = [];
  for (const rawCategory of rawCategories.slice(0, MAX_CATEGORIES)) {
    if (!rawCategory || typeof rawCategory !== "object") continue;
    const category = rawCategory as Record<string, unknown>;
    const name = cleanText(category.name, MAX_NAME_LENGTH);
    if (!name) continue;
    const products: DraftProduct[] = [];
    const rawProducts = Array.isArray(category.products) ? category.products : [];
    for (const rawProduct of rawProducts.slice(0, MAX_PRODUCTS_PER_CATEGORY)) {
      if (!rawProduct || typeof rawProduct !== "object") continue;
      const product = rawProduct as Record<string, unknown>;
      const productName = cleanText(product.name, MAX_NAME_LENGTH);
      if (!productName) continue;
      const price = cleanPrice(product.price);
      const reported = Array.isArray(product.uncertain) ? product.uncertain : [];
      let uncertain = UNCERTAIN_FIELDS.filter((field) => field !== "name" && reported.includes(field));
      if (price === null && !uncertain.includes("price")) uncertain = [...uncertain, "price"];
      if (price !== null) uncertain = uncertain.filter((field) => field !== "price");
      const imageUrl = typeof product.image_url === "string" && isAllowedImageHost(product.image_url) ? product.image_url : "";
      products.push({
        id: "",
        name: productName,
        description: cleanText(product.description, MAX_DESCRIPTION_LENGTH),
        price,
        uncertain,
        image_url: imageUrl,
        image_source: cleanImageSource(product.image_source, imageUrl),
      });
    }
    categories.push({ id: "", name, products });
  }
  return reindexDraft({ categories, currency });
}

/** Kimlikleri sıradan yeniden verir. Modelin göreceği özet de bu kimliklerle
 *  yazılır; kısa ve tahmin edilebilir kimlik modelin yanlış kayda dokunma
 *  ihtimalini azaltır. */
export function reindexDraft(draft: MenuDraft): MenuDraft {
  let c = 0;
  let p = 0;
  return {
    ...draft,
    categories: draft.categories.map((category) => ({
      ...category,
      id: `c${++c}`,
      products: category.products.map((product) => ({ ...product, id: `p${++p}` })),
    })),
  };
}

export interface DraftStats {
  categories: number;
  products: number;
  missingPrices: number;
  withImages: number;
}

export function draftStats(draft: MenuDraft): DraftStats {
  let products = 0;
  let missingPrices = 0;
  let withImages = 0;
  for (const category of draft.categories) {
    for (const product of category.products) {
      products += 1;
      if (product.price === null) missingPrices += 1;
      if (product.image_url) withImages += 1;
    }
  }
  return { categories: draft.categories.length, products, missingPrices, withImages };
}

export interface MergeResult {
  draft: MenuDraft;
  addedCategories: number;
  addedProducts: number;
  /** Taslakta zaten olduğu için alınmayan ürün sayısı. */
  duplicateProducts: number;
}

/** Kaynaktan çıkarılan menüyü taslağa ekler. Aynı adlı kategori birleşir,
 *  aynı adlı ürün (taslağın her yerinde) bir kez kalır: ilk gelen korunur,
 *  yani yöneticinin düzelttiği kayıt yeni gelenle ezilmez. */
export function mergeExtracted(draft: MenuDraft, scan: ScanResult): MergeResult {
  const incoming: DraftCategory[] = scan.categories.map((category) => ({
    id: "",
    name: category.name,
    products: category.products.map((product) => ({
      id: "",
      name: product.name,
      description: product.description,
      price: product.price,
      uncertain: product.uncertain,
      image_url: "",
      image_source: null,
    })),
  }));
  const before = draftStats(draft);
  const { categories } = dedupeScanned<DraftProduct, DraftCategory>([...draft.categories, ...incoming]);
  const merged = reindexDraft({
    categories: categories.filter((category) => category.products.length > 0).slice(0, MAX_CATEGORIES),
    currency: draft.currency || scan.currency,
  });
  const after = draftStats(merged);
  const incomingProducts = incoming.reduce((sum, category) => sum + category.products.length, 0);
  return {
    draft: merged,
    addedCategories: after.categories - before.categories,
    addedProducts: after.products - before.products,
    duplicateProducts: Math.max(0, incomingProducts - (after.products - before.products)),
  };
}

// ── İşlemler ────────────────────────────────────────────────────────────

export type MenuOp =
  | { op: "adjust_prices"; percent: number; category?: string; round?: number }
  | { op: "set_price"; product: string; price: number }
  | { op: "rename_category"; category: string; name: string }
  | { op: "delete_category"; category: string }
  | { op: "merge_categories"; from: string; into: string }
  | { op: "move_category"; category: string; position: number }
  | { op: "update_product"; product: string; name?: string; description?: string }
  | { op: "delete_product"; product: string }
  | { op: "move_product"; product: string; category: string }
  | { op: "add_product"; category: string; name: string; price: number | null; description?: string }
  | { op: "clear_descriptions"; category?: string }
  | { op: "clear_menu" };

function ref(value: unknown): string {
  return cleanText(value, MAX_NAME_LENGTH);
}

/** Modelin döndürdüğü işlem listesini süzer. Tanınmayan ya da eksik alanlı
 *  işlem sessizce atılır; yüzde −90…+500 dışındaysa atılır (yanlış anlaşılan
 *  bir "10 kat" tüm menüyü bozmasın). */
export function normalizeOps(raw: unknown): MenuOp[] {
  if (!Array.isArray(raw)) return [];
  const ops: MenuOp[] = [];
  for (const entry of raw.slice(0, MAX_OPS)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    switch (item.op) {
      case "adjust_prices": {
        const percent = typeof item.percent === "number" ? item.percent : Number(item.percent);
        if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500) break;
        const round = typeof item.round === "number" && item.round > 0 && item.round <= 100 ? item.round : undefined;
        const category = ref(item.category);
        ops.push({ op: "adjust_prices", percent, ...(category ? { category } : {}), ...(round ? { round } : {}) });
        break;
      }
      case "set_price": {
        const price = cleanPrice(item.price);
        const product = ref(item.product);
        if (product && price !== null) ops.push({ op: "set_price", product, price });
        break;
      }
      case "rename_category": {
        const category = ref(item.category);
        const name = ref(item.name);
        if (category && name) ops.push({ op: "rename_category", category, name });
        break;
      }
      case "delete_category": {
        const category = ref(item.category);
        if (category) ops.push({ op: "delete_category", category });
        break;
      }
      case "merge_categories": {
        const from = ref(item.from);
        const into = ref(item.into);
        if (from && into) ops.push({ op: "merge_categories", from, into });
        break;
      }
      case "move_category": {
        const category = ref(item.category);
        const position = Number(item.position);
        if (category && Number.isInteger(position) && position >= 1) ops.push({ op: "move_category", category, position });
        break;
      }
      case "update_product": {
        const product = ref(item.product);
        const name = item.name === undefined ? undefined : ref(item.name);
        const description = item.description === undefined ? undefined : cleanText(item.description, MAX_DESCRIPTION_LENGTH);
        if (product && (name || description !== undefined)) {
          ops.push({ op: "update_product", product, ...(name ? { name } : {}), ...(description !== undefined ? { description } : {}) });
        }
        break;
      }
      case "delete_product": {
        const product = ref(item.product);
        if (product) ops.push({ op: "delete_product", product });
        break;
      }
      case "move_product": {
        const product = ref(item.product);
        const category = ref(item.category);
        if (product && category) ops.push({ op: "move_product", product, category });
        break;
      }
      case "add_product": {
        const category = ref(item.category);
        const name = ref(item.name);
        const description = cleanText(item.description, MAX_DESCRIPTION_LENGTH);
        if (category && name) {
          ops.push({ op: "add_product", category, name, price: cleanPrice(item.price), ...(description ? { description } : {}) });
        }
        break;
      }
      case "clear_descriptions": {
        const category = ref(item.category);
        ops.push({ op: "clear_descriptions", ...(category ? { category } : {}) });
        break;
      }
      case "clear_menu":
        ops.push({ op: "clear_menu" });
        break;
    }
  }
  return ops;
}

/** Yüzde değişiminden sonra yuvarlama. Adım verilmediyse tam sayı fiyat tam
 *  sayı kalır (Türk menülerinde kuruşlu fiyat istisnadır), kuruşlu fiyat kuruşta
 *  yuvarlanır. */
export function adjustPrice(price: number, percent: number, round?: number): number {
  const raw = price * (1 + percent / 100);
  if (round) return Math.max(0, Math.round(raw / round) * round);
  if (Number.isInteger(price)) return Math.max(0, Math.round(raw));
  return Math.max(0, Math.round(raw * 100) / 100);
}

export interface ApplyResult {
  draft: MenuDraft;
  applied: number;
  /** Uygulanamayan işlemlerin okunur açıklaması (bulunamayan kayıt gibi). */
  skipped: string[];
}

/** İşlemleri sırayla uygular. Kayıt kimlikle (c3/p12) ya da adla bulunur. */
export function applyMenuOps(input: MenuDraft, ops: MenuOp[]): ApplyResult {
  let categories: DraftCategory[] = input.categories.map((category) => ({ ...category, products: [...category.products] }));
  const skipped: string[] = [];
  let applied = 0;

  const findCategory = (key: string) => {
    const byId = categories.find((category) => category.id === key);
    if (byId) return byId;
    const normalized = normalizeEntryName(key);
    return normalized ? categories.find((category) => normalizeEntryName(category.name) === normalized) : undefined;
  };
  const findProduct = (key: string): { category: DraftCategory; index: number } | undefined => {
    const normalized = normalizeEntryName(key);
    for (const category of categories) {
      const index = category.products.findIndex(
        (product) => product.id === key || (normalized !== "" && normalizeEntryName(product.name) === normalized)
      );
      if (index !== -1) return { category, index };
    }
    return undefined;
  };
  const productNameTaken = (name: string, exceptId?: string) => {
    const key = normalizeEntryName(name);
    return categories.some((category) => category.products.some((p) => p.id !== exceptId && normalizeEntryName(p.name) === key));
  };
  const ensureCategory = (key: string): DraftCategory => {
    const found = findCategory(key);
    if (found) return found;
    const created: DraftCategory = { id: `new-${categories.length + 1}`, name: key, products: [] };
    categories.push(created);
    return created;
  };
  const updateProduct = (category: DraftCategory, index: number, patch: Partial<DraftProduct>) => {
    category.products[index] = { ...category.products[index], ...patch };
  };

  for (const op of ops) {
    switch (op.op) {
      case "adjust_prices": {
        const scope = op.category ? findCategory(op.category) : undefined;
        if (op.category && !scope) {
          skipped.push(`"${op.category}" kategorisi bulunamadı.`);
          break;
        }
        for (const category of scope ? [scope] : categories) {
          category.products.forEach((product, index) => {
            if (product.price !== null) updateProduct(category, index, { price: adjustPrice(product.price, op.percent, op.round) });
          });
        }
        applied += 1;
        break;
      }
      case "set_price": {
        const found = findProduct(op.product);
        if (!found) {
          skipped.push(`"${op.product}" ürünü bulunamadı.`);
          break;
        }
        const current = found.category.products[found.index];
        updateProduct(found.category, found.index, { price: op.price, uncertain: current.uncertain.filter((f) => f !== "price") });
        applied += 1;
        break;
      }
      case "rename_category": {
        const category = findCategory(op.category);
        const clash = findCategory(op.name);
        if (!category) {
          skipped.push(`"${op.category}" kategorisi bulunamadı.`);
          break;
        }
        if (clash && clash !== category) {
          skipped.push(`"${op.name}" adında bir kategori zaten var; birleştirmek için açıkça söyleyin.`);
          break;
        }
        category.name = op.name;
        applied += 1;
        break;
      }
      case "delete_category": {
        const category = findCategory(op.category);
        if (!category) {
          skipped.push(`"${op.category}" kategorisi bulunamadı.`);
          break;
        }
        categories = categories.filter((entry) => entry !== category);
        applied += 1;
        break;
      }
      case "merge_categories": {
        const from = findCategory(op.from);
        const into = findCategory(op.into);
        if (!from || !into || from === into) {
          skipped.push(`"${op.from}" → "${op.into}" birleştirilemedi.`);
          break;
        }
        into.products.push(...from.products);
        categories = categories.filter((entry) => entry !== from);
        applied += 1;
        break;
      }
      case "move_category": {
        const category = findCategory(op.category);
        if (!category) {
          skipped.push(`"${op.category}" kategorisi bulunamadı.`);
          break;
        }
        const rest = categories.filter((entry) => entry !== category);
        const position = Math.min(op.position, rest.length + 1) - 1;
        categories = [...rest.slice(0, position), category, ...rest.slice(position)];
        applied += 1;
        break;
      }
      case "update_product": {
        const found = findProduct(op.product);
        if (!found) {
          skipped.push(`"${op.product}" ürünü bulunamadı.`);
          break;
        }
        const current = found.category.products[found.index];
        if (op.name && productNameTaken(op.name, current.id)) {
          skipped.push(`"${op.name}" adında bir ürün zaten var.`);
          break;
        }
        updateProduct(found.category, found.index, {
          ...(op.name ? { name: op.name } : {}),
          ...(op.description !== undefined ? { description: op.description, uncertain: current.uncertain.filter((f) => f !== "description") } : {}),
        });
        applied += 1;
        break;
      }
      case "delete_product": {
        const found = findProduct(op.product);
        if (!found) {
          skipped.push(`"${op.product}" ürünü bulunamadı.`);
          break;
        }
        found.category.products.splice(found.index, 1);
        applied += 1;
        break;
      }
      case "move_product": {
        const found = findProduct(op.product);
        if (!found) {
          skipped.push(`"${op.product}" ürünü bulunamadı.`);
          break;
        }
        const target = ensureCategory(op.category);
        if (target === found.category) break;
        const [product] = found.category.products.splice(found.index, 1);
        target.products.push(product);
        applied += 1;
        break;
      }
      case "add_product": {
        if (productNameTaken(op.name)) {
          skipped.push(`"${op.name}" menüde zaten var.`);
          break;
        }
        const target = ensureCategory(op.category);
        target.products.push({
          id: `new-p${applied}`,
          name: op.name,
          description: op.description ?? "",
          price: op.price,
          uncertain: op.price === null ? ["price"] : [],
          image_url: "",
          image_source: null,
        });
        applied += 1;
        break;
      }
      case "clear_descriptions": {
        const scope = op.category ? findCategory(op.category) : undefined;
        if (op.category && !scope) {
          skipped.push(`"${op.category}" kategorisi bulunamadı.`);
          break;
        }
        for (const category of scope ? [scope] : categories) {
          category.products = category.products.map((product) => ({
            ...product,
            description: "",
            uncertain: product.uncertain.filter((f) => f !== "description"),
          }));
        }
        applied += 1;
        break;
      }
      case "clear_menu":
        categories = [];
        applied += 1;
        break;
    }
  }

  // Ürünü kalmayan kategori yazılmaz; taslakta da tutulmaz.
  const draft = reindexDraft({ ...input, categories: categories.filter((category) => category.products.length > 0) });
  return { draft, applied, skipped };
}

// ── Kaynak tespiti ──────────────────────────────────────────────────────

/** Mesajdaki bağlantılar (en fazla MAX_LINKS). "www." ile başlayan adres de
 *  bağlantı sayılır ve https:// ile tamamlanır: yöneticiler adresi çoğu zaman
 *  tarayıcı çubuğundan protokolsüz kopyalar. */
export function detectLinks(message: string): string[] {
  const found = message.match(/(?:https?:\/\/|\bwww\.)[^\s<>"'`]+/gi) ?? [];
  const cleaned = found.map((link) => {
    const trimmed = link.replace(/[),.;:!?]+$/, "");
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  });
  return [...new Set(cleaned)].slice(0, MAX_LINKS);
}

/** Mesajdan bağlantıları çıkarır; geriye kalan metin düzenleme komutudur. */
export function stripLinks(message: string): string {
  return message.replace(/(?:https?:\/\/|\bwww\.)[^\s<>"'`]+/gi, " ").replace(/\s+/g, " ").trim();
}

export type JsonSource = { kind: "native"; scan: ScanResult } | { kind: "foreign"; text: string };

/** Mesajın tamamı JSON ise okur. Bizim biçimimizdeyse (categories → products)
 *  model çağrılmadan normalize edilir; başka bir biçimse metin olarak modele
 *  gider. JSON değilse null. */
export function readJsonSource(message: string): JsonSource | null {
  const trimmed = message.trim();
  if (!/^[[{]/.test(trimmed)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const candidate = Array.isArray(parsed) ? { categories: parsed } : parsed;
  const scan = normalizeScanResult(candidate);
  if (scan.categories.length > 0) return { kind: "native", scan };
  return { kind: "foreign", text: trimmed };
}

// ── Model yönergeleri ───────────────────────────────────────────────────

/** Modelin göreceği taslak özeti. Açıklama kısaltılır: model düzenleme
 *  yaparken metnin tamamına nadiren ihtiyaç duyar, bağlam boşa şişmesin. */
export function draftSummary(draft: MenuDraft): string {
  if (draft.categories.length === 0) return "(taslak boş)";
  const lines: string[] = [];
  for (const category of draft.categories) {
    lines.push(`[${category.id}] ${category.name}`);
    for (const product of category.products) {
      const price = product.price === null ? "fiyat yok" : String(product.price);
      const description = product.description ? ` — ${product.description.slice(0, 80)}` : "";
      lines.push(`  [${product.id}] ${product.name} | ${price}${description}`);
    }
  }
  return lines.join("\n");
}

const EXTRACTION_RULES = `KURALLAR:
1. ASLA TAHMİN ETME. Fiyatı net göremiyorsan price alanını null yap ve uncertain listesine "price" ekle. Yanlış bir fiyat, eksik fiyattan çok daha kötüdür.
2. Fiyatı yalnızca sayı olarak ver; para birimini "currency" alanına ISO kodu olarak yaz (TRY, USD, EUR, GBP), emin değilsen boş bırak.
3. Kaynakta olmayan ürün veya kategori UYDURMA.
4. Kategori başlığı yoksa ürünleri kaynaktaki bağlama uygun, kısa ve genel bir başlık altında topla (ör. "Menü").
5. Adları ve açıklamaları kaynakta yazdığı gibi bırak; çevirme. Açıklama yoksa boş bırak, kendin yazma.
6. Aynı ürün birden fazla kez geçiyorsa bir kez ekle. Porsiyon/boy farkı varsa ("Küçük", "Büyük") her birini ayrı ürün olarak adıyla birlikte yaz.
7. Menü dışı içerikleri (adres, çalışma saati, kampanya metni, gezinme bağlantıları, çerez uyarısı) alma.`;

const EXTRACTION_SCHEMA = `{
  "categories": [
    { "name": "string", "products": [
      { "name": "string", "description": "string", "price": number | null, "currency": "TRY" | "USD" | "EUR" | "GBP" | "", "uncertain": ["price"] }
    ] }
  ]
}`;

/** Metin kaynağından (web sayfası metni, yapıştırılmış metin, yabancı JSON)
 *  menü çıkarma yönergesi. */
export function buildTextExtractionPrompt(sourceLabel: string): string {
  return `Sen bir menü veri çıkarma asistanısın. Aşağıda ${sourceLabel} var. İçindeki restoran/kafe menüsünü kategorileri ve ürünleriyle çıkar.

${EXTRACTION_RULES}

Yanıtı MUTLAKA şu JSON şemasında ver:
${EXTRACTION_SCHEMA}`;
}

/** Sohbet (düzenleme) yönergesi. Model menüyü yeniden yazmaz; işlem listesi
 *  döndürür. Mesaj menü içeriği taşıyorsa (yapıştırılmış metin) "add" alanına
 *  çıkarır. */
export function buildAssistantPrompt(summary: string, businessName: string): string {
  return `Sen buyur yönetim panelinde, ${businessName ? `"${businessName}" işletmesinin` : "yeni bir işletmenin"} dijital menüsünü hazırlayan asistansın. Yöneticiyle Türkçe, kısa ve net konuşursun.

Menü taslağının şu anki hâli (köşeli parantezdekiler kayıt kimliği):
${summary}

Yöneticinin mesajına göre YALNIZCA şu JSON'u döndür:
{
  "reply": "Yöneticiye kısa Türkçe yanıt (ne yaptığını ya da neden yapamadığını söyle, 1-3 cümle)",
  "ops": [ ...işlemler ],
  "add": { "categories": [ ... ] }
}

İŞLEMLER (kayıtlara kimlikle başvur: "c3", "p12"):
- {"op":"adjust_prices","percent":10,"category":"c2"?,"round":5?}  yüzde artır/azalt (azaltmak için eksi). category verilmezse tüm menü. round: yuvarlama adımı (ör. 5 → 5'in katı), istenmediyse yazma.
- {"op":"set_price","product":"p4","price":85}  YALNIZCA yönetici fiyatı açıkça söylediyse.
- {"op":"rename_category","category":"c1","name":"..."}
- {"op":"delete_category","category":"c1"}
- {"op":"merge_categories","from":"c3","into":"c1"}
- {"op":"move_category","category":"c4","position":1}  (1 = en üst)
- {"op":"update_product","product":"p7","name":"..."?,"description":"..."?}
- {"op":"delete_product","product":"p9"}
- {"op":"move_product","product":"p2","category":"c5" ya da yeni kategori adı}
- {"op":"add_product","category":"c1" ya da yeni kategori adı,"name":"...","price":45 | null,"description":"..."?}
- {"op":"clear_descriptions","category":"c1"?}
- {"op":"clear_menu"}  yalnızca yönetici taslağı tamamen silmek istediğinde.

"add": Mesajın KENDİSİ menü içeriği (ürün adları ve fiyatlar) taşıyorsa onu buraya çıkar, taslağa eklenir. Şema:
${EXTRACTION_SCHEMA}
Menü içeriği yoksa "add" alanını boş bırak: {"categories": []}.

KURALLAR:
1. ASLA fiyat uydurma. Yönetici söylemediyse set_price kullanma; yüzde değişimini adjust_prices ile yap, hesaplamayı sen yapma.
2. Açıklama yazman istenirse kısa (en fazla 1 cümle), iştah açıcı, ürünün gerçekte ne olduğuna sadık yaz; içerikte emin olmadığın malzeme ekleme.
3. İstenmeyen değişiklik yapma. Anlamadıysan ops boş kalsın ve reply'da netleştirici bir soru sor.
4. Taslak boşsa ve mesajda menü yoksa, yöneticiye menüyü nasıl verebileceğini anlat: bağlantı, JSON, düz metin ya da fotoğraf/PDF.
5. Görsel, çeviri ve yayınlama bu sohbetin işi değil; sorulursa ekrandaki ilgili düğmeyi söyle ("Tüm ürünlere görsel ara", "İşletmeyi oluştur").`;
}

export interface AssistantReply {
  reply: string;
  ops: MenuOp[];
  add: ScanResult;
}

export function normalizeAssistantReply(raw: unknown): AssistantReply {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    reply: cleanText(value.reply, 1200),
    ops: normalizeOps(value.ops),
    add: normalizeScanResult(value.add),
  };
}
