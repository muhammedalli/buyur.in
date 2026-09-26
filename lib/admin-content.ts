// Yönetim panelinden bir işletmenin menü içeriğini (kategori ve ürün)
// düzenlemenin SAF kuralları: hangi alan, hangi sınırla yazılır; hangi eylem
// adıyla kaydedilir. Ağ yok; sözleşmesi tests/admin-content.test.ts.
// Uygulama: app/api/admin/businesses/[id]/content (runAudited* ile).
//
// Kapsam bilerek dar: ad, açıklama, fiyat, kategori, görünürlük, sıra,
// indirim. Görseller, seçenekler, alerjenler ve çeviriler işletme panelinin
// işidir; yönetim bir yanlışı düzeltir, menüyü baştan kurmaz. Çeviriye
// dokunulmaz: ana dildeki ad değişince çeviri eskisiyle kalır, panel bunu
// işletmeye gösterir (lib/i18n.ts → tField ana dile düşer).

import { normalizeEntryName } from "@/lib/ai/import-plan";

export type ContentResource = "category" | "product";
export type ContentOp = "create" | "update" | "delete";

export const CONTENT_COLLECTIONS: Record<ContentResource, string> = {
  category: "buyur_categories",
  product: "buyur_products",
};

export function isContentResource(value: unknown): value is ContentResource {
  return value === "category" || value === "product";
}

export function isContentOp(value: unknown): value is ContentOp {
  return value === "create" || value === "update" || value === "delete";
}

/** Şemadaki sınırlar (scripts/setup-pocketbase.mjs). */
export const CONTENT_LIMITS = {
  categoryName: 120,
  categoryDescription: 300,
  productName: 150,
  productDescription: 600,
  campaignLabel: 60,
  maxPrice: 1_000_000,
};

export interface ContentRow {
  id: string;
  name: string;
  category?: string;
  order?: number;
  price?: number;
  description?: string;
  is_active?: boolean;
  is_available?: boolean;
  discount_percent?: number;
  campaign_label?: string;
}

export interface ContentContext {
  businessId: string;
  categories: ContentRow[];
  products: ContentRow[];
}

export type ContentResult =
  | { ok: true; action: string; data: Record<string, unknown> }
  | { ok: false; error: string; status?: number };

/** Ad işletme genelinde tektir (CLAUDE.md §3.8, lib/unique-name.ts ile aynı
 *  katlama anahtarı): "TÜRK KAHVESİ" ile "türk kahvesi" aynı addır. */
export function nameTaken(rows: ContentRow[], name: string, excludeId?: string): boolean {
  const key = normalizeEntryName(name);
  if (!key) return false;
  return rows.some((row) => row.id !== excludeId && normalizeEntryName(row.name) === key);
}

function text(value: unknown, max: number, label: string, required: boolean): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined && !required) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: "Geçersiz istek." };
  const trimmed = value.trim();
  if (required && !trimmed) return { ok: false, error: `${label} boş olamaz.` };
  if (trimmed.length > max) return { ok: false, error: `${label} en fazla ${max} karakter olabilir.` };
  return { ok: true, value: trimmed };
}

function numberIn(value: unknown, min: number, max: number, label: string, integer = false): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    return { ok: false, error: `${label} ${min}–${max.toLocaleString("tr-TR")} arasında olmalı.` };
  }
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** Girdiyi kayıt alanlarına çevirir. Güncellemede yalnızca gelen alanlar
 *  doğrulanır ve yalnızca DEĞİŞENLER yamaya girer. */
