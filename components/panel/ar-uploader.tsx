"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { CubeIcon, TrashIcon, UploadIcon, CheckCircleIcon, SparklesIcon } from "@/components/icons";
import { stageArFile, arModelPreviewUrl, isArBlob, getStagedArFile } from "@/lib/ar-model-value";
import { useToast } from "@/components/panel/toast";
import { Spinner } from "@/components/panel/ui";
import type { UploadProgress } from "@/lib/pb-upload";

interface ArUploaderProps {
  glbValue: string;
  usdzValue: string;
  enabled: boolean;
  scale: string;
  saving?: boolean;
  uploadProgress?: UploadProgress | null;
  onGlbChange: (val: string) => void;
  onUsdzChange: (val: string) => void;
  onEnabledChange: (val: boolean) => void;
  onScaleChange: (val: string) => void;
  storedGlbUrl: (fileName: string) => string;
  storedUsdzUrl: (fileName: string) => string;
}

const SCALE_PRESETS = [
  { label: "0.8x Küçük (Tatlı / İçecek)", value: "0.8" },
  { label: "1.0x Standart (Ana Yemek / Tabak)", value: "1.0" },
  { label: "1.2x Büyük (Paylaşımlı / Tepsi)", value: "1.2" },
];

export function ArUploader({
  glbValue,
  usdzValue,
  enabled,
  scale,
  saving = false,
  uploadProgress = null,
  onGlbChange,
  onUsdzChange,
  onEnabledChange,
  onScaleChange,
  storedGlbUrl,
  storedUsdzUrl,
}: ArUploaderProps) {
  const { toast } = useToast();
  const [stagingGlb, setStagingGlb] = useState(false);
  const [stagingUsdz, setStagingUsdz] = useState(false);
  const [modelRendering, setModelRendering] = useState(true);
  const [dragOverGlb, setDragOverGlb] = useState(false);
  const [dragOverUsdz, setDragOverUsdz] = useState(false);

  const glbInputRef = useRef<HTMLInputElement>(null);
  const usdzInputRef = useRef<HTMLInputElement>(null);
  const modelViewerRef = useRef<any>(null);

  const previewGlb = arModelPreviewUrl(glbValue, storedGlbUrl);
  const previewUsdz = arModelPreviewUrl(usdzValue, storedUsdzUrl);

  const stagedGlbFile = isArBlob(glbValue) ? getStagedArFile(glbValue) : undefined;
  const stagedUsdzFile = isArBlob(usdzValue) ? getStagedArFile(usdzValue) : undefined;

  const isUploadingToServer = saving && (isArBlob(glbValue) || isArBlob(usdzValue) || uploadProgress !== null);

  // model-viewer bileşenini dinamik içe aktar
  useEffect(() => {
    if (previewGlb) {
      setModelRendering(true);
      import("@google/model-viewer").catch(() => {});
    }
  }, [previewGlb]);

  // Model-viewer render olaylarını dinle
  useEffect(() => {
    const el = modelViewerRef.current;
    if (!el) return;

    const handleLoad = () => setModelRendering(false);
    const handleError = () => setModelRendering(false);

    el.addEventListener("load", handleLoad);
    el.addEventListener("error", handleError);

    return () => {
      el.removeEventListener("load", handleLoad);
      el.removeEventListener("error", handleError);
    };
  }, [previewGlb]);

  async function handleFileSelect(file: File, kind: "glb" | "usdz") {
    if (kind === "glb") setStagingGlb(true);
    else setStagingUsdz(true);

    const res = await stageArFile(file, kind);

    if (kind === "glb") setStagingGlb(false);
    else setStagingUsdz(false);

    if ("error" in res) {
      toast(res.error, "error");
      return;
    }

    if (kind === "glb") {
      onGlbChange(res.value);
      if (!enabled) onEnabledChange(true);
      toast(`3D model (.glb) hazırlandı (${res.sizeFormatted}). Kaydet'e basarak sunucuya yükleyebilirsiniz.`, "success");
    } else {
      onUsdzChange(res.value);
      toast(`Apple AR modeli (.usdz) hazırlandı (${res.sizeFormatted}). Kaydet'e basarak sunucuya yükleyebilirsiniz.`, "success");
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, kind: "glb" | "usdz") {
    e.preventDefault();
    if (kind === "glb") setDragOverGlb(false);
    else setDragOverUsdz(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file, kind);
  }

  function formatFileSize(file?: File): string {
    if (!file) return "";
    return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-5 rounded-2xl border border-line/60 bg-paper p-5 sm:p-6 shadow-xs">
      {/* Gerçek Zamanlı Yükleme İlerleme Paneli (Hız, Yüzde, Kalan Süre, Boyut) */}
      {isUploadingToServer && (
        <div className="rounded-2xl border border-herb/30 bg-herb/[0.04] p-4 sm:p-5 shadow-xs space-y-3.5 animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-herb text-paper shadow-sm">
                <UploadIcon size={20} className="animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-sm font-bold text-ink truncate">
                    3D AR Modelleri Sunucuya Yükleniyor
                  </h4>
                  <span className="inline-flex items-center rounded-full bg-herb/15 px-2 py-0.5 text-[11px] font-bold text-herb font-mono shrink-0">
                    {uploadProgress ? `${uploadProgress.percent}%` : "Başlatılıyor"}
                  </span>
                </div>
                <p className="text-xs text-ink-soft mt-0.5">
                  Büyük dosya aktarımı yapılıyor. Lütfen işlem tamamlanana kadar sayfayı kapatmayın.
                </p>
              </div>
            </div>

            {uploadProgress && (
              <div className="hidden sm:flex flex-col items-end shrink-0 font-mono">
                <span className="text-xs font-bold text-ink">
                  {uploadProgress.loadedMb} / {uploadProgress.totalMb}
                </span>
                <span className="text-[11px] text-herb font-semibold">
                  {uploadProgress.speedMb}
                </span>
              </div>
            )}
          </div>

          {/* İlerleme Çubuğu */}
          <div className="space-y-1.5">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-line/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-herb to-emerald-500 transition-all duration-150 ease-out shadow-xs"
                style={{
                  width: `${Math.max(4, uploadProgress?.percent ?? 6)}%`,
                }}
              />
            </div>

            {/* Alt Metrikler */}
            <div className="flex items-center justify-between text-[11px] text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-herb animate-ping" />
                <span className="font-medium text-ink">
                  {uploadProgress?.speedMb ? `Yükleme Hızı: ${uploadProgress.speedMb}` : "Bağlantı kuruluyor…"}
                </span>
              </span>

              <div className="flex items-center gap-3 font-mono">
                <span className="sm:hidden font-medium text-ink">
                  {uploadProgress ? `${uploadProgress.loadedMb} / ${uploadProgress.totalMb}` : ""}
                </span>
                <span className="font-semibold text-ink">
                  {uploadProgress?.remainingSec && uploadProgress.remainingSec > 0
                    ? `Kalan: ~${uploadProgress.remainingSec} sn`
                    : uploadProgress?.percent === 100
                    ? "Sunucuda işleniyor…"
                    : "Hesaplanıyor…"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Başlık ve Aktiflik Düğmesi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper shadow-sm">
            <CubeIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-ink">3D & Artırılmış Gerçeklik (WebAR)</h3>
              <span className="rounded-full bg-herb/10 px-2 py-0.5 font-display text-[11px] font-semibold text-herb">
                Elite
              </span>
            </div>
            <p className="text-xs text-ink-soft">
              Müşterilerin masalarında yemeği 1:1 gerçek boyutta görmesi için 3D model ekleyin (Maks. 50MB).
            </p>
          </div>
        </div>

        {/* Apple Tarzı Toggle Switch */}
        <label className="flex cursor-pointer items-center gap-2.5 self-start sm:self-auto select-none">
          <span className="text-xs font-medium text-ink">Menüde AR ile Göster</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-line peer-checked:bg-herb transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
          </div>
        </label>
      </div>

      {/* İki Dosya Yükleme Alanı: GLB ve USDZ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GLB (Android & Web 3D) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverGlb(true);
          }}
          onDragLeave={() => setDragOverGlb(false)}
          onDrop={(e) => handleDrop(e, "glb")}
          className={`relative rounded-xl border-2 transition-all p-4 ${
            dragOverGlb
              ? "border-herb bg-herb/10 scale-[1.01]"
              : glbValue
              ? "border-herb/40 bg-herb/[0.03]"
              : "border-dashed border-line/80 bg-crema/20 hover:border-ink/30"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                Web & Android Modeli (.glb)
              </span>
              <span className="rounded-full bg-herb/15 px-2 py-0.5 text-[10px] font-semibold text-herb font-display">
                Gerekli
              </span>
            </div>
            {glbValue && (
              <button
                type="button"
                onClick={() => onGlbChange("")}
                className="flex items-center gap-1 text-[11px] text-paprika hover:underline"
              >
                <TrashIcon size={12} />
                <span>Kaldır</span>
              </button>
            )}
          </div>

          {/* Dosya Durumu Göstergesi */}
          {stagingGlb ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <Spinner className="h-6 w-6 text-herb" />
              <p className="text-xs font-medium text-ink">Model hazırlanıyor, lütfen bekleyin…</p>
            </div>
          ) : glbValue ? (
            <div className="space-y-2 rounded-xl border border-herb/30 bg-paper p-3.5 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-herb/15 text-herb">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium text-ink">
                      {stagedGlbFile ? stagedGlbFile.name : glbValue}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {stagedGlbFile ? (
                        <span className="font-semibold text-herb">
                          {formatFileSize(stagedGlbFile)} · Kaydedilmeyi Bekliyor
                        </span>
                      ) : (
                        <span className="text-ink-soft">Sunucuda Kayıtlı Dosya</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => glbInputRef.current?.click()}
                  className="shrink-0 rounded-lg border border-line bg-crema/40 px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-crema"
                >
                  Değiştir
                </button>
              </div>

              {isArBlob(glbValue) && (
                <div className="rounded-lg bg-herb/10 px-2.5 py-1 text-[11px] font-medium text-herb">
                  ● Formu kaydettiğinizde bu dosya sunucuya yüklenecektir.
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={stagingGlb}
              onClick={() => glbInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2.5 rounded-lg py-6 text-center transition-colors hover:bg-crema/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-crema text-ink-soft shadow-2xs">
                <UploadIcon size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">.glb modelini buraya bırakın veya seçin</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Maks. 50MB · glTF Binary</p>
              </div>
            </button>
          )}

          <input
            ref={glbInputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file, "glb");
            }}
            className="hidden"
          />
        </div>

        {/* USDZ (Apple iOS Quick Look) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverUsdz(true);
          }}
          onDragLeave={() => setDragOverUsdz(false)}
          onDrop={(e) => handleDrop(e, "usdz")}
          className={`relative rounded-xl border-2 transition-all p-4 ${
            dragOverUsdz
              ? "border-sky-500 bg-sky-50 scale-[1.01]"
              : usdzValue
              ? "border-sky-500/40 bg-sky-500/[0.03]"
              : "border-dashed border-line/80 bg-crema/20 hover:border-ink/30"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                Apple iOS Quick Look (.usdz)
              </span>
              <span className="rounded-full bg-crema px-2 py-0.5 text-[10px] font-medium text-ink-soft font-display">
                iPhone için
              </span>
            </div>
            {usdzValue && (
              <button
                type="button"
                onClick={() => onUsdzChange("")}
                className="flex items-center gap-1 text-[11px] text-paprika hover:underline"
              >
                <TrashIcon size={12} />
                <span>Kaldır</span>
              </button>
            )}
          </div>

          {/* USDZ Durum Göstergesi */}
          {stagingUsdz ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <Spinner className="h-6 w-6 text-sky-600" />
              <p className="text-xs font-medium text-ink">Apple modeli hazırlanıyor…</p>
            </div>
          ) : usdzValue ? (
            <div className="space-y-2 rounded-xl border border-sky-500/30 bg-paper p-3.5 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium text-ink">
                      {stagedUsdzFile ? stagedUsdzFile.name : usdzValue}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {stagedUsdzFile ? (
                        <span className="font-semibold text-sky-600">
                          {formatFileSize(stagedUsdzFile)} · Kaydedilmeyi Bekliyor
                        </span>
                      ) : (
                        <span className="text-ink-soft">Sunucuda Kayıtlı Dosya</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => usdzInputRef.current?.click()}
                  className="shrink-0 rounded-lg border border-line bg-crema/40 px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-crema"
                >
                  Değiştir
                </button>
              </div>

              {isArBlob(usdzValue) && (
                <div className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                  ● Formu kaydettiğinizde bu dosya sunucuya yüklenecektir.
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={stagingUsdz}
              onClick={() => usdzInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2.5 rounded-lg py-6 text-center transition-colors hover:bg-crema/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-crema text-ink-soft shadow-2xs">
                <UploadIcon size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">.usdz modelini buraya bırakın veya seçin</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Maks. 50MB · Apple Quick Look</p>
              </div>
            </button>
          )}

          <input
            ref={usdzInputRef}
            type="file"
            accept=".usdz,model/vnd.usdz+zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file, "usdz");
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Yalnızca USDZ varken Bilgilendirme Notu */}
      {usdzValue && !glbValue && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3.5 text-ink shadow-2xs">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 font-bold text-xs">
            ℹ
          </div>
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-ink">Apple AR (.usdz) modeli hazır</p>
            <p className="text-ink-soft text-[11px] mt-0.5">
              iPhone kullanıcıları ürünü masada 1:1 AR ile görebilir. Web tarayıcısında ve Android cihazlarda canlı 3D döndürme için sol taraftan <strong>.glb</strong> modelini de yükleyebilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Ölçek Çarpanı (1:1 Gerçek Boyut Ayarı) */}
      <div className="space-y-2 rounded-xl bg-crema/30 p-3.5 border border-line/40">
        <div className="flex items-center justify-between">
          <label className="font-display text-xs font-bold text-ink">Gerçek Ölçek Kalibrasyonu (Scale)</label>
          <span className="font-mono text-xs font-semibold text-ink-soft">{scale || "1.0"}x</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SCALE_PRESETS.map((preset) => {
            const isSelected = (scale || "1.0") === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onScaleChange(preset.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-ink text-paper shadow-xs"
                    : "bg-paper text-ink-soft border border-line/60 hover:bg-paper/80 hover:text-ink"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Canlı 3D Önizleme Kutusu */}
      {previewGlb && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
              <span>Canlı 3D Model Önizlemesi</span>
              {modelRendering && <Spinner className="h-3 w-3 text-ink-soft" />}
            </span>
            <span className="text-[11px] text-ink-soft">Döndürmek için sürükleyin · Yakınlaştırmak için kaydırın</span>
          </div>

          <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-b from-[#1c1c1e] to-[#121214] shadow-inner">
            {modelRendering && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#141416]/70 backdrop-blur-xs">
                <Spinner className="h-7 w-7 text-white" />
                <p className="text-xs font-medium text-white/80">3D Model Yükleniyor & İşleniyor…</p>
              </div>
            )}

            <model-viewer
              ref={modelViewerRef}
              src={previewGlb}
              alt="Model Önizleme"
              camera-controls
              auto-rotate
              rotation-per-second="25deg"
              shadow-intensity="1.2"
              shadow-softness="0.8"
              exposure="1"
              style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** İşletmenin planında AR yetkisi yoksa gösterilen kilit kartı. */
export function ArFeatureLockedCard() {
  return (
    <div className="rounded-2xl border border-line/60 bg-gradient-to-r from-crema/50 to-crema/20 p-5 shadow-xs">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/10 text-ink">
          <CubeIcon size={20} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-sm font-bold text-ink">Masada 3D & Artırılmış Gerçeklik (WebAR)</h4>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Elite Özelliği
            </span>
          </div>
          <p className="text-xs leading-relaxed text-ink-soft">
            Müşterilerinizin menüdeki yemekleri masalarında 1:1 gerçek boyutta görmelerini sağlayın. Bu özellik{" "}
            <strong>Elite</strong> planda aktiftir.
          </p>
          <div className="pt-2">
            <a
              href="/panel/plan"
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 font-display text-xs font-semibold text-paper shadow-sm hover:opacity-90 transition-opacity"
            >
              <SparklesIcon size={13} />
              <span>Elite Plana Geç</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
