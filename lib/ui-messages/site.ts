import { createTranslator, type CatalogSet, type Translator } from "@/lib/ui-i18n";
import type { UiLocale } from "@/lib/ui-locales";
import { SITE_MESSAGES_EN } from "@/lib/ui-messages/en/site";

// Pazarlama sitesinin sunucu bileşenleri için çevirmen. Yalnızca sunucuda
// kullanılır (istemci bileşeni import ederse katalog tarayıcıya iner).
export const SITE_CATALOGS: CatalogSet = { en: SITE_MESSAGES_EN };

export function siteTranslator(locale: UiLocale): Translator {
  return createTranslator(SITE_CATALOGS, locale);
}
