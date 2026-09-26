"use client";

import { useState } from "react";
import { uploadFile, type UploadKind } from "@/lib/upload";
import { Spinner } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";

// Tek görsel yükleyici — her yerde resim tekildir, çoklu ekleme yoktur.
// Yükleme sırasında loader gösterir; hazır görselin üstünde "değiştir"/"kaldır" sunar.
export function ImageUploader({
  value,
  onChange,
  businessId,
  kind,
  name,
  aspect = "aspect-square",
  className = "",
}: {
  value: string;
  onChange: (url: string) => void;
  businessId: string;
  kind: UploadKind;
  /** Dosya adında kullanılacak içerik adı (ürün/kategori/pop-up adı). */
  name?: string;
  aspect?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(false);
    try {
      const url = await uploadFile(file, businessId, kind, name);
      onChange(url);
      toast("Görsel yüklendi");
    } catch {
      setError(true);
      toast("Görsel yüklenemedi, tekrar dene.", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange("");
    toast("Görsel kaldırıldı");
  }

  return (
    <div>
      <div className={`relative w-full overflow-hidden rounded-md border border-dashed border-line bg-crema/30 ${aspect} ${className}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-soft">Görsel yok</div>
        )}

        {/* Yükleme loader'ı */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <Spinner className="h-7 w-7 text-paper" />
          </div>
        )}

        {/* Kaldır: resmin sağ üstünde çarpı butonu */}
        {value && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Görseli kaldır"
            title="Görseli kaldır"
            className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-ink/70 text-paper shadow-sm backdrop-blur-sm transition-colors hover:bg-paprika"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}

        {/* Tıklanınca dosya seçtiren katman */}
        {!uploading && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/0 text-transparent transition-colors hover:bg-ink/40 hover:text-paper">
            <span className="font-mono text-[11px] uppercase tracking-wider">{value ? "Değiştir" : "Görsel yükle"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files)}
            />
          </label>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-paprika-deep">Yüklenemedi, tekrar dene.</p>}
    </div>
  );
}
