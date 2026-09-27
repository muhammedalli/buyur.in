// Landing bölümlerinin çapa kimlikleri: her dilde İngilizce (/#pricing,
// /en#pricing). Eski Türkçe çapalar (/#fiyat) lib/url-params.ts →
// LEGACY_SECTION_ANCHORS ile tanınır ve LegacyAnchorRedirect İngilizcesine
// yönlendirir; paylaşılmış eski bağlantılar kırılmaz. Bölüm bileşeni,
// gezinme ve footer buradan okur.
const SECTION_IDS = {
  platform: "platform",
  why: "why",
  liveMenu: "live-demo",
  features: "features",
  panel: "dashboard",
  analytics: "analytics",
  how: "how-it-works",
  customers: "customers",
  pricing: "pricing",
  compare: "compare",
  faq: "faq",
} as const;

export type LandingSection = keyof typeof SECTION_IDS;

export function sectionId(section: LandingSection): string {
  return SECTION_IDS[section];
}
