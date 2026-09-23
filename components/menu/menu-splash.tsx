"use client";

import { useEffect, useState } from "react";
import { useMenu } from "@/components/menu/menu-provider";

// Menü ilk açılış süresi: görseller iner inmez açılır (güvenlik zaman aşımı 2 sn)
const MAX_WAIT_MS = 2000;
const MIN_SHOW_MS = 0;

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function AnimatedCookingDish() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Ambient sıcak ışık ışıltısı */}
      <div
        className="absolute -inset-6 rounded-full opacity-20 blur-3xl animate-pulse"
        style={{ background: "var(--brand)" }}
      />

      <svg
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative h-32 w-32 sm:h-36 sm:w-36 text-ink drop-shadow-sm transition-transform duration-500"
        aria-hidden="true"
      >
        {/* Yükselen Lezzet Buharları */}
        <g>
          <path
            d="M33 22C32 19 35 16 34 13"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="animate-steam-1 text-[var(--brand-text)]"
          />
          <path
            d="M40 20C39 17 42 14 41 11"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="animate-steam-2 text-[var(--brand-text)]"
          />
          <path
            d="M47 22C46 19 49 16 48 13"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="animate-steam-3 text-[var(--brand-text)]"
          />
        </g>

        {/* Tabak Tabanı */}
        <path
          d="M18 56C24 59.5 56 59.5 62 56"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          className="text-[var(--brand-text)]"
        />
        <path
          d="M22 60C28 62 52 62 58 60"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.4"
        />

        {/* Süzülen Servis Kapağı (Cloche) */}
        <g className="animate-cloche-lid">
          <path
            d="M20 53C20 35 60 35 60 53H20Z"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinejoin="round"
            className="text-[var(--brand-text)]"
          />
          <circle
            cx="40"
            cy="31"
            r="3.5"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="2.4"
            className="text-[var(--brand-text)]"
          />
          <path
            d="M40 34V36"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="text-[var(--brand-text)]"
          />
          <path
            d="M27 50C27 41 33 38 38 37"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeOpacity="0.35"
          />
        </g>

        {/* Işıltı Yıldızı */}
        <path
          d="M62 28L63.5 31.5L67 33L63.5 34.5L62 38L60.5 34.5L57 33L60.5 31.5L62 28Z"
          fill="currentColor"
          className="animate-sparkle text-[var(--brand-text)]"
        />
        <circle cx="16" cy="34" r="1.5" fill="currentColor" className="animate-sparkle text-[var(--brand-text)]" />
      </svg>
    </div>
  );
}

/** Menü ilk açılırken sade, zarif ve kaliteli bir gurme animasyonu gösterir */
export function MenuSplash() {
  const { business, categories, imageByCategory, tf, t } = useMenu();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const key = `buyur-splash-${business.slug}`;
    try {
      if (window.sessionStorage.getItem(key)) {
        setVisible(false);
        return;
      }
    } catch {
      /* sessionStorage kapalı: splash'i her seferinde göstermek zararsız */
    }

    const urls = [
      business.logo_url,
      business.cover_url,
      ...categories.slice(0, 4).map((c) => c.image_url || imageByCategory.get(c.id)),
    ].filter((u): u is string => Boolean(u));

    let cancelled = false;
    const started = Date.now();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS));

    Promise.race([Promise.all(urls.map(preload)).then(() => undefined), timeout]).then(() => {
      if (cancelled) return;
      const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - started));
      setTimeout(() => {
        if (cancelled) return;
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          /* yoksay */
        }
        setLeaving(true);
        setTimeout(() => !cancelled && setVisible(false), 500);
      }, wait);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-paper px-8 text-center transition-all duration-500 ease-out ${
        leaving ? "pointer-events-none opacity-0 scale-105" : "opacity-100 scale-100"
      }`}
    >
      {/* Gurme Pişirme/Servis Animasyonu */}
      <div className="splash-pop">
        <AnimatedCookingDish />
      </div>

      {/* İşletme Başlığı ve Mesaj */}
      <div className="splash-pop flex flex-col items-center" style={{ animationDelay: "0.08s" }}>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          {tf(business, "name")}
        </h1>
        <p className="mt-1.5 font-display text-xs sm:text-sm font-medium text-ink-soft">
          {t("splashMessage")}
        </p>
      </div>

      {/* İnce modern parıldayan yükleme çubuğu */}
      <div
        className="splash-pop relative h-1.5 w-36 overflow-hidden rounded-full border border-line/40 bg-crema/80 shadow-inner"
        style={{ animationDelay: "0.15s" }}
        aria-hidden
      >
        <div
          className="animate-bar-shimmer absolute inset-y-0 w-24 rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--brand) 50%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}
