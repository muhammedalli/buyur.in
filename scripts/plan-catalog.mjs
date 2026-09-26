// Paket kataloğu: üç planın adı, açıklaması, fiyatı, özellik listesi ve
// limitleri. YENİ bir ortamın ilk seed'i (scripts/migrate-plans.mjs) ve landing
// fiyat kartlarının metin yedeği (components/pricing-plans.tsx) buradan okur.
// Canlı kaynak `buyur_plans` kaydıdır ve admin panelinden değişir; bu dosya
// canlıyı ezmek için KULLANILMAZ. tests/plan-catalog.test.ts kod yedeğiyle
// (lib/entitlements.ts) aynı kalmasını kilitler.
//
// Uygulama tarafındaki karşılıkları:
//   · yetki matrisi  → lib/entitlements.ts
//   · ilan fiyatları → lib/pricing.ts (her planın tek fiyatı aylıktır; yıllık
//     karşılık sistem ayarındaki indirimle hesaplanır, lib/system-settings.ts)
// Fiyat ya da paket içeriği değişince üçü birden güncellenmelidir
// (tests/plan-catalog.test.ts tutarlılığı kilitler).
//
// Özellik metinleri kural: yalnızca ürünün BUGÜN yaptığı iş yazılır. Sipariş
// yönetimi, API erişimi, ürün limiti gibi olmayan şeyler burada yer almaz.

/** `buyur_plans.limits` şeması: yetenek bayrakları + kotalar. Uygulama bunları
 *  canlı OKUR (lib/entitlements.ts → applyPlanRecords); anahtar adları o eşlemeyle
 *  ve lib/types.ts → PlanLimits ile birebir aynı olmalı. Süre ayrıca üst düzey
 *  `trial_months` alanında tutulur (0 = süresiz). null = sınırsız. */
const planLimits = (overrides) => ({
  ai_menu_import: true,
  ai_pages_per_scan: 5,
  ai_scans_per_month: 5,
  ai_translation: true,
  analytics: true,
  analytics_advanced: false,
  analytics_retention_days: 365,
  api_access: false,
  branding_removal: false,
  campaigns: false,
  website: false,
  insights: false,
  menu_views: null,
  reports: false,
  reports_export: false,
  scheduled_reports: false,
  ...overrides,
});

export const PLAN_SEEDS = [
  {
    key: "freemium",
    name: "Freemium",
    description: "Ürünü deneyen küçük işletmeler için: menünü kur, QR'ını yayına al.",
    price_monthly: 0,
    trial_months: 1,
    is_active: true,
    is_default: true,
    order: 0,
    features: [
      "1 ay veya 5.000 menü görüntülenme",
      "Sınırsız ürün ve kategori",
      "QR menü ve size özel menü adresi",
      "Anlık fiyat ve ürün güncelleme",
      "Sepet: müşteri seçimini garsona gösterir",
      "Temel analizler",
    ],
    limits: planLimits({
      menu_views: 5000,
      analytics_retention_days: 90,
      ai_scans_per_month: 2,
    }),
  },
  {
    key: "premium",
    name: "Premium",
    description: "Aktif restoran ve kafeler için: kampanya, analiz ve markasız profesyonel menü.",
    price_monthly: 249,
    trial_months: 0,
    is_active: true,
    is_default: false,
    order: 1,
    features: [
      "Süre ve görüntülenme sınırı yok",
      "Kampanyalar ve açılış pop-up'ı",
      "Gelişmiş analizler ve otomatik içgörüler",
      "buyur markasını kaldırma",
    ],
    limits: planLimits({
      analytics_advanced: true,
      insights: true,
      branding_removal: true,
      campaigns: true,
      analytics_retention_days: 365,
      ai_scans_per_month: 5,
    }),
  },
  {
    key: "elite",
    name: "Elite",
    // Elite'in ana değeri: web sitesi + raporlama + öncelikli hizmet.
    // API/güvenlik araçları ürünün bugün sunduğu şeyler değil; vaat edilmez.
    description: "Büyüyen işletmeler için: web sitesi, raporlama ve öncelikli hizmet.",
    price_monthly: 749,
    trial_months: 0,
    is_active: true,
    is_default: false,
    order: 2,
    features: [
      "Premium'daki her şey",
      "Web sitesi (menüden otomatik · animasyon · slider · galeri)",
      "Rapor merkezi · PDF ve CSV dışa aktarma",
      "3 yıl analiz geçmişi",
      "Öncelikli teknik destek",
    ],
    limits: planLimits({
      analytics_advanced: true,
      insights: true,
      branding_removal: true,
      campaigns: true,
      website: true,
      reports: true,
      reports_export: true,
      analytics_retention_days: 1095,
      ai_scans_per_month: 10,
    }),
  },
];
