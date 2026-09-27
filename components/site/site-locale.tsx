"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  activeLocales,
  getStoredLocale,
  hasStoredLocale,
  isRTLLocale,
  localeCodes,
  localeLabels,
  mainLocale,
  storeLocale,
  tField,
  t as translate,
  type Locale,
  type Translatable,
  type TranslatableField,
  type UIKey,
} from "@/lib/i18n";
import type { LangConfig } from "@/lib/i18n";

// Web sitesinin dil bağlamı — menüdeki (components/menu/menu-provider.tsx) aynı
// desenin sade bir kopyası. Aynı localStorage anahtarını (getStoredLocale/storeLocale)
// paylaşır: ziyaretçi menüde bir dil seçtiyse site de onu hatırlar.

interface SiteLocaleContextValue {
  locale: Locale;
  /** İşletmenin ana dili — çeviri yoksa buna düşülür. */
  baseLocale: Locale;
  setLocale: (locale: Locale) => void;
  locales: Locale[];
  t: (key: UIKey, vars?: Record<string, string | number>) => string;
  tf: (entity: Translatable, field: TranslatableField) => string;
}

const SiteLocaleContext = createContext<SiteLocaleContextValue | null>(null);

export function useSiteLocale() {
  const ctx = useContext(SiteLocaleContext);
  if (!ctx) throw new Error("useSiteLocale, SiteLocaleProvider içinde kullanılmalı");
  return ctx;
}

/** Hem menüde hem vitrinde kullanılan parçalar için: vitrin dışında null. */
export function useOptionalSiteLocale() {
  return useContext(SiteLocaleContext);
}

export function SiteLocaleProvider({ business, children }: { business: LangConfig; children: ReactNode }) {
  const baseLocale = mainLocale(business);
  const locales = useMemo(() => activeLocales(business), [business]);
  const [locale, setLocaleState] = useState<Locale>(baseLocale);

  // İlk boyama (SSR ve hydration) her zaman işletmenin ana dilinde — arama
  // motorları ve ilk paint bundan etkilenmesin. Ziyaretçinin kayıtlı tercihi
  // yalnızca mount sonrası, istemcide uygulanır — ve yalnızca gerçekten daha
  // önce bir şey seçtiyse (getStoredLocale hiçbir şey yoksa "tr"ye düşer,
  // bu yüzden hasStoredLocale ile ayrıca doğruluyoruz).
  useEffect(() => {
    if (!hasStoredLocale()) return;
    const stored = getStoredLocale();
    setLocaleState(locales.includes(stored) ? stored : baseLocale);
  }, [locales, baseLocale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    storeLocale(next);
  }

  // Kök layout <html lang="tr"> sabit (bkz. app/layout.tsx) — CSS'in
  // uppercase dönüşümü Türkçe harf kurallarına göre çalışır ("view" → "VİEW"
  // gibi noktalı İ hatası). Site içindeyken gerçek dile göre güncelliyoruz,
  // ayrılınca kök değere geri dönüyoruz.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  const value = useMemo<SiteLocaleContextValue>(
    () => ({
      locale,
      baseLocale,
      setLocale,
      locales,
      t: (key, vars) => translate(locale, key, vars),
      tf: (entity, field) => tField(entity, field, locale, baseLocale),
    }),
    [locale, locales, baseLocale]
  );

  return (
    <SiteLocaleContext.Provider value={value}>
      <div dir={isRTLLocale(locale) ? "rtl" : "ltr"}>{children}</div>
    </SiteLocaleContext.Provider>
  );
}

export function SiteLanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale, locales, t } = useSiteLocale();
  const [open, setOpen] = useState(false);

  if (locales.length <= 1) return null;

  return (
    <div className="relative z-30 shrink-0">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={t("chooseLanguage")}
        className={`relative z-50 flex h-10 w-10 items-center justify-center rounded-full border font-mono text-[12px] font-bold uppercase tracking-wider shadow-sm transition-colors ${
          dark ? "border-paper/40 bg-black/20 text-paper backdrop-blur" : "border-line bg-paper text-ink"
        }`}
      >
        {localeCodes[locale]}
      </button>
      {open && (
        <div className="absolute end-0 top-12 z-50 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-paper text-ink shadow-lg">
          {locales.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setLocale(option);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 whitespace-nowrap px-4 py-2.5 text-sm hover:bg-crema/60"
              style={option === locale ? { color: "var(--brand)", fontWeight: 600 } : undefined}
            >
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider">{localeCodes[option]}</span>
              <span>{localeLabels[option]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