function readFields(
  resource: ContentResource,
  input: Record<string, unknown>,
  ctx: ContentContext,
  current: ContentRow | null
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const creating = current === null;
  const data: Record<string, unknown> = {};
  const has = (key: string) => creating || Object.prototype.hasOwnProperty.call(input, key);
  const set = (key: string, value: unknown) => {
    const before = current ? (current as unknown as Record<string, unknown>)[key] : undefined;
    if (creating || JSON.stringify(before ?? null) !== JSON.stringify(value)) data[key] = value;
  };

  const isCategory = resource === "category";
  if (has("name")) {
    const name = text(input.name, isCategory ? CONTENT_LIMITS.categoryName : CONTENT_LIMITS.productName, isCategory ? "Kategori adı" : "Ürün adı", true);
    if (!name.ok) return name;
    const rows = isCategory ? ctx.categories : ctx.products;
    if (nameTaken(rows, name.value, current?.id)) {
      return { ok: false, error: isCategory ? "Bu işletmede bu adda bir kategori zaten var." : "Bu işletmede bu adda bir ürün zaten var." };
    }
    set("name", name.value);
  }
  if (has("description") && input.description !== undefined) {
    const description = text(input.description, isCategory ? CONTENT_LIMITS.categoryDescription : CONTENT_LIMITS.productDescription, "Açıklama", false);
    if (!description.ok) return description;
    set("description", description.value);
  }

  if (isCategory) {
    if (has("is_active") && input.is_active !== undefined) {
      if (typeof input.is_active !== "boolean") return { ok: false, error: "Geçersiz istek." };
      set("is_active", input.is_active);
    } else if (creating) {
      data.is_active = true;
    }
    return { ok: true, data };
  }

  if (has("price")) {
    const price = numberIn(input.price, 0, CONTENT_LIMITS.maxPrice, "Fiyat");
    if (!price.ok) return price;
    set("price", price.value);
  }
  if (has("category")) {
    if (typeof input.category !== "string" || !ctx.categories.some((c) => c.id === input.category)) {
      return { ok: false, error: "Bu işletmeye ait bir kategori seçin." };
    }
    set("category", input.category);
  }
  if (has("is_available") && input.is_available !== undefined) {
    if (typeof input.is_available !== "boolean") return { ok: false, error: "Geçersiz istek." };
    set("is_available", input.is_available);
  } else if (creating) {
    data.is_available = true;
  }
  if (Object.prototype.hasOwnProperty.call(input, "discount_percent")) {
    const discount = numberIn(input.discount_percent ?? 0, 0, 100, "İndirim yüzdesi", true);
    if (!discount.ok) return discount;
    set("discount_percent", discount.value);
  }
  if (Object.prototype.hasOwnProperty.call(input, "campaign_label")) {
    const label = text(input.campaign_label ?? "", CONTENT_LIMITS.campaignLabel, "Kampanya etiketi", false);
    if (!label.ok) return label;
    set("campaign_label", label.value);
  }
  return { ok: true, data };
}

function nextOrder(rows: ContentRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order ?? 0), 0) + 1;
}

/** İşlemi doğrular ve yazılacak veriyi + denetim kaydındaki eylem adını döner. */
export function buildContentChange(
  resource: ContentResource,
  op: ContentOp,
  input: { id?: unknown; fields?: unknown },
  ctx: ContentContext
): ContentResult {
  const fields = (input.fields && typeof input.fields === "object" && !Array.isArray(input.fields) ? input.fields : {}) as Record<string, unknown>;
  const rows = resource === "category" ? ctx.categories : ctx.products;

  if (op === "create") {
    const read = readFields(resource, fields, ctx, null);
    if (!read.ok) return read;
    const siblings = resource === "product" ? ctx.products.filter((p) => p.category === read.data.category) : ctx.categories;
    return {
      ok: true,
      action: `${resource}.create`,
      data: { ...read.data, business: ctx.businessId, order: nextOrder(siblings) },
    };
  }

  const current = rows.find((row) => row.id === input.id);
  // Başka işletmenin kaydı da "yok" görünür: kimlik tahminiyle bilgi sızmasın.
  if (!current) return { ok: false, error: resource === "category" ? "Kategori bulunamadı." : "Ürün bulunamadı.", status: 404 };

  if (op === "delete") {
    if (resource === "category") {
      // Kategori silinince ürünleri de (cascade) giderdi; yönetimden toplu ürün
      // kaybı tek tıkla olmasın.
      const inside = ctx.products.filter((p) => p.category === current.id).length;
      if (inside > 0) {
        return { ok: false, error: `Bu kategoride ${inside} ürün var. Önce ürünleri başka kategoriye taşıyın ya da silin.`, status: 409 };
      }
    }
    return { ok: true, action: `${resource}.delete`, data: {} };
  }

  const read = readFields(resource, fields, ctx, current);
  if (!read.ok) return read;
  if (Object.keys(read.data).length === 0) return { ok: false, error: "Değişiklik yok." };
  // İşletme hook'uyla aynı ad: fiyat değişikliği ayrıca aranabilsin.
  const priceChanged = resource === "product" && ("price" in read.data || "discount_percent" in read.data);
  return { ok: true, action: priceChanged ? "product.price_change" : `${resource}.update`, data: read.data };
}
