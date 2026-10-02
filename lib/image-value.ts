import { msg } from "@/lib/ui-i18n";
import { IMAGE_MAX_SIZE, IMAGE_MIME_TYPES, imageFileName } from "@/scripts/image-schema.mjs";
import { IMAGE_SOURCE_MAX_SIZE, resizeImage, type ImagePreset } from "@/lib/image-resize";

// Panel formlarında görsel alanının değeri. Düz metindir ki taslağa
// (lib/use-draft.ts) ve "kaydedilmemiş değişiklik" karşılaştırmasına girsin:
//
//   ""           → görsel yok (kayıtta dosya varsa kaydet'te silinir;
//                  PocketBase dosyayı depodan da kaldırır)
//   "blob:…"     → bu oturumda seçilmiş, küçültülmüş, henüz kaydedilmemiş dosya
//   "https://…"  → AI'ın bulduğu görselin bağlantısı (yalnızca ürün); olduğu
//                  gibi metin alanına yazılır, indirilmez
//   diğer        → kayıttaki mevcut dosyanın adı (değişmedi)
//
// Görsel seçilince hemen yüklenmez: yarım bırakılan form canlı menüye bir şey
// yazmasın (CLAUDE.md §8). Dosya kayıtla birlikte, kullanıcının kendi
// yetkisiyle gider; tür/boyut sınırını PocketBase alanı da uygular.

const staged = new Map<string, File>();

export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",");

/** Seçilen dosyayı amacına göre küçültüp forma alır. Tür ya da boyut uygun
 *  değilse, ya da dosya okunamazsa hata metni döner. */
export async function stageImageFile(file: File, preset: ImagePreset): Promise<{ value: string } | { error: string }> {
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return { error: msg("Sadece görsel dosyaları yüklenebilir (jpg, png, webp, gif, avif).") };
  }
  if (file.size > IMAGE_SOURCE_MAX_SIZE) {
    return { error: msg("Dosya en fazla 25MB olabilir.") };
  }
  let ready: File;
  try {
    ready = await resizeImage(file, preset);
  } catch {
    return { error: msg("Görsel okunamadı, başka bir dosya deneyin.") };
  }
  if (ready.size > IMAGE_MAX_SIZE) {
    return { error: msg("Görsel küçültüldükten sonra da 5MB'ı aşıyor, daha küçük bir dosya deneyin.") };
  }
  const value = URL.createObjectURL(ready);
  staged.set(value, ready);
  return { value };
}

const isRemote = (value: string) => /^https:\/\//i.test(value);
const isBlob = (value: string) => value.startsWith("blob:");

/** Ekranda gösterilecek adres. `storedUrl` kayıttaki dosya adını adrese çevirir. */
export function imagePreviewUrl(value: string, storedUrl: (fileName: string) => string): string {
  if (!value) return "";
  if (isBlob(value)) return staged.has(value) ? value : "";
  if (isRemote(value)) return value;
  return storedUrl(value);
}

/** Önceki oturumdan kalan taslakta seçilmiş dosya artık yoktur (blob adresi
 *  sayfa kapanınca ölür): taslak uygulanırken kayıtlı görsel korunur. */
export function restoreImageValue(value: string, saved: string): string {
  return isBlob(value) && !staged.has(value) ? saved : value;
}

/** Kayıttaki görselin form değeri: dosya varsa dosya adı, yoksa AI bağlantısı. */
export function imageValueOf(fileName: string | undefined, url?: string): string {
  return fileName || url || "";
}

/**
 * Kaydet anında kayda yazılacak görsel alanları. Yalnızca değişen gider:
 *   yeni dosya → { dosya: File, bağlantı: "" }     (eski dosya PocketBase'de silinir)
 *   AI bağlantısı → { dosya: "", bağlantı: url }  (varsa yüklenmiş dosya silinir)
 *   kaldır → { dosya: "", bağlantı: "" }
 *   değişmedi → {}
 * `urlField` yoksa (logo, kapak, kategori, pop-up) bağlantı yazılmaz.
 */
export function imagePatch(value: string, label: string, fileField: string, urlField?: string): Record<string, File | string> {
  const withUrl = (url: string) => (urlField ? { [urlField]: url } : {});
  if (value === "") return { [fileField]: "", ...withUrl("") };
  if (isBlob(value)) {
    const file = staged.get(value);
    if (!file) return {};
    return { [fileField]: new File([file], imageFileName(label, file.type), { type: file.type }), ...withUrl("") };
  }
  if (isRemote(value)) return urlField ? { [fileField]: "", [urlField]: value } : {};
  return {};
}
