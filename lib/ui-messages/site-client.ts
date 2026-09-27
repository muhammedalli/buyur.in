import { createTranslator, type CatalogSet, type Translator } from "@/lib/ui-i18n";
import type { UiLocale } from "@/lib/ui-locales";
import { SITE_CLIENT_MESSAGES_EN } from "@/lib/ui-messages/en/site-client";

// Pazarlama sitesinin istemci bileşenleri için çevirmen (küçük katalog).
export const SITE_CLIENT_CATALOGS: CatalogSet = { en: SITE_CLIENT_MESSAGES_EN };

export function siteClientTranslator(locale: UiLocale): Translator {
  return createTranslator(SITE_CLIENT_CATALOGS, locale);
}
