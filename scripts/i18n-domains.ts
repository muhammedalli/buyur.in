// Arayüz dili kataloglarının kapsamı: hangi kaynak dosya hangi ekran grubunun
// kataloğundan çevrilir (lib/ui-messages/<dil>/<grup>.ts). tests/ui-i18n.test.ts
// ve scripts/i18n-missing.ts buradan okur. Klasör verilirse içi taranır.
// Bir dosya birden çok gruba ait olabilir (ör. plan tablosu landing'de de panelde de).
export const I18N_DOMAIN_FILES = {
  site: [
    "app/page.tsx",
    "app/en/page.tsx",
    "components/landing-page.tsx",
    "components/hero.tsx",
    "components/platform.tsx",
    "components/feature-grid.tsx",
    "components/features.tsx",
    "components/pricing.tsx",
    "components/comparison.tsx",
    "components/showcase.tsx",
    "components/chrome.tsx",
    "lib/seo.ts",
    "lib/showcase.ts",
    "lib/entitlements.ts",
  ],
  siteClient: [
    "components/navbar.tsx",
    "components/pricing-plans.tsx",
    "components/live-menu.tsx",
    "components/panel-showcase.tsx",
    "components/analytics.tsx",
  ],
  panel: [
    "app/panel",
    "components/panel",
    "components/ui-locale-provider.tsx",
    // Panelin gösterdiği metinleri üreten ortak modüller (msg ile işaretli).
    "lib/entitlements.ts",
    "lib/guide.ts",
    "lib/phone.ts",
    "lib/password.ts",
    "lib/themes.ts",
    "lib/surfaces.ts",
    "lib/sector-templates.ts",
    "lib/unique-name.ts",
    "lib/upload.ts",
    "lib/ai/guard.ts",
    // Analiz modüllerinin sabit etiketleri (rapor tanımları, tablo sütunları,
    // skor bileşenleri, fırsat rozetleri); sayı içeren içgörü cümleleri Türkçe kalır.
    "lib/analytics/reports.ts",
    "lib/analytics/score.ts",
    "lib/analytics/opportunities.ts",
    "lib/analytics/funnel.ts",
    // Panelin çağırdığı API uçlarının hata metinleri (istemci t(hata) ile gösterir).
    "app/api/auth",
    "app/api/upload",
    "app/api/ai",
    "app/api/analytics",
    "app/api/emails",
  ],
} as const;

export type I18nDomain = keyof typeof I18N_DOMAIN_FILES;
