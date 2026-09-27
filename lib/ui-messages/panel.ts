import { createTranslator, type CatalogSet, type Translator } from "@/lib/ui-i18n";
import type { UiLocale } from "@/lib/ui-locales";
import { PANEL_MESSAGES_EN } from "@/lib/ui-messages/en/panel";

// Panel ve giriş/kayıt ekranları için çevirmen.
export const PANEL_CATALOGS: CatalogSet = { en: PANEL_MESSAGES_EN };

export function panelTranslator(locale: UiLocale): Translator {
  return createTranslator(PANEL_CATALOGS, locale);
}
