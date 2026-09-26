"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/lib/upload";
import { Button, Modal, Spinner } from "@/components/panel/ui";
import { ImageIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { searchImageCandidates } from "@/lib/ai/find-image";
import { IMAGE_PROVIDERS, PROVIDER_LABELS, toStoredImage } from "@/lib/ai/image-source";
import type { ImageCandidate, ProductImageSource } from "@/lib/ai/image-source";

// Ürün görseli seçici: açık lisanslı kaynaklardan arar, kullanıcı değiştirebilir,
// yeniden aratabilir veya kendi görselini yükleyebilir.
//
// Sonuçlar modalda gösterilir: satır arasına sıkışmış küçük ızgarada görselin
// neye benzediği anlaşılmıyordu — seçim görsele bakarak yapılan bir karar.
//
// Seçilen görsel sağlayıcının kendi adresiyle kaydedilir; kaynak ve lisans
// künyesi `onChange`'in ikinci parametresiyle çağırana geçer.
// Arama başarısız olursa hiçbir şey engellenmez — ürün görselsiz oluşur.

// Seçici çeşitlilik göstermeli; otomatik akıştaki 8 aday burada az kalır.
const PICKER_LIMIT = 24;

export function ImagePicker({
  businessId,
  productName,
  categoryName,
  value,
  onChange,
  onClose,
}: {
  businessId: string;
  productName: string;
  categoryName: string;
  value: string;
  onChange: (url: string, source: ProductImageSource | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(productName);
  const [images, setImages] = useState<ImageCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState<"all" | ImageCandidate["provider"]>("all");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    search(productName);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(term: string) {
    setLoading(true);
    setFailed(false);
    const result = await searchImageCandidates(businessId, term, categoryName, undefined, PICKER_LIMIT);
    if (!alive.current) return;
    setImages(result.images);
    setSource("all");
    setConfigured(result.configured);
    setLoading(false);
    setSearched(true);
  }

  /** Seçilen adayın adresi ve künyesi ürüne yazılır. Adres bilinen bir
   *  sağlayıcıya ait değilse seçim uygulanmaz. */
  function handlePick(candidate: ImageCandidate) {
    const stored = toStoredImage(candidate);
    if (!stored) {
      setFailed(true);
      return;
    }
    onChange(stored.url, stored.source);
    onClose();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file, businessId, "product", productName);
      // Kendi görselinde dış kaynak künyesi olmaz.
      onChange(url, null);
      onClose();
    } catch {
      // Yükleme hatası akışı durdurmaz; kullanıcı görselsiz devam edebilir.
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={productName.trim() === "" ? "Görsel seç" : `Görsel seç · ${productName}`}
      description="Yalnızca ticari kullanıma açık, lisansı belirtilmiş görseller listelenir."
      footer={
        <>
          <label className="mr-auto inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-wider transition-colors hover:border-paprika hover:text-paprika">
            <ImageIcon size={15} />
            {uploading ? "Yükleniyor…" : "Kendi görselim"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>
          {value && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                onChange("", null);
                onClose();
              }}
            >
              <TrashIcon size={15} /> Görseli kaldır
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Kapat
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search(query);
            }
          }}
          placeholder="Görsel ara"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-paprika"
        />
        <Button type="button" variant="outline" onClick={() => search(query)} disabled={loading}>
          <SearchIcon size={15} /> Ara
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-ink-soft">
          <Spinner className="h-6 w-6 text-paprika" />
          Görseller aranıyor…
        </div>
      )}

      {!loading && !configured && (
        <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
          Otomatik görsel arama yapılandırılmamış. Kendi görselinizi yükleyebilirsiniz.
        </p>
      )}

      {!loading && configured && searched && images.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
          Bu ürün için ticari kullanıma açık görsel bulunamadı. Aramayı değiştirin veya kendi görselinizi
          yükleyin.
        </p>
      )}

      {!loading && images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", ...IMAGE_PROVIDERS.filter((p) => images.some((i) => i.provider === p))] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSource(p)}
              className={`rounded-md border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                source === p ? "border-paprika bg-paprika text-paper" : "border-line text-ink-soft hover:border-paprika"
              }`}
            >
              {p === "all" ? `Tümü · ${images.length}` : `${PROVIDER_LABELS[p]} · ${images.filter((i) => i.provider === p).length}`}
            </button>
          ))}
        </div>
      )}

      {!loading && images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.filter((i) => source === "all" || i.provider === source).map((image) => {
            const selected = value === image.url;
            return (
              <button
                key={`${image.provider}-${image.id}`}
                type="button"
                onClick={() => handlePick(image)}
                title={`${PROVIDER_LABELS[image.provider]}${image.authorName ? ` · ${image.authorName}` : ""} · ${image.license.name}`}
                className={`group relative overflow-hidden rounded-md border-2 text-left transition-all ${
                  selected
                    ? "border-paprika shadow-[0_0_0_3px_rgba(232,73,31,0.15)]"
                    : "border-line hover:border-paprika"
                }`}
              >
                <div className="relative aspect-square bg-crema">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {image.license.attributionRequired && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink/75 px-1.5 py-0.5 text-[9px] font-semibold text-paper">
                      Lisans gerekli
                    </span>
                  )}
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 rounded-md bg-paprika px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-paper">
                      Seçili
                    </span>
                  )}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-ink/70 py-1.5 font-mono text-[11px] uppercase tracking-wider text-paper opacity-0 transition-opacity group-hover:opacity-100">
                    Bu görseli seç
                  </span>
                </div>
                <div className="truncate px-2 py-1.5 text-[10px] leading-tight text-ink-soft">
                  {PROVIDER_LABELS[image.provider]}
                  {image.authorName ? ` · ${image.authorName}` : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {failed && (
        <p className="mt-4 text-sm text-paprika-deep">
          Görsel eklenemedi. Başka bir görsel seçin veya kendi görselinizi yükleyin.
        </p>
      )}

      <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-soft">
        <strong className="font-semibold">Lisans gerekli</strong> işaretli görsellerde fotoğrafçı ve lisans
        bilgisi menünüzde otomatik gösterilir; sizin yapmanız gereken bir şey yok.
      </p>
    </Modal>
  );
}

/** Otomatik bulunan görselin kaynak/lisans künyesi. Lisans zorunlu tuttuğunda
 *  (CC BY ailesi) fotoğrafçı adı ve kaynak bağlantısı gösterilir. */
export function ImageSourceNote({ source }: { source: ProductImageSource }) {
  return (
    <p className="text-[11px] leading-relaxed text-ink-soft">
      Kaynak:{" "}
      {source.source_url ? (
        <a href={source.source_url} target="_blank" rel="noreferrer noopener" className="underline">
          {PROVIDER_LABELS[source.provider] ?? source.provider}
        </a>
      ) : (
        (PROVIDER_LABELS[source.provider] ?? source.provider)
      )}
      {source.author_name && ` · ${source.author_name}`} ·{" "}
      {source.license_url ? (
        <a href={source.license_url} target="_blank" rel="noreferrer noopener" className="underline">
          {source.license_name}
        </a>
      ) : (
        source.license_name
      )}
      {source.attribution_required && (
        <>
          <br />
          Bu lisans künye ister — fotoğrafçı ve lisans bilgisi menünüzde otomatik gösterilir.
        </>
      )}
    </p>
  );
}
