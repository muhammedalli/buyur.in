import { msg } from "@/lib/ui-i18n";

export const themes = {
  paprika: { name: msg("Paprika"), color: "#e8491f" },
  midnight: { name: msg("Gece Mavi"), color: "#1a1a2e" },
  emerald: { name: msg("Zümrüt"), color: "#3e7c4f" },
  sunflower: { name: msg("Ayçiçeği"), color: "#f4d03f" },
  berry: { name: msg("Çilek"), color: "#c2185b" },
  ocean: { name: msg("Okyanus"), color: "#0277bd" },
  forest: { name: msg("Orman"), color: "#1b5e20" },
  plum: { name: msg("Dut"), color: "#6a1b9a" },
  copper: { name: msg("Bakır"), color: "#bf360c" },
  slate: { name: msg("Arduvaz"), color: "#455a64" },
} as const;

export type ThemeKey = keyof typeof themes;

export function getThemeColor(themeKey?: string | null): string {
  if (!themeKey || !(themeKey in themes)) return themes.paprika.color;
  return themes[themeKey as ThemeKey].color;
}
