import type { CSSProperties } from "react";
import { isValidHex, pickReadableOn, readableAccent, visibleFill } from "@/lib/color";
import { getThemeColor } from "@/lib/themes";
import { getSurface } from "@/lib/surfaces";
import { getFontStack } from "@/lib/fonts";
import type { Business } from "@/lib/types";

// İşletmenin görsel kimliği (marka rengi, yazı tipi, menü zemini) tek yerden:
// müşteri menüsü, işletme sitesi ve karşılama sayfası aynı değişkenleri kullanır
// ki üçü arasında geçerken kimlik değişmesin.

type BrandSource = Pick<Business, "theme" | "theme_color" | "menu_bg" | "font">;

/** Marka rengi: özel renk (theme_color) doluysa o, değilse hazır tema. */
export function brandColor(business: BrandSource): string {
  return isValidHex(business.theme_color) ? business.theme_color : getThemeColor(business.theme);
}

/**
 * Kök öğeye verilecek CSS değişkenleri.
 * `surface: true` işletmenin seçtiği menü zeminini (kâğıt/kar/koyu…) de uygular:
 * Tailwind renk token'ları bu kapsamda ezilir, bileşenler olduğu gibi yeniden tonlanır.
 */
export function brandStyle(business: BrandSource, { surface = false }: { surface?: boolean } = {}): CSSProperties {
  const brand = brandColor(business);
  const tone = surface ? getSurface(business.menu_bg) : getSurface(null);
  const fill = visibleFill(brand, tone.vars.paper);
  const fontStack = getFontStack(business.font);
  return {
    "--brand": fill,
    "--brand-on": pickReadableOn(fill),
    "--brand-text": readableAccent(brand, tone.vars.paper),
    "--font-body": fontStack,
    "--font-display": fontStack,
    ...(surface
      ? {
          "--color-paper": tone.vars.paper,
          "--color-crema": tone.vars.crema,
          "--color-ink": tone.vars.ink,
          "--color-ink-soft": tone.vars.inkSoft,
          "--color-line": tone.vars.line,
        }
      : {}),
    fontFamily: fontStack,
  } as CSSProperties;
}
