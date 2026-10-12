"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  CameraIcon,
  CheckCircleIcon,
  CubeIcon,
  PlusIcon,
  QrIcon,
  RotateCcwIcon,
  SparklesIcon,
  XIcon,
} from "@/components/icons";
import { productArGlbUrl, productArUsdzUrl } from "@/lib/files";
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

  // Gövde kaydırmasını kilitler
  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const glbUrl = productArGlbUrl(product);
  const usdzUrl = productArUsdzUrl(product);
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
      className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-full sm:max-w-md max-h-[92dvh] sm:max-h-[85vh] rounded-t-[2.25rem] sm:rounded-3xl border-t sm:border border-white/15 bg-[#121316] text-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`${productName} 3D & AR Görünümü`}
      >
        {/* Mobil çekme tutamacı (Pull Handle) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Başlık Çubuğu */}
        <div className="relative z-20 flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-white/[0.03] backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner">
              <CubeIcon size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-white">{productName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  1:1 Boyut
                </span>
                <span className="font-mono text-xs text-white/50">{formatPrice(product.price)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isMobile && (
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                title="Telefonda Aç (QR Kod)"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <QrIcon size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* 3D Sahne ve Görsel Alanı */}
        <div className="relative flex-1 min-h-[280px] sm:min-h-[340px] w-full overflow-hidden select-none flex items-center justify-center bg-radial from-white/[0.04] to-transparent">
          {onlyUsdz ? (
            /* Yalnızca Apple USDZ Yüklüyse: Apple AR Showcase */
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-sm mx-auto">
              {/* Parlayan 3D Küp Hologramı */}
              <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_0_50px_-10px_rgba(255,255,255,0.2)]">
                <CubeIcon size={48} className="text-white drop-shadow-md animate-pulse" />
                <div className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-black shadow-md">
                  <SparklesIcon size={14} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                  <span>Apple iOS Quick Look (AR)</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed max-w-xs">
                  {isIos
                    ? "Model iPhone için hazır. Aşağıdaki butona dokunarak kameranızı açabilir ve yemeği masanızda 1:1 boyutta görebilirsiniz."
                    : isMobile
                    ? "Bu model Apple iPhone / iPad cihazları için hazırlanmıştır."
                    : "Telefonunuzun kamerasıyla aşağıdaki QR kodu taratarak masanızda görebilirsiniz."}
                </p>
              </div>

              {/* Özellik Rozetleri */}
              <div className="flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-white/80">
                  📐 1:1 Gerçek Ölçek
                </span>
                <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-white/80">
                  📷 Canlı Kamera
                </span>
                <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-white/80">
                  ✨ Gerçekçi Işık & Gölge
                </span>
              </div>

              {/* QR Kod yalnızca masaüstünde gösterilir */}
              {!isMobile && qrDataUrl && (
                <div className="mt-2 rounded-2xl bg-white p-3 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Masada Gör QR" className="h-36 w-36 rounded-xl" />
                  <p className="mt-1 text-[10px] text-black/60 font-medium">iPhone kamerasıyla okutun</p>
                </div>
              )}
            </div>
          ) : (
            /* GLB Dosyası Mevcut: Canlı Web 3D Model Görüntüleyici */
            <>
              {!modelLoaded && !loadError && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#121316]/80 backdrop-blur-sm">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <p className="text-xs font-medium tracking-wide text-white/70">
                    {loadPercent > 0 ? `3D Model İndiriliyor… %${loadPercent}` : "3D Model Hazırlanıyor…"}
                  </p>
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
                <button
                  type="button"
                  onClick={handleResetCamera}
                  title="Açıyı Sıfırla"
                  className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
                >
                  <RotateCcwIcon size={14} />
                </button>
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
        <div className="relative z-20 border-t border-white/10 px-5 py-4 bg-[#121316] shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2.5">
            {isIos && usdzUrl ? (
              <a
                href={usdzUrl}
                rel="ar"
                onClick={() => onTrackArView?.()}
                className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 px-4 font-bold text-black shadow-lg transition-all active:scale-[0.98] hover:bg-neutral-100"
              >
                <img
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
                  alt=""
                  className="hidden"
                  aria-hidden="true"
                />
                <CameraIcon size={18} />
                <span className="text-sm font-bold tracking-tight">Masada Gör (Apple AR)</span>
              </a>
            ) : glbUrl ? (
              <button
                type="button"
                onClick={triggerAr}
                className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 px-4 font-bold text-black shadow-lg transition-all active:scale-[0.98] hover:bg-neutral-100"
              >
                <CameraIcon size={18} />
                <span className="text-sm font-bold tracking-tight">Masada Gör (AR)</span>
              </button>
            ) : !isIos && isMobile ? (
              <div className="flex-1 py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-white/60">
                Apple (iOS) cihazı gereklidir
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowQr(true)}
                className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 px-4 font-bold text-black shadow-lg transition-all active:scale-[0.98] hover:bg-neutral-100"
              >
                <QrIcon size={18} />
                <span className="text-sm font-bold tracking-tight">Telefonda Aç (QR Kod)</span>
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
                className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                  added ? "bg-emerald-500 text-white" : "bg-white/10 text-white hover:bg-white/15"
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

          <p className="mt-2 text-center text-[11px] text-white/40">
            {isIos
              ? "Kameranız açılarak tabağı masanıza 1:1 gerçek boyutta yerleştirecektir."
              : isMobile && glbUrl
              ? "Kameranız açılarak tabağı masanıza yerleştirecektir."
              : !isMobile
              ? "Modeli çevirmek için sürükleyin, QR kod ile telefonunuzda açın."
              : "Bu model Apple iOS cihazları için hazırlanmıştır."}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
