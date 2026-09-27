// Arayüz dili: pazarlama sitesi (buyur.in, /en) ve işletme paneli (/panel).
//
// Müşteri menüsünün dilleri (işletmenin içerik dilleri: tr/en/ku/ar/ru) ayrı
// bir sistemdir → lib/i18n.ts. Bu dosya yalnızca buyur'un KENDİ ekranlarının
// dilini yönetir.
//
// Model (gettext deseni): kaynak dil Türkçedir ve Türkçe metnin kendisi mesaj
// kimliğidir. Kodda metin olduğu gibi okunur kalır:
//
//   const { t } = useUiLocale();
//   t("Kaydet")                         → "Save"
//   t("{count} ürün", { count: 3 })     → "3 products"   (çoğul biçim katalogda)
//
// Diğer dillerin karşılıkları merkezi kataloglardadır (lib/ui-messages/<dil>/).
// Katalogda karşılığı olmayan metin Türkçe kalır — ekran hiçbir zaman boş
// görünmez. tests/ui-i18n.test.ts koddaki her t("…")/msg("…") metninin her
// katalogda karşılığı olduğunu ve {yer tutucu}ların eşleştiğini kilitler.
//
// Kataloglar ekran grubuna göre ayrıdır ve bu dosya hiçbirini import ETMEZ:
// istemci paketine yalnızca o ekranın kataloğu insin (landing'e panelin binlerce
// metni inmesin). Çevirmen kurucular:
//   · lib/ui-messages/site.ts        → pazarlama sitesi, sunucu bileşenleri
//   · lib/ui-messages/site-client.ts → pazarlama sitesinin istemci bileşenleri
//   · lib/ui-messages/panel.ts       → panel + giriş/kayıt ekranları
//
// Yeni arayüz dili eklemek: lib/ui-locales.ts (UI_LOCALES + etiketler) +
// lib/ui-messages/<dil>/ katalogları + yukarıdaki üç kurucudaki eşleme.

export {
  DEFAULT_UI_LOCALE,
  isUiLocale,
  normalizeUiLocale,
  UI_LOCALE_COOKIE,
  UI_LOCALES,
  uiLocaleCodes,
  uiLocaleLabels,
  uiLocaleTags,
  uiOgLocales,
  type UiLocale,
} from "@/lib/ui-locales";
import { DEFAULT_UI_LOCALE, uiLocaleTags, type UiLocale } from "@/lib/ui-locales";

/** Çoğul biçim: Intl.PluralRules kategorisine göre seçilir. `other` zorunludur. */
export interface PluralMessage {
  zero?: string;
  one?: string;
  other: string;
}

export type CatalogEntry = string | PluralMessage;
export type Catalog = Readonly<Record<string, CatalogEntry>>;

/** Kaynak dil (Türkçe) dışındaki her arayüz dili için bir katalog. */
export type ForeignUiLocale = Exclude<UiLocale, typeof DEFAULT_UI_LOCALE>;
export type CatalogSet = Record<ForeignUiLocale, Catalog>;

export type MessageVars = Record<string, string | number>;

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** Çoğul biçimi `count` (yoksa `n`) değişkenine göre seçer. */
function pickPlural(entry: PluralMessage, locale: UiLocale, vars?: MessageVars): string {
  const raw = vars?.count ?? vars?.n;
  const count = typeof raw === "number" ? raw : Number(raw ?? 0);
  if (count === 0 && entry.zero) return entry.zero;
  const rule = new Intl.PluralRules(uiLocaleTags[locale]).select(Number.isFinite(count) ? count : 0);
  return (rule === "one" ? entry.one : undefined) ?? entry.other;
}

/** Türkçe kaynak metni istenen dile çevirir; katalogda yoksa kaynağı döndürür. */
export function translate(catalogs: CatalogSet, locale: UiLocale, source: string, vars?: MessageVars): string {
  if (locale === DEFAULT_UI_LOCALE) return interpolate(source, vars);
  const entry = catalogs[locale][source];
  if (entry === undefined) return interpolate(source, vars);
  const template = typeof entry === "string" ? entry : pickPlural(entry, locale, vars);
  return interpolate(template, vars);
}

export type Translator = (source: string, vars?: MessageVars) => string;

export function createTranslator(catalogs: CatalogSet, locale: UiLocale): Translator {
  return (source, vars) => translate(catalogs, locale, source, vars);
}

/** Metni çeviri için İŞARETLER, çevirmez (gettext_noop). Sabit listelerde
 *  (menü öğeleri, sekmeler, sunucunun döndürdüğü hata metinleri) kullanılır;
 *  çeviri ekrana basılırken t(değer) ile yapılır. tests/ui-i18n.test.ts
 *  işaretli metinleri de kataloglarda arar. */
export function msg<T extends string>(source: T): T {
  return source;
}

/** Sayı biçimi (binlik ayırıcı dile göre). */
export function formatUiNumber(locale: UiLocale, value: number): string {
  return value.toLocaleString(uiLocaleTags[locale]);
}

/** Sitenin dil kökü: Türkçe "/", diğer diller "/<dil>". */
export function siteLocalePath(locale: UiLocale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_UI_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
