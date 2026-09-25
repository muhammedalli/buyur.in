"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";

// Yatay kaydırılabilen şeritlerin ortak kabı (menü kategori sekmeleri, öne
// çıkanlar, panelin mobil menüsü). Kaydırma çubuğu gizli olduğu için şeridin
// devam ettiği mobilde anlaşılmıyordu. Burada:
//   - devam eden kenarda yumuşak bir geçiş (fade) görünür,
//   - ilk görüşte uç kenarda küçük bir ok belirir (hafifçe kıpırdar),
//   - kullanıcı şeride dokunup kaydırınca ok kaybolur, geçişler kalır.
// Renkler `paper` token'ından gelir; menüde işletmenin yüzey rengiyle ezilir.
// RTL'de (Arapça) kenarlar ve ok yönü kendiliğinden döner.

export function HorizontalScroll({
  children,
  className = "",
  innerClassName = "",
  moreLabel,
  innerRef,
}: {
  children: ReactNode;
  /** Dış kap (konumlandırma, kenarlık). */
  className?: string;
  /** Kaydırılan iç şerit: flex/gap/padding burada verilir. */
  innerClassName?: string;
  /** Ok düğmesinin erişilebilir adı (çevrilmiş metin). */
  moreLabel: string;
  innerRef?: (element: HTMLDivElement | null) => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [interacted, setInteracted] = useState(false);

  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    // RTL'de scrollLeft negatif ilerler; mutlak değer iki yönde de mesafedir.
    const position = Math.abs(element.scrollLeft);
    setEdges((previous) => {
      const next = { start: position > 2, end: max - position > 2 };
      return previous.start === next.start && previous.end === next.end ? previous : next;
    });
  }, []);

  // İçerik (ör. dil değişince sekme adları) her render'da değişebilir.
  useEffect(() => {
    measure();
  });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const markInteracted = () => setInteracted(true);
    element.addEventListener("scroll", measure, { passive: true });
    // Programatik kaydırma (aktif sekmeyi ortalamak) "kullanıcı kaydırdı"
    // sayılmasın diye ipucunu yalnızca gerçek dokunuş/tekerlek kapatır.
    element.addEventListener("pointerdown", markInteracted, { passive: true });
    element.addEventListener("wheel", markInteracted, { passive: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    resize?.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      element.removeEventListener("pointerdown", markInteracted);
      element.removeEventListener("wheel", markInteracted);
      resize?.disconnect();
    };
  }, [measure]);

  function scrollForward() {
    const element = scroller.current;
    if (!element) return;
    setInteracted(true);
    const rtl = getComputedStyle(element).direction === "rtl";
    const distance = Math.max(120, element.clientWidth * 0.7);
    element.scrollBy({ left: rtl ? -distance : distance, behavior: "smooth" });
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={(element) => {
          scroller.current = element;
          innerRef?.(element);
        }}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${innerClassName}`}
      >
        {children}
      </div>

      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 start-0 w-6 bg-gradient-to-r from-paper to-transparent transition-opacity duration-200 rtl:bg-gradient-to-l ${
          edges.start ? "opacity-100" : "opacity-0"
        }`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 end-0 w-12 bg-gradient-to-l from-paper via-paper/70 to-transparent transition-opacity duration-200 rtl:bg-gradient-to-r ${
          edges.end ? "opacity-100" : "opacity-0"
        }`}
      />

      {edges.end && !interacted && (
        <button
          type="button"
          onClick={scrollForward}
          aria-label={moreLabel}
          className="scroll-hint absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper text-ink-soft shadow-sm transition-colors hover:text-ink"
        >
          <ChevronRightIcon size={15} strokeWidth={2.2} className="rtl:rotate-180" />
        </button>
      )}
    </div>
  );
}
