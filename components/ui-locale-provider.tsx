"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUiNumber, UI_LOCALE_COOKIE, uiLocaleTags, type Translator, type UiLocale } from "@/lib/ui-i18n";
import { panelTranslator } from "@/lib/ui-messages/panel";

// Arayüz dili bağlamı (panel ve giriş ekranları). İlk değer sunucuda çerezden
// okunur (app/panel/layout.tsx) ki ilk boyama doğru dilde gelsin; panelde asıl
// tercih işletme kaydındadır ve components/panel/language-switcher.tsx eşitler.

interface UiLocaleContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: Translator;
  /** Sayıyı dile göre biçimler (binlik ayırıcı). */
  formatNumber: (value: number) => string;
  /** Tarih biçimi için BCP 47 etiketi (toLocaleDateString). */
  tag: string;
}

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

/** Tercih bir yıl hatırlanır; site ve panel aynı çerezi okur. */
export function writeUiLocaleCookie(locale: UiLocale) {
  document.cookie = `${UI_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function UiLocaleProvider({ initialLocale, children }: { initialLocale: UiLocale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    writeUiLocaleCookie(next);
  }, []);

  // Kök layout <html lang="tr"> sabittir; ekran okuyucular ve tarayıcının
  // kendi çevirisi doğru dili görsün diye belge dili de eşitlenir. CSS'in
  // büyük harf dönüşümü (Türkçe "i" → "İ") aşağıdaki sarmalayıcının lang'ından
  // okunur, bu yüzden ilk boyamada da doğrudur.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  const value = useMemo<UiLocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: panelTranslator(locale),
      formatNumber: (n) => formatUiNumber(locale, n),
      tag: uiLocaleTags[locale],
    }),
    [locale, setLocale]
  );

  return (
    <UiLocaleContext.Provider value={value}>
      <div lang={locale} className="contents">
        {children}
      </div>
    </UiLocaleContext.Provider>
  );
}

export function useUiLocale(): UiLocaleContextValue {
  const ctx = useContext(UiLocaleContext);
  if (!ctx) throw new Error("useUiLocale, UiLocaleProvider içinde kullanılmalı");
  return ctx;
}

/** Sağlayıcı dışında da çalışması gereken ortak parçalar (ör. panel UI kiti
 *  yönetim ekranlarında da kullanılıyor) için: sağlayıcı yoksa Türkçe. */
export function useOptionalUiLocale(): UiLocaleContextValue {
  const ctx = useContext(UiLocaleContext);
  return ctx ?? FALLBACK;
}

const FALLBACK: UiLocaleContextValue = {
  locale: "tr",
  setLocale: () => undefined,
  t: panelTranslator("tr"),
  formatNumber: (n) => formatUiNumber("tr", n),
  tag: uiLocaleTags.tr,
};
