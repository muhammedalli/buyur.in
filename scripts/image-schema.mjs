// Görsel alanları (tek kaynak).
//
// İki tür görsel var:
//   · Elle yüklenen görsel → PocketBase `file` alanı. Dosya PocketBase'in S3
//     deposunda (MinIO) durur, kayıt yalnızca dosya adını tutar. Alan
//     temizlenince/değişince ya da kayıt silinince PocketBase dosyayı depodan
//     kendisi siler: uygulamada ayrı silme kodu yoktur. Yüklemeden önce
//     tarayıcıda küçültülür (lib/image-resize.ts → IMAGE_PRESETS).
//   · AI'ın bulduğu görsel (yalnızca ürün) → sağlayıcının adresi düz metin
//     olarak `image_url`'de; indirilmez, kopyalanmaz. Künyesi `image_source`'ta.
//   Bir üründe ikisinden biri doludur; görsel adresi lib/files.ts'te çözülür.
//
// Okuyanlar: scripts/setup-pocketbase.mjs (sıfırdan kurulum),
// scripts/migrate-image-files.mjs (eski alanlardan göç) ve lib/files.ts
// (görsel adresi + küçük boy). Thumb boyutları alanda tanımlı olmalı:
// PocketBase tanımsız boy istendiğinde özgün dosyayı döndürür.

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** 5MB — CLAUDE.md §10 yükleme sınırı. */
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

/** Yüklemeden önce küçültme (lib/image-resize.ts, göçte scripts/migrate-image-files.mjs):
 *  amaca göre en uzun kenar (px) ve WebP kalitesi. Logo küçük çerçevelerde,
 *  kapak tam genişlikte gösterilir; ürün detayı tam ekran açıldığı için ürün büyük. */
export const IMAGE_PRESETS = {
  logo: { maxEdge: 512, quality: 0.9 },
  cover: { maxEdge: 1920, quality: 0.82 },
  product: { maxEdge: 1200, quality: 0.82 },
  category: { maxEdge: 800, quality: 0.82 },
  popup: { maxEdge: 1080, quality: 0.82 },
};

/** Küçük boylar. "f" = kırpmadan sığdır: logo yuvarlak/kare çerçevede
 *  object-contain ile de gösterildiği için kırpılmamalı. */
export const IMAGE_THUMBS = {
  logo: "256x256f",
  card: "640x640f",
};

/** Görsel alanları ve göç öncesi karşılıkları (`legacy`: düz URL metni;
 *  ürünlerde URL dizisi tutan JSON alanı). `urlField`: AI görselinin
 *  bağlantısını tutan metin alanı (yalnızca ürünlerde AI görsel arar). */
export const IMAGE_FIELDS = [
  { collection: "buyur_businesses", field: "logo", legacy: "logo_url", preset: "logo", thumbs: [IMAGE_THUMBS.logo] },
  { collection: "buyur_businesses", field: "cover", legacy: "cover_url", preset: "cover", thumbs: [] },
  { collection: "buyur_categories", field: "image", legacy: "image_url", preset: "category", thumbs: [IMAGE_THUMBS.card] },
  {
    collection: "buyur_products",
    field: "image",
    preset: "product",
    urlField: "image_url",
    legacy: "images",
    legacyArray: true,
    thumbs: [IMAGE_THUMBS.card],
  },
  { collection: "buyur_popups", field: "image", legacy: "image_url", preset: "popup", thumbs: [] },
];

/** AI görseli bağlantısı — düz metin (Wikimedia adresleri uzun olabiliyor). */
export function imageUrlField(name) {
  return { name, type: "text", required: false, min: 0, max: 1000, pattern: "", presentable: false };
}

/** Tek görsellik, herkese açık dosya alanı. */
export function imageField(name, thumbs = []) {
  return {
    name,
    type: "file",
    required: false,
    maxSelect: 1,
    maxSize: IMAGE_MAX_SIZE,
    mimeTypes: IMAGE_MIME_TYPES,
    thumbs,
    protected: false,
  };
}

/** Ürün görselinin dosya adı kategori + ürün adından: MinIO'da ve adreste
 *  "ana-yemekler-izgara-kofte_<ek>.webp" olarak okunur. */
export function productImageLabel(categoryName, productName) {
  return [categoryName, productName].filter((part) => String(part ?? "").trim()).join(" ");
}

/** Koleksiyonun görsel alanları (kurulum scriptinde alan listesine eklenir). */
export function imageFieldsFor(collection) {
  return IMAGE_FIELDS.filter((spec) => spec.collection === collection).flatMap((spec) =>
    spec.urlField ? [imageField(spec.field, spec.thumbs), imageUrlField(spec.urlField)] : [imageField(spec.field, spec.thumbs)]
  );
}

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Baytların gerçek görsel türü (izinli türlerden biri değilse null). Uzak
 *  sunucunun Content-Type başlığına güvenilmez: yanlış/eksik gelebilir. */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ascii = (start, end) => String.fromCharCode(...b.subarray(start, end));
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

const TR_MAP = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u" };

/** Depoda okunaklı dosya adı: "Izgara Köfte" + image/jpeg → "izgara-kofte.jpg".
 *  PocketBase adın sonuna rastgele ek koyar; çakışma olmaz. Ad boşsa yedek.
 *  Adres biçimi PocketBase'indir (/api/files/<koleksiyon>/<kayıt>/<dosya>);
 *  okunaklılık yalnızca dosya adından gelir. */
export function imageFileName(label, mimeType, fallback = "gorsel") {
  const base = String(label ?? "")
    .replace(/[çğıİöşü]/g, (ch) => TR_MAP[ch])
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${base || fallback}.${EXT_BY_TYPE[mimeType] ?? "jpg"}`;
}
