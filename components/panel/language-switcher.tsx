"use client";

import { useEffect, useRef } from "react";
import { pb } from "@/lib/pocketbase";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { DEFAULT_UI_LOCALE, isUiLocale, UI_LOCALES, uiLocaleCodes, uiLocaleLabels, type UiLocale } from "@/lib/ui-i18n";
import { useUiLocale } from "@/components/ui-locale-provider";
import { useOptionalBusiness } from "@/components/panel/business-context";
import { buttonClass, Dropdown } from "@/components/panel/ui";
import { GlobeIcon } from "@/components/icons";
import type { Business } from "@/lib/types";

// Panelin arayüz dili seçicisi. Tercih kullanıcı (= işletme hesabı) bazında
// hatırlanır: `ui_locale` alanına yazılır, ayrıca çereze (girişten önceki
// ekranlar ve ilk boyama için). Oturum yoksa (giriş/kayıt) yalnızca çerez.

/** Tercihi hesaba yazar. Hata sessizdir: dil yine de bu cihazda değişmiştir. */
async function persistUiLocale(account: Business, locale: UiLocale, save: (b: Business) => void) {
  try {
    const updated = await pb.collection(BUSINESS_COLLECTION).update<Business>(account.id, { ui_locale: locale }, { requestKey: null });
    save(updated);
  } catch {
    /* yoksay — bir sonraki değişiklikte yeniden denenir */
  }
}

export function PanelLanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useUiLocale();
  const business = useOptionalBusiness();

  function choose(next: UiLocale) {
    if (next === locale) return;
    setLocale(next);
    if (business?.account) void persistUiLocale(business.account, next, business.setBusiness);
  }

  return (
    <div className={className}>
      <Dropdown
        label={t("Panel dili")}
        triggerClassName={buttonClass("outline", "gap-1.5", "sm")}
        trigger={
          <span className="inline-flex items-center gap-1.5">
            <GlobeIcon size={14} />
            {uiLocaleCodes[locale]}
          </span>
        }
        items={UI_LOCALES.map((option) => ({
          label: uiLocaleLabels[option],
          description: option === locale ? t("Seçili") : undefined,
          onSelect: () => choose(option),
        }))}
      />
    </div>
  );
}

/** Oturum açılınca hesaptaki dil tercihini uygular; hesapta tercih yoksa ve
 *  kullanıcı girişten önce başka bir dil seçtiyse onu hesaba yazar. Hesap başına
 *  bir kez çalışır: kullanıcı panelde dil değiştirirken araya giren bir oturum
 *  tazelemesi seçimi geri almasın. */
export function PanelLocaleSync() {
  const { locale, setLocale } = useUiLocale();
  const business = useOptionalBusiness();
  const appliedFor = useRef<string | null>(null);
  const account = business?.account ?? null;

  useEffect(() => {
    if (!account || appliedFor.current === account.id) return;
    appliedFor.current = account.id;
    if (isUiLocale(account.ui_locale)) {
      if (account.ui_locale !== locale) setLocale(account.ui_locale);
    } else if (locale !== DEFAULT_UI_LOCALE && business) {
      void persistUiLocale(account, locale, business.setBusiness);
    }
  }, [account, locale, setLocale, business]);

  return null;
}
