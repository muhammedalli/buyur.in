import { msg } from "@/lib/ui-i18n";

// Panel formlarında 3D AR model alanlarının (GLB ve USDZ) durumu ve yönetimi.
// Değer formatı (lib/image-value.ts ile uyumlu):
//   ""          → model yok / kaldırıldı (kayıtta dosya varsa silinir)
//   "blob:…"    → bu oturumda seçilmiş, henüz kaydedilmemiş yerel dosya
//   diğer       → kayıttaki mevcut dosyanın adı (değişmedi)

export const AR_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const staged = new Map<string, File>();

export function isArBlob(value: string): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}

export function getStagedArFile(blobUrl: string): File | undefined {
  return staged.get(blobUrl);
}

/** Seçilen 3D model dosyasını doğrular ve formda kullanılmak üzere hazırlar. */
export async function stageArFile(
  file: File,
  expectedKind: "glb" | "usdz"
): Promise<{ value: string; sizeFormatted: string } | { error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (expectedKind === "glb" && ext !== "glb") {
    return { error: msg("Lütfen geçerli bir .glb (glTF Binary) dosyası seçin.") };
  }
  if (expectedKind === "usdz" && ext !== "usdz") {
    return { error: msg("Lütfen geçerli bir .usdz (Apple Quick Look) dosyası seçin.") };
  }

  if (file.size > AR_MAX_FILE_SIZE) {
    return { error: msg("3D model dosyası en fazla 50MB olabilir.") };
  }

  // Tarayıcı veya işletim sisteminin USDZ/GLB dosyasını tanımaması ya da
  // sistemde farklı bildirmesi (ör. Mac/Windows'ta application/zip veya boş MIME türü)
  // durumuna karşı, PocketBase ile %100 uyumlu standart MIME türüne normalize ediyoruz.
  const normalizedMime = expectedKind === "usdz" ? "model/vnd.usdz+zip" : "model/gltf-binary";
  const normalizedFile =
    file.type === normalizedMime ? file : new File([file], file.name, { type: normalizedMime });

  const value = URL.createObjectURL(normalizedFile);
  staged.set(value, normalizedFile);

  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  return { value, sizeFormatted: `${sizeMb} MB` };
}

/** Ekranda model-viewer'a verilecek adres. */
export function arModelPreviewUrl(value: string, storedUrl: (fileName: string) => string): string {
  if (!value) return "";
  if (isArBlob(value)) return staged.has(value) ? value : "";
  return storedUrl(value);
}

/** PocketBase kaydına gönderilecek multipart/form-data nesnesi için dosya yaması. */
export function arModelPatch(
  glbValue: string,
  usdzValue: string,
  initialGlb?: string,
  initialUsdz?: string
): Record<string, File | string> {
  const patch: Record<string, File | string> = {};

  // GLB
  if (isArBlob(glbValue)) {
    const file = staged.get(glbValue);
    if (file) patch.ar_model_glb = file;
  } else if (!glbValue && initialGlb) {
    patch.ar_model_glb = "";
  }

  // USDZ
  if (isArBlob(usdzValue)) {
    const file = staged.get(usdzValue);
    if (file) patch.ar_model_usdz = file;
  } else if (!usdzValue && initialUsdz) {
    patch.ar_model_usdz = "";
  }

  return patch;
}
