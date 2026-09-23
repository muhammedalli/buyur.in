"use client";

import type { SVGProps } from "react";

/**
 * Zengin, net ve şık gurme servis illüstrasyonu.
 * Menüde görseli olmayan kategoriler ve ürünler için kullanılır.
 */
export function GourmetDishArt({
  size = "md",
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "lg" ? "h-24 w-24" : size === "md" ? "h-16 w-16" : "h-10 w-10";

  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${dims} ${className}`}
      aria-hidden="true"
      {...props}
    >
      {/* Dış tabak ve ambiyans halkası */}
      <circle cx="40" cy="40" r="36" fill="currentColor" fillOpacity="0.04" />
      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.15" strokeDasharray="3 3" />
      <circle cx="40" cy="40" r="27" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.25" />

      {/* Tabak alt çizgisi */}
      <path
        d="M20 54C26 57.5 54 57.5 60 54"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="text-[var(--brand-text)]"
      />
      <path
        d="M24 57C29 59 51 59 56 57"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />

      {/* Servis kapağı (Cloche) kubbesi */}
      <path
        d="M22 51C22 34 58 34 58 51H22Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        className="text-[var(--brand-text)]"
      />

      {/* Kapak tutacağı */}
      <circle
        cx="40"
        cy="31"
        r="3"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
        className="text-[var(--brand-text)]"
      />
      <path
        d="M40 33V35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-[var(--brand-text)]"
      />

      {/* Kapak parlama çizgisi */}
      <path
        d="M28 48C28 40 34 37 38 36"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />

      {/* Buhar / Lezzet kıvrımları */}
      <path
        d="M34 23C33 20 36 17 35 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--brand-text)]"
        strokeOpacity="0.75"
      />
      <path
        d="M41 21C40 18 43 15 42 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--brand-text)]"
      />
      <path
        d="M47 23C46 20 49 17 48 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--brand-text)]"
        strokeOpacity="0.75"
      />

      {/* Küçük ışıltı yıldızları */}
      <path
        d="M62 26L63 29L66 30L63 31L62 34L61 31L58 30L61 29L62 26Z"
        fill="currentColor"
        className="text-[var(--brand-text)]"
        fillOpacity="0.8"
      />
      <circle cx="18" cy="30" r="1.5" fill="currentColor" className="text-[var(--brand-text)]" fillOpacity="0.6" />
    </svg>
  );
}

/**
 * Kategori ve öne çıkan kartlar için tam zemin kapsayan görsel placeholder kutusu.
 */
export function CategoryPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-crema via-crema/60 to-paper text-ink transition-transform duration-500 group-hover:scale-105 ${className}`}
    >
      <div className="relative flex items-center justify-center rounded-3xl border border-line/60 bg-paper/85 p-3.5 shadow-sm backdrop-blur-xs transition-shadow group-hover:shadow-md">
        <GourmetDishArt size="md" />
      </div>
    </div>
  );
}

/**
 * Kompakt ürün kartları (liste ve grid) için placeholder kutusu.
 */
export function ProductPlaceholder({ size = "md", className = "" }: { size?: "sm" | "md"; className?: string }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-crema via-crema/60 to-paper text-ink ${className}`}
    >
      <div
        className={`flex items-center justify-center rounded-2xl border border-line/60 bg-paper/85 shadow-xs backdrop-blur-xs ${
          size === "sm" ? "p-1.5" : "p-2.5"
        }`}
      >
        <GourmetDishArt size={size === "sm" ? "sm" : "sm"} />
      </div>
    </div>
  );
}
