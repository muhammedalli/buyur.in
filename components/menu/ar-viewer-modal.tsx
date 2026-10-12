"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  CheckCircleIcon,
  PlusIcon,
  QrIcon,
  RotateCcwIcon,
  XIcon,
} from "@/components/icons";
import { productArGlbUrl, productArUsdzUrl, productImageUrl } from "@/lib/files";
import { formatPrice } from "@/lib/format";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { Product } from "@/lib/types";

interface ArViewerModalProps {
  product: Product;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: () => void;
  onTrackArView?: () => void;
  locale?: string;
}

/** Spatial AR İkonu: Viewfinder köşe parantezleri içinde izometrik küp */
function SpatialArIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="m12 7 5 3-5 3-5-3 5-3Z" />
      <path d="M7 10v4l5 3 5-3v-4" />
    </svg>
  );
}

/** 1:1 Hassas Ölçek İkonu (Cetvel / Boyut) */
function RulerScaleIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m21.3 8.7-5-5a2 2 0 0 0-2.8 0L3.2 14a2 2 0 0 0 0 2.8l5 5a2 2 0 0 0 2.8 0l10.3-10.3a2 2 0 0 0 0-2.8Z" />
      <path d="m7.5 10.5 2 2" />
      <path d="m10.5 7.5 2 2" />
      <path d="m13.5 4.5 2 2" />
    </svg>
  );
}

