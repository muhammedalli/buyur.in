import type { UiLocale } from "@/lib/ui-locales";

// Landing bölümlerinin çapa kimlikleri dile göre: paylaşılan bağlantı
// (/en#pricing) okuyanın dilinde olsun. Türkçe kimlikler eski bağlantılar
// kırılmasın diye değişmez. Bölüm bileşeni, gezinme ve footer buradan okur.
const SECTION_IDS = {
  platform: { tr: "platform", en: "platform" },
  why: { tr: "neden", en: "why" },
  liveMenu: { tr: "canli-menu", en: "live-demo" },
  features: { tr: "ozellikler", en: "features" },
  panel: { tr: "panel", en: "dashboard" },
  analytics: { tr: "analiz", en: "analytics" },
  how: { tr: "nasil", en: "how-it-works" },
  customers: { tr: "kullananlar", en: "customers" },
  pricing: { tr: "fiyat", en: "pricing" },
  compare: { tr: "karsilastir", en: "compare" },
  faq: { tr: "sss", en: "faq" },
} as const satisfies Record<string, Record<UiLocale, string>>;

export type LandingSection = keyof typeof SECTION_IDS;

export function sectionId(section: LandingSection, locale: UiLocale): string {
  return SECTION_IDS[section][locale];
}
