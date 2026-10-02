// Görsel adresleri (scripts/image-schema.mjs).
//
// Yüklenen görselde kayıt dosyanın yalnızca adını tutar; adres PocketBase'in dosya ucudur
// (/api/files/<koleksiyon>/<kayıt>/<dosya>). Depo (MinIO) dışa kapalıdır,
// dosyayı PocketBase servis eder. Küçük boy (`thumb`) yalnızca alanda
// tanımlı boylardan biri olabilir; listelerde özgün dosya indirilmesin diye
// kullanılır (menü mobilde 2 sn bütçesi).

import { PB_URL } from "@/lib/pocketbase";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { IMAGE_THUMBS } from "@/scripts/image-schema.mjs";
import type { Business, Category, Popup, Product } from "@/lib/types";

export const CATEGORY_COLLECTION = "buyur_categories";
export const PRODUCT_COLLECTION = "buyur_products";
export const POPUP_COLLECTION = "buyur_popups";

export type ImageThumb = (typeof IMAGE_THUMBS)[keyof typeof IMAGE_THUMBS];

export function pbFileUrl(collection: string, recordId: string | undefined, fileName: string | undefined, thumb?: ImageThumb): string {
  if (!recordId || !fileName) return "";
  const url = `${PB_URL}/api/files/${collection}/${recordId}/${encodeURIComponent(fileName)}`;
  return thumb ? `${url}?thumb=${thumb}` : url;
}

/** Logo — `small` küçük çerçeveler (menü başlığı, panel yan menüsü) için. */
export function businessLogoUrl(business: Pick<Business, "id" | "logo">, size: "small" | "full" = "full"): string {
  return pbFileUrl(BUSINESS_COLLECTION, business.id, business.logo, size === "small" ? IMAGE_THUMBS.logo : undefined);
}

export function businessCoverUrl(business: Pick<Business, "id" | "cover">): string {
  return pbFileUrl(BUSINESS_COLLECTION, business.id, business.cover);
}

type ProductImage = Pick<Product, "id" | "image"> & Partial<Pick<Product, "image_url">>;

/** Ürün görseli: elle yüklenen dosya ya da (yoksa) AI'ın bulduğu görselin
 *  sağlayıcı bağlantısı. `card` liste kartları için küçük boy — yalnızca
 *  yüklenen dosyada; AI bağlantısı zaten sağlayıcının küçültülmüş boyudur. */
export function productImageUrl(product: ProductImage, size: "card" | "full" = "full"): string {
  if (product.image) return pbFileUrl(PRODUCT_COLLECTION, product.id, product.image, size === "card" ? IMAGE_THUMBS.card : undefined);
  return product.image_url ?? "";
}

export function hasProductImage(product: Partial<Pick<Product, "image" | "image_url">>): boolean {
  return Boolean(product.image || product.image_url);
}

export function categoryImageUrl(category: Pick<Category, "id" | "image">): string {
  return pbFileUrl(CATEGORY_COLLECTION, category.id, category.image, IMAGE_THUMBS.card);
}

export function popupImageUrl(popup: Pick<Popup, "id" | "image">): string {
  return pbFileUrl(POPUP_COLLECTION, popup.id, popup.image);
}
