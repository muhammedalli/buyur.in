// Menü arka planı / yüzey tonu preset'leri. Her preset, Tailwind'in temel renk
// token'larını (--color-paper/crema/ink/ink-soft/line) menü kökünde geçersiz
// kılar; böylece tüm menü bileşenleri tek bir inline style ile yeniden tonlanır
// (bileşenler bg-paper/text-ink/border-line gibi utility'leri kullandığı için).

import { msg } from "@/lib/ui-i18n";

export interface Surface {
  name: string;
  /** Küçük önizleme için: [zemin, yüzey, metin] */
  swatch: readonly [string, string, string];
  dark: boolean;
  vars: {
    paper: string;
    crema: string;
    ink: string;
    inkSoft: string;
    line: string;
  };
}

export const surfaces = {
  paper: {
    name: msg("Kâğıt"),
    dark: false,
    swatch: ["#fbf5ea", "#f4ead9", "#231812"],
    vars: { paper: "#fbf5ea", crema: "#f4ead9", ink: "#231812", inkSoft: "#5c4a3d", line: "#e0d3bf" },
  },
  snow: {
    name: msg("Kar"),
    dark: false,
    swatch: ["#ffffff", "#f3f4f6", "#1c1c1e"],
    vars: { paper: "#ffffff", crema: "#f3f4f6", ink: "#1c1c1e", inkSoft: "#6b7280", line: "#e5e7eb" },
  },
  sand: {
    name: msg("Kum"),
    dark: false,
    swatch: ["#f5f0e6", "#ebe3d3", "#2b2420"],
    vars: { paper: "#f5f0e6", crema: "#ebe3d3", ink: "#2b2420", inkSoft: "#6b5b4d", line: "#ddd0bd" },
  },
  mist: {
    name: msg("Sis"),
    dark: false,
    swatch: ["#f4f6f7", "#e8ecee", "#1f2a2e"],
    vars: { paper: "#f4f6f7", crema: "#e8ecee", ink: "#1f2a2e", inkSoft: "#5b6a70", line: "#dbe1e3" },
  },
  charcoal: {
    name: msg("Kömür"),
    dark: true,
    swatch: ["#1f1b18", "#2a2521", "#f5efe6"],
    vars: { paper: "#1f1b18", crema: "#2a2521", ink: "#f5efe6", inkSoft: "#b3a89b", line: "#3a332d" },
  },
  night: {
    name: msg("Gece"),
    dark: true,
    swatch: ["#14161f", "#1e212e", "#eef1f7"],
    vars: { paper: "#14161f", crema: "#1e212e", ink: "#eef1f7", inkSoft: "#9aa3b8", line: "#2b2f3d" },
  },
} as const;

export type SurfaceKey = keyof typeof surfaces;

export const DEFAULT_SURFACE: SurfaceKey = "paper";

export function getSurface(key?: string | null): Surface {
  if (!key || !(key in surfaces)) return surfaces[DEFAULT_SURFACE];
  return surfaces[key as SurfaceKey];
}
