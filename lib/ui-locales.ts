// Arayüz dillerinin listesi ve etiketleri — bağımlılıksız (middleware ve sunucu
// layout'ları da okur, kataloglar buraya import edilmez). Çeviri: lib/ui-i18n.ts.

export const UI_LOCALES = ["tr", "en"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE = "tr" satisfies UiLocale;

/** Site ve panelin ortak dil çerezi. Panelde asıl tercih işletme kaydındadır
 *  (`ui_locale`); çerez girişten önceki ekranlar ve ilk boyama içindir. */
export const UI_LOCALE_COOKIE = "buyur-ui-lang";

/** Dil seçicide dilin kendi adıyla gösterilir. */
export const uiLocaleLabels: Record<UiLocale, string> = {
  tr: "Türkçe",
  en: "English",
};

export const uiLocaleCodes: Record<UiLocale, string> = {
  tr: "TR",
  en: "EN",
};

/** BCP 47 etiketi: sayı/tarih biçimi ve Intl.PluralRules için. */
export const uiLocaleTags: Record<UiLocale, string> = {
  tr: "tr-TR",
  en: "en-US",
};

/** Open Graph `locale` değeri. */
export const uiOgLocales: Record<UiLocale, string> = {
  tr: "tr_TR",
  en: "en_US",
};

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value);
}

export function normalizeUiLocale(value: unknown): UiLocale {
  return isUiLocale(value) ? value : DEFAULT_UI_LOCALE;
}
