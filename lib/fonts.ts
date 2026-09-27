// Müşteri menüsünde işletme bazında seçilebilen yazı tipleri.
// CSS dosyaları app/layout.tsx'te import edilir (panel önizlemesi de kullanır);
// tarayıcı yalnızca sayfada gerçekten kullanılan ailenin dosyasını indirir.
export const fonts = {
  figtree: { name: "Figtree", stack: `"Figtree Variable", ui-sans-serif, system-ui, sans-serif` },
  inter: { name: "Inter", stack: `"Inter Variable", ui-sans-serif, system-ui, sans-serif` },
  nunito: { name: "Nunito", stack: `"Nunito Variable", ui-sans-serif, system-ui, sans-serif` },
  montserrat: { name: "Montserrat", stack: `"Montserrat Variable", ui-sans-serif, system-ui, sans-serif` },
  lora: { name: "Lora", stack: `"Lora Variable", Georgia, serif` },
  playfair: { name: "Playfair Display", stack: `"Playfair Display Variable", Georgia, serif` },
} as const;

export type FontKey = keyof typeof fonts;

export const DEFAULT_FONT: FontKey = "figtree";

export function getFontStack(fontKey?: string | null): string {
  if (!fontKey || !(fontKey in fonts)) return fonts[DEFAULT_FONT].stack;
  return fonts[fontKey as FontKey].stack;
}
