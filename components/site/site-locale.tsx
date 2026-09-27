"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "@/components/icons";
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

/** Dil seçici: dil kodunu gösteren buton + açılır liste. Dışarı tıklama ve
 *  Esc kapatır. Radix kullanılmaz: vitrin ve menü paketine panel kiti inmez. */
export function SiteLanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale, locales, t } = useSiteLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (locales.length <= 1) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={t("chooseLanguage")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-sm transition-colors ${
          dark ? "border-paper/40 bg-black/25 text-paper backdrop-blur hover:bg-black/35" : "border-line bg-paper text-ink hover:bg-crema/70"
        }`}
      >
        <GlobeIcon size={15} />
        {localeCodes[locale]}
        <ChevronDownIcon size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("chooseLanguage")}
          className="absolute end-0 top-full z-50 mt-2 min-w-[11rem] rounded-md border border-line bg-paper p-1 text-ink shadow-lg"
        >
          {locales.map((option) => {
            const active = option === locale;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocale(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-sm px-3 py-2 text-start text-sm transition-colors hover:bg-crema/70 ${
                  active ? "font-semibold" : ""
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-xs text-ink-soft">{localeCodes[option]}</span>
                <span className="flex-1">{localeLabels[option]}</span>
                {active && <CheckIcon size={15} className="shrink-0 text-[var(--brand-text)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
