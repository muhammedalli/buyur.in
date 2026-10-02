"use client";

import { useState } from "react";
import { IMAGE_ACCEPT, imagePreviewUrl, stageImageFile } from "@/lib/image-value";
import type { ImagePreset } from "@/lib/image-resize";
import { Spinner } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { useUiLocale } from "@/components/ui-locale-provider";

// Tek görsel yükleyici — her yerde resim tekildir, çoklu ekleme yoktur.
// Seçilen dosya amacına göre tarayıcıda küçültülür ve kaydet'e kadar formda
// bekler (lib/image-value.ts); kayıtla birlikte PocketBase dosya alanına
// (MinIO) gider. Hazır görselin üstünde "değiştir"/"kaldır" sunar; kaldırılan
// görsel kaydet'te depodan da silinir.
export function ImageUploader({
  value,
  onChange,
  storedUrl,
  preset,
  aspect = "aspect-square",
  className = "",
}: {
  /** Görsel alanı değeri (bkz. lib/image-value.ts). */
  value: string;
  onChange: (value: string) => void;
  /** Kayıttaki dosya adını adrese çevirir (lib/files.ts). */
  storedUrl: (fileName: string) => string;
  /** Küçültme boyu (lib/image-resize.ts → IMAGE_PRESETS). */
  preset: ImagePreset;
  aspect?: string;
  className?: string;
}) {
  const [preparing, setPreparing] = useState(false);
  const { toast } = useToast();
  const { t } = useUiLocale();
  const preview = imagePreviewUrl(value, storedUrl);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPreparing(true);
    const result = await stageImageFile(file, preset);
    setPreparing(false);
    if ("error" in result) {
      toast(t(result.error), "error");
      return;
    }
    onChange(result.value);
  }

  return (
    <div>
      <div className={`relative w-full overflow-hidden rounded-md border border-dashed border-line bg-crema/30 ${aspect} ${className}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-soft">{t("Görsel yok")}</div>
        )}

        {/* Küçültme sürerken */}
        {preparing && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <Spinner className="h-7 w-7 text-paper" />
          </div>
        )}

        {/* Kaldır: resmin sağ üstünde çarpı butonu */}
        {preview && !preparing && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("Görseli kaldır")}
            title={t("Görseli kaldır")}
            className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-ink/70 text-paper shadow-sm backdrop-blur-sm transition-colors hover:bg-paprika"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}

        {/* Tıklanınca dosya seçtiren katman */}
        {!preparing && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/0 text-transparent transition-colors hover:bg-ink/40 hover:text-paper">
            <span className="text-xs font-medium">{preview ? t("Değiştir") : t("Görsel yükle")}</span>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files);
                // Aynı dosya kaldırılıp yeniden seçilebilsin.
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