/** Doğal Işık & Gölge İkonu */
function AmbientLightIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/** Canlı Kamera İkonu */
function LiveViewIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function ArViewerModal({
  product,
  productName,
  isOpen,
  onClose,
  onAddToCart,
  onTrackArView,
}: ArViewerModalProps) {
  const [mounted, setMounted] = useState(false);
  const modelViewerRef = useRef<any>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadPercent, setLoadPercent] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  // Gövde kaydırmasını kilitler
  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const glbUrl = productArGlbUrl(product);
  const usdzUrl = productArUsdzUrl(product);
  const imageUrl = productImageUrl(product, "full");
  const onlyUsdz = !glbUrl && Boolean(usdzUrl);

  // Cihaz algılama ve model-viewer dinamik yükleme
  useEffect(() => {
    if (!isOpen) return;

    const isMobDevice =
      typeof navigator !== "undefined" &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640;
    const mob = isMobDevice || isSmallScreen;

    const ios =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    setIsMobile(mob);
    setIsIos(ios);

    if (onlyUsdz) {
      setModelLoaded(true);
      setLoadError(false);
    } else if (glbUrl) {
      setModelLoaded(false);
      setLoadError(false);
      setLoadPercent(0);

      import("@google/model-viewer").catch((err) =>
        console.error("model-viewer yüklenemedi:", err)
      );
    }

    // Masaüstünde QR Kod üretimi
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("ar", "1");
      QRCode.toDataURL(currentUrl.toString(), {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [isOpen, onlyUsdz, glbUrl]);

  // Model Viewer olay dinleyicileri (GLB varsa)
  useEffect(() => {
    if (!isOpen || onlyUsdz || !glbUrl) return;
    const el = modelViewerRef.current;
    if (!el) return;

    const timeout = setTimeout(() => {
      setModelLoaded((loaded) => {
        if (!loaded) setLoadError(true);
        return loaded;
      });
    }, 15000);

    const handleLoad = () => {
      clearTimeout(timeout);
      setModelLoaded(true);
      setLoadError(false);
    };

    const handleError = () => {
      clearTimeout(timeout);
      setLoadError(true);
    };

    const handleProgress = (event: any) => {
      const pct = Math.round((event.detail?.totalProgress ?? 0) * 100);
      setLoadPercent(pct);
    };

    const handleArStatus = (event: any) => {
      if (event.detail?.status === "session-started") {
        onTrackArView?.();
      }
    };

    el.addEventListener("load", handleLoad);
    el.addEventListener("error", handleError);
    el.addEventListener("progress", handleProgress);
    el.addEventListener("ar-status", handleArStatus);

    return () => {
      clearTimeout(timeout);
      el.removeEventListener("load", handleLoad);
      el.removeEventListener("error", handleError);
      el.removeEventListener("progress", handleProgress);
      el.removeEventListener("ar-status", handleArStatus);
    };
  }, [isOpen, onlyUsdz, glbUrl, onTrackArView]);

  if (!isOpen || !mounted) return null;

  function triggerAr() {
    onTrackArView?.();

    if (isIos && usdzUrl) {
      const anchor = document.createElement("a");
      anchor.setAttribute("rel", "ar");
      anchor.setAttribute("href", usdzUrl);
      const img = document.createElement("img");
      anchor.appendChild(img);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return;
    }

    if (!isMobile) {
      setShowQr(true);
      return;
    }

    const el = modelViewerRef.current;
    if (el && typeof el.activateAR === "function") {
      el.activateAR();
    }
  }

  function handleResetCamera() {
    const el = modelViewerRef.current;
    if (el) {
      el.cameraOrbit = "0deg 75deg 105%";
      el.resetTurntable?.();
    }
  }

  // createPortal ile doğrudan document.body'ye bağlanarak menü stacking context'inden ve bottom-nav'dan bağımsızlaşır.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-full sm:max-w-md max-h-[92dvh] sm:max-h-[86vh] rounded-t-[2.25rem] sm:rounded-3xl border-t sm:border border-white/[0.12] bg-[#0e0f13] text-white shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`${productName} Artırılmış Gerçeklik (AR) Görünümü`}
      >
        {/* Üst kenar ortam ışıması */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

        {/* Mobil çekme tutamacı (Pull Handle) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Başlık Çubuğu */}
        <div className="relative z-20 flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-white/[0.02] backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {imageUrl && !imageBroken ? (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-neutral-900 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-white shadow-inner">
                <SpatialArIcon size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-white">{productName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs font-semibold text-amber-300/90">{formatPrice(product.price)}</span>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  1:1 Boyut
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isMobile && (
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                title="Telefonda Aç (QR Kod)"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white active:scale-95"
              >
                <QrIcon size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white active:scale-95"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* 3D Sahne ve Görsel Alanı */}
        <div className="relative flex-1 min-h-[290px] sm:min-h-[340px] w-full overflow-hidden select-none flex items-center justify-center bg-radial from-white/[0.05] via-transparent to-transparent">
          {onlyUsdz ? (
            /* Apple USDZ / Mekânsal AR Tanıtım Sahnesi */
            <div className="flex flex-col items-center justify-center p-5 sm:p-6 text-center max-w-sm mx-auto w-full">
              {/* Mekânsal AR Sahnesi (Pedestal + Reticle) */}
              <div className="relative my-2 flex items-center justify-center">
                {/* Sıcak Işık Lekesi / Ambient Glow */}
                <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-amber-500/25 via-rose-500/15 to-transparent blur-2xl pointer-events-none opacity-80" />

                {/* Konsantrik LiDAR / Radar Takip Halkaları */}
                <div className="absolute h-48 w-48 sm:h-52 sm:w-52 rounded-full border border-dashed border-white/15 pointer-events-none animate-[spin_40s_linear_infinite]" />
                <div className="absolute h-40 w-40 sm:h-44 sm:w-44 rounded-full border border-white/10 pointer-events-none" />

                {/* Kamera Hedefleme Köşe Parantezleri (Reticle) */}
                <div className="absolute h-36 w-36 sm:h-40 sm:w-40 pointer-events-none">
                  <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/50 rounded-tl" />
                  <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/50 rounded-tr" />
                  <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/50 rounded-bl" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/50 rounded-br" />
                </div>

                {imageUrl && !imageBroken ? (
                  /* Gerçek Ürün Sunumu: Yüzen Tabak */
                  <div className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-full overflow-hidden border-2 border-white/25 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.95)] bg-neutral-900 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={productName}
                      onError={() => setImageBroken(true)}
                      className="h-full w-full object-cover select-none transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Yüzey Cam Işıltısı */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                  </div>
                ) : (
                  /* Görsel Yoksa: Mekânsal Hologram Kaidesi */
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                    <SpatialArIcon size={44} className="text-white drop-shadow-lg" />
                  </div>
                )}

                {/* 1:1 Boyut Rozeti */}
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-[#121318]/90 backdrop-blur-md border border-white/20 px-3 py-1 shadow-lg text-[11px] font-semibold text-white whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>1:1 Birebir Porsiyon</span>
                </div>
              </div>

              {/* Açıklama ve Başlık */}
              <div className="mt-4 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                  <SpatialArIcon size={13} className="text-amber-300" />
                  <span>Artırılmış Gerçeklik (AR)</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed max-w-xs mx-auto">
                  {isIos
                    ? "Porsiyonu, sunumu ve tabağın gerçek boyutunu sipariş öncesi masanızda inceleyin."
                    : isMobile
                    ? "Bu 3D model Apple iPhone / iPad artırılmış gerçeklik deneyimi için optimize edilmiştir."
                    : "Telefonunuzun kamerasıyla aşağıdaki QR kodu taratarak masanızda görebilirsiniz."}
                </p>
              </div>

              {/* Özellik Rozetleri */}
              <div className="mt-3.5 flex flex-wrap justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
                  <RulerScaleIcon size={13} className="text-amber-300" />
                  <span>1:1 Gerçek Boyut</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
                  <LiveViewIcon size={13} className="text-sky-300" />
                  <span>Canlı Kamera</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
                  <AmbientLightIcon size={13} className="text-emerald-300" />
                  <span>Doğal Işık & Gölge</span>
                </div>
              </div>

              {/* QR Kod yalnızca masaüstünde gösterilir */}
              {!isMobile && qrDataUrl && (
                <div className="mt-3 rounded-2xl bg-white p-3 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Masada Gör QR" className="h-32 w-32 rounded-xl" />
                  <p className="mt-1 text-[10px] text-black/60 font-medium">iPhone kamerasıyla okutun</p>
                </div>
              )}
            </div>
          ) : (
            /* GLB Dosyası Mevcut: Canlı Web 3D Model Görüntüleyici */
            <>
              {!modelLoaded && !loadError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0e0f13]/85 backdrop-blur-md">
                  <div className="relative flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full border-2 border-white/15 border-t-white animate-spin" />
                    <SpatialArIcon size={18} className="absolute text-white/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold tracking-wide text-white">3D Model Hazırlanıyor</p>
                    <p className="mt-0.5 text-[11px] text-white/50 font-mono">
                      {loadPercent > 0 ? `%${loadPercent} indirildi` : "Yükleniyor…"}
                    </p>
                  </div>
                </div>
              )}

              {loadError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 p-6 text-center">
                  <p className="text-sm font-semibold text-rose-400">3D model yüklenemedi</p>
                  <p className="text-xs text-white/50 max-w-xs">
                    Dosya boyutu büyük olabilir veya bağlantı zaman aşımına uğradı.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadError(false);
                      setModelLoaded(false);
                      const el = modelViewerRef.current;
                      if (el && glbUrl) el.src = glbUrl;
                    }}
                    className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}

              <model-viewer
                ref={modelViewerRef}
                src={glbUrl || undefined}
                ios-src={usdzUrl || undefined}
                alt={productName}
                ar
                ar-modes="scene-viewer quick-look webxr"
                ar-scale="auto"
                camera-controls
                auto-rotate
                rotation-per-second="20deg"
                shadow-intensity="1.3"
                shadow-softness="0.75"
                exposure="1.05"
                loading="eager"
                reveal="auto"
                interaction-prompt="auto"
                touch-action="pan-y"
                style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
              />

              {modelLoaded && (
                <>
                  <button
                    type="button"
                    onClick={handleResetCamera}
                    title="Açıyı Sıfırla"
                    className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-md transition-all hover:bg-black/80 hover:text-white active:scale-95 shadow-lg"
                  >
                    <RotateCcwIcon size={12} />
                    <span>Açıyı Sıfırla</span>
                  </button>

                  <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/15 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-md shadow-lg">
                    <span>360° Çevirip İnceleyin</span>
                  </div>
                </>
              )}
            </>
          )}

          {/* Masaüstü QR Kod Katmanı */}
          {showQr && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-xl animate-fade-in text-center">
              <div className="rounded-3xl bg-white p-4 shadow-2xl">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Masada Gör QR" className="h-52 w-52 rounded-2xl" />
                ) : (
                  <div className="flex h-52 w-52 items-center justify-center text-xs text-black/50">
                    QR kod üretiliyor…
                  </div>
                )}
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">Telefonunuzla Tarayın</h3>
              <p className="mt-1 max-w-xs text-xs text-white/60">
                iPhone veya Android kameranızı doğrultun. Yemek masanızda 1:1 gerçek boyutuyla açılsın.
              </p>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="mt-4 rounded-full bg-white/10 px-5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Geri Dön
              </button>
            </div>
          )}
        </div>

        {/* Alt Eylem Çubuğu */}
        <div className="relative z-20 border-t border-white/[0.08] px-5 py-4 bg-[#0e0f13] shrink-0 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          <div className="flex items-center gap-2.5">
            {isIos && usdzUrl ? (
              <a
                href={usdzUrl}
                rel="ar"
                onClick={() => onTrackArView?.()}
                className="group relative flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 px-4 font-bold text-neutral-950 shadow-[0_4px_24px_rgba(255,255,255,0.22)] transition-all duration-200 active:scale-[0.98] hover:bg-neutral-100 hover:shadow-[0_6px_28px_rgba(255,255,255,0.3)]"
              >
                {/* iOS Safari Quick Look için gereklidir */}
                <img
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
                  alt=""
                  className="hidden"
                  aria-hidden="true"
                />
                <SpatialArIcon size={19} className="text-neutral-950 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold tracking-tight">Masada Gör</span>
              </a>
            ) : glbUrl ? (
              <button
                type="button"
                onClick={triggerAr}
                className="group relative flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 px-4 font-bold text-neutral-950 shadow-[0_4px_24px_rgba(255,255,255,0.22)] transition-all duration-200 active:scale-[0.98] hover:bg-neutral-100 hover:shadow-[0_6px_28px_rgba(255,255,255,0.3)]"
              >
                <SpatialArIcon size={19} className="text-neutral-950 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold tracking-tight">Masada Gör</span>
              </button>
            ) : !isIos && isMobile ? (
              <div className="flex-1 py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-white/60">
                Apple (iOS) cihazı gereklidir
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowQr(true)}
                className="group relative flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 px-4 font-bold text-neutral-950 shadow-[0_4px_24px_rgba(255,255,255,0.22)] transition-all duration-200 active:scale-[0.98] hover:bg-neutral-100 hover:shadow-[0_6px_28px_rgba(255,255,255,0.3)]"
              >
                <QrIcon size={18} />
                <span className="text-sm font-bold tracking-tight">Masada Gör (QR)</span>
              </button>
            )}

            {onAddToCart && (
              <button
                type="button"
                onClick={() => {
                  onAddToCart();
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1200);
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  added
                    ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                    : "bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                }`}
              >
                {added ? (
                  <>
                    <CheckCircleIcon size={16} strokeWidth={2.4} />
                    <span>Eklendi</span>
                  </>
                ) : (
                  <>
                    <PlusIcon size={16} strokeWidth={2.2} />
                    <span>Sepet</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-white/45">
            {isIos
              ? "Kameranız açılarak tabağı masanıza 1:1 gerçek boyutta yerleştirecektir."
              : isMobile && glbUrl
              ? "Kameranız açılarak tabağı masanıza 1:1 gerçek boyutta yerleştirecektir."
              : !isMobile
              ? "Modeli çevirmek için fareyle sürükleyin, telefonunuzda açmak için QR kodu tarayın."
              : "Bu model Apple iOS cihazlarında artırılmış gerçeklik destekler."}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

