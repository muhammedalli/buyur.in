// İşletme vitrini, menü dilleri, mekân özellikleri ve panel tercihleri için
// buyur_businesses alanları. scripts/setup-pocketbase.mjs (sıfırdan kurulum)
// ile scripts/migrate-storefront-i18n.mjs (mevcut kurulumun göçü) aynı
// tanımları buradan okur; ikisi ayrışırsa yeni kurulum ile canlı farklı şemada
// kalırdı.
//
// Uygulama tarafındaki karşılıkları:
//   · menü dilleri      → lib/i18n.ts (SUPPORTED_LOCALES, MAX_MENU_LOCALES)
//   · mekân özellikleri → lib/types.ts (Highlight), lib/labels.ts
//   · kayan yazı        → lib/marquee.ts
//   · vitrin/web sitesi → lib/storefront.ts
//   · panel dili        → lib/ui-i18n.ts
//   · kılavuz           → lib/guide.ts
// tests/menu-locales.test.ts listelerin uygulamayla aynı kalmasını kilitler.

/** Menü içeriğinin dilleri (lib/i18n.ts → SUPPORTED_LOCALES ile aynı sırada). */
export const MENU_LOCALE_VALUES = ["tr", "en", "de", "ar", "fr", "es", "it", "ru"];

/** `languages` ana dil dışındaki ek dilleri tutar. İşletme başına en fazla 4
 *  dil (lib/i18n.ts → MAX_MENU_LOCALES) = ana dil + 3 ek dil. */
export const MENU_EXTRA_LANGUAGES_MAX = 3;

/** Mekân özellikleri. Seçim sınırı yoktur: işletme hepsini seçebilir
 *  (maxSelect = seçenek sayısı). */
export const HIGHLIGHT_VALUES = [
  "wifi",
  "vale",
  "otopark",
  "cocuk_oyun_alani",
  "evcil_hayvan_dostu",
  "teras",
  "canli_muzik",
  "rezervasyon",
  "kredi_karti",
  "engelli_erisimi",
  "sigara_alani",
  "kahvalti",
];

/** Bu sürümle eklenen alanlar. Hepsi isteğe bağlı; boş değer eski davranışı korur:
 *  kayan yazı kapalı, web sitesi (plan izin veriyorsa) açık, panel Türkçe,
 *  kılavuz açık. */
export const STOREFRONT_FIELDS = [
  // Kayan yazı: açık/kapalı + her satırı bir mesaj olan metin. Çevirileri
  // işletmenin `translations[dil].marquee_text` kutusunda durur.
  { name: "marquee_enabled", type: "bool" },
  { name: "marquee_text", type: "text", required: false, min: 0, max: 1000, pattern: "", presentable: false },
  // Sahibi Elite web sitesini yayından kaldırdıysa true. Varsayılan (false)
  // "plan izin veriyorsa yayında" demektir: mevcut Elite siteleri kapanmaz.
  { name: "site_disabled", type: "bool" },
  // Panelin arayüz dili (lib/ui-i18n.ts → UI_LOCALES). Boşsa Türkçe.
  { name: "ui_locale", type: "text", required: false, min: 0, max: 5, pattern: "", presentable: false },
  // Panel kılavuzu (lib/guide.ts): { enabled?, started_at?, completed_at?, dismissed_at? }.
  { name: "guide", type: "json", maxSize: 20000 },
];
