import { IMAGE_MAX_SIZE, IMAGE_PRESETS } from "@/scripts/image-schema.mjs";

// Yüklenen görseli tarayıcıda küçültür — MinIO'ya telefonun 12 MP'lik
// fotoğrafı değil, menüde gösterilecek boyutu gider. Menü mobilde 2 sn
// bütçesiyle açılır (CLAUDE.md §11); küçük dosya hem yüklemeyi hem menüyü
// hızlandırır. Listelerdeki daha küçük boyları PocketBase thumb'ı üretir.
//
// Kurallar:
//   · En uzun kenar amaca göre sınırlanır (IMAGE_PRESETS), oran korunur,
//     küçük görsel büyütülmez.
//   · Çıktı WebP (saydamlığı korur, JPEG'den küçük). Tarayıcı WebP
//     kodlayamıyorsa JPEG; saydamlığı olabilecek kaynakta (PNG/WebP/AVIF) PNG.
//   · Telefon fotoğrafının yönü (EXIF) uygulanır, yan yatmaz.
//   · GIF olduğu gibi kalır (kanvas animasyonu öldürür).
//   · Küçültülmüş dosya özgünden büyük çıkarsa ve özgün zaten sınırların
//     içindeyse özgün kullanılır.

/** Amaca göre küçültme ölçüleri — tek kaynak scripts/image-schema.mjs. */
export { IMAGE_PRESETS };
export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** Küçültmeye girebilecek en büyük kaynak — telefon fotoğrafları rahat sığar,
 *  bellek patlamaz. Sonuç yine IMAGE_MAX_SIZE altında olmalı. */
export const IMAGE_SOURCE_MAX_SIZE = 25 * 1024 * 1024;

/** Oranı koruyarak en uzun kenarı sınıra indirir; küçük görsel büyütülmez. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Kaynak saydamlık taşıyabilir mi (JPEG'e çevrilirse arka plan kararır). */
export function mayHaveAlpha(type: string): boolean {
  return type === "image/png" || type === "image/webp" || type === "image/avif" || type === "image/gif";
}

/** Küçültülmüş sonucun mu özgünün mü kullanılacağı. Özgün yalnızca boyut
 *  sınırının içinde, desteklenen türde ve küçültülmüşten küçükse kalır. */
export function preferOriginal(original: { size: number; width: number; height: number }, resizedSize: number, maxEdge: number): boolean {
  const withinEdge = Math.max(original.width, original.height) <= maxEdge;
  return withinEdge && original.size <= IMAGE_MAX_SIZE && original.size <= resizedSize;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    // "from-image": telefonun EXIF yön bilgisi uygulanır.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Görseli amacına göre küçültür. Tarayıcı dışında (test, eski tarayıcı) ya da
 * GIF'te özgün dosyayı döndürür; çözülemeyen dosyada hata fırlatır.
 */
export async function resizeImage(file: File, preset: ImagePreset): Promise<File> {
  if (file.type === "image/gif" || typeof document === "undefined") return file;
  const { maxEdge, quality } = IMAGE_PRESETS[preset];

  const decoded = await decode(file);
  try {
    const target = fitWithin(decoded.width, decoded.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, target.width, target.height);

    let blob = await canvasToBlob(canvas, "image/webp", quality);
    // WebP kodlayamayan tarayıcı sessizce PNG döndürür.
    if (!blob || blob.type !== "image/webp") {
      blob = mayHaveAlpha(file.type) ? await canvasToBlob(canvas, "image/png", 1) : await canvasToBlob(canvas, "image/jpeg", quality);
    }
    if (!blob) return file;

    if (preferOriginal({ size: file.size, width: decoded.width, height: decoded.height }, blob.size, maxEdge)) return file;
    return new File([blob], file.name, { type: blob.type });
  } finally {
    decoded.close();
  }
}
