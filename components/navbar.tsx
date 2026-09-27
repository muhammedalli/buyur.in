"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "@/components/icons";
import { sectionId, type LandingSection } from "@/lib/landing-sections";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { siteClientTranslator } from "@/lib/ui-messages/site-client";
import {
  msg,
  siteLocalePath,
  UI_LOCALE_COOKIE,
  UI_LOCALES,
  uiLocaleCodes,
  uiLocaleLabels,
  type UiLocale,
} from "@/lib/ui-i18n";

// Bölüm çapaları: kimlik dile göre (lib/landing-sections.ts); sayfadaki bölümün kimliği (kaydırırken hangisinde
// olunduğu buradan izlenir). Dil kökü önek olarak eklenir (/#… ya da /en#…).
const LINKS: { section: LandingSection; label: string }[] = [
  { section: "platform", label: msg("Platform") },
  { section: "features", label: msg("Özellikler") },
  { section: "liveMenu", label: msg("Canlı demo") },
  { section: "pricing", label: msg("Fiyatlar") },
];

// Hamburger — açıkken çizgiler çarpıya dönüşür (tek SVG, animasyonlu).
function MenuToggleIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <line
        x1="3" y1="6" x2="19" y2="6"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="origin-center transition-transform duration-300"
        style={open ? { transform: "translateY(5px) rotate(45deg)" } : undefined}
      />
      <line
        x1="3" y1="11" x2="19" y2="11"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="origin-center transition-opacity duration-200"
        style={open ? { opacity: 0 } : undefined}
      />
      <line
        x1="3" y1="16" x2="19" y2="16"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="origin-center transition-transform duration-300"
        style={open ? { transform: "translateY(-5px) rotate(-45deg)" } : undefined}
      />
    </svg>
  );
}

/** Dil tercihini çereze yazar: ana sayfaya dönüşte aynı dilde karşılanır (middleware). */
function rememberLocale(locale: UiLocale) {
  document.cookie = `${UI_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Dil seçici (açılır menü). Dil başına ayrı adres (/, /en): arama motorları iki
 *  dili de ayrı sayfa olarak dizinler; seçim çerezde hatırlanır. `hrefs` aynı
 *  sayfanın diğer dildeki adresini verir (yardım merkezi gibi alt sayfalar için);
 *  verilmeyen dil için dilin ana sayfası. */
export function SiteLanguageSelect({
  locale,
  hrefs,
}: {
  locale: UiLocale;
  hrefs?: Partial<Record<UiLocale, string>>;
}) {
  const t = siteClientTranslator(locale);
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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={t("Dil seçimi")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-paper/70 px-3 text-sm font-medium text-ink transition-colors hover:bg-crema"
      >
        <GlobeIcon size={15} className="text-ink-soft" />
        {uiLocaleCodes[locale]}
        <ChevronDownIcon size={14} className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("Dil seçimi")}
          className="absolute end-0 top-full z-50 mt-2 min-w-[10rem] rounded-md border border-line bg-paper p-1 text-ink shadow-lg"
        >
          {UI_LOCALES.map((option) => {
            const active = option === locale;
            return (
              <a
                key={option}
                role="menuitemradio"
                aria-checked={active}
                href={hrefs?.[option] ?? siteLocalePath(option)}
                hrefLang={option}
                lang={option}
                onClick={() => {
                  rememberLocale(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-sm px-3 py-2 text-sm transition-colors hover:bg-crema/70 ${
                  active ? "font-semibold" : ""
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-xs text-ink-soft">{uiLocaleCodes[option]}</span>
                <span className="flex-1">{uiLocaleLabels[option]}</span>
                {active && <CheckIcon size={15} className="shrink-0 text-paprika" />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** `languageHrefs`: bu sayfanın diğer dillerdeki adresi (yardım merkezi gibi);
 *  verilmezse dil seçici dilin ana sayfasına gider. */
export function Navbar({
  locale = "tr",
  languageHrefs,
}: {
  locale?: UiLocale;
  languageHrefs?: Partial<Record<UiLocale, string>>;
}) {
  const t = siteClientTranslator(locale);
  const home = siteLocalePath(locale);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const links = [
    ...LINKS.map((link) => {
      const id = sectionId(link.section, locale);
      return { href: `${home}#${id}`, id, label: t(link.label) };
    }),
    { href: siteLocalePath(locale, "/docs"), id: "", label: t("Yardım") },
  ];

  // Sayfa kaydırıldığında başlık daralır ve gölge kazanır.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Bulunulan bölümün bağlantısı vurgulanır (landing dışında bölüm yoksa hiçbiri).
  useEffect(() => {
    const sections = LINKS.map((link) => document.getElementById(sectionId(link.section, locale))).filter(
      (element): element is HTMLElement => element !== null
    );
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
        setActiveId(best && best[1] > 0 ? best[0] : null);
      },
      { threshold: [0, 0.15, 0.4], rootMargin: "-20% 0px -45% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [locale]);

  // Çekmece açıkken arka plan kaymasın; Esc ile kapansın.
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-paper/85 backdrop-blur-md transition-all duration-300 ${scrolled || open
          ? "border-line shadow-[0_8px_30px_-16px_rgba(35,24,18,0.35)]"
          : "border-transparent"
        }`}
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 transition-all duration-300 ${scrolled ? "py-3" : "py-4"
          }`}
      >
        <Link href={home} aria-label={t("buyur ana sayfa")} className="shrink-0">
          <Logo />
        </Link>

        {/* Masaüstü gezinme — bağlantılar altı çizgiyle açılır, bulunulan bölüm vurgulu */}
        <div className="hidden items-center gap-7 font-mono text-[13px] uppercase tracking-wider text-ink-soft lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={l.id && activeId === l.id ? "true" : undefined}
              className={`group relative py-1 transition-colors hover:text-ink ${l.id && activeId === l.id ? "nav-active" : ""}`}
            >
              {l.label}
              <span className="nav-underline absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-paprika transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <SiteLanguageSelect locale={locale} hrefs={languageHrefs} />
          <Link
            href="/panel/login"
            className="rounded-md px-4 py-2.5 font-mono text-[13px] uppercase tracking-wider text-ink-soft transition-colors hover:bg-crema hover:text-ink"
          >
            {t("Giriş yap")}
          </Link>
          <Link
            href="/panel/register"
            data-track="cta_click"
            data-track-location="nav"
            data-track-cta="create_free"
            className="shine-on-hover relative overflow-hidden rounded-md bg-ink px-5 py-2.5 font-mono text-[13px] uppercase tracking-wider text-paper transition-all duration-300 hover:bg-paprika hover:shadow-[0_10px_24px_-10px_rgba(232,73,31,0.9)]"
          >
            {t("Ücretsiz başla")}
          </Link>
        </div>

        {/* Mobil: dil seçici her zaman görünür, menü çekmecede */}
        <div className="flex items-center gap-2 lg:hidden">
          <SiteLanguageSelect locale={locale} hrefs={languageHrefs} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobil-menu"
            aria-label={open ? t("Menüyü kapat") : t("Menüyü aç")}
            className="-mr-1 rounded-md p-2 text-ink transition-colors hover:bg-crema"
          >
            <MenuToggleIcon open={open} />
          </button>
        </div>
      </nav>

      {/* Mobil çekmece */}
      {open && (
        <div
          id="mobil-menu"
          className="drawer-in border-t border-line bg-paper px-5 pb-7 pt-4 lg:hidden"
        >
          <div className="flex flex-col">
            {links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="drawer-item border-b border-line/70 py-4 font-display text-xl font-bold tracking-tight transition-colors hover:text-paprika"
                style={{ animationDelay: `${0.04 + i * 0.05}s` }}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div
            className="drawer-item mt-6 flex flex-col gap-3"
            style={{ animationDelay: `${0.04 + links.length * 0.05}s` }}
          >
            <Link
              href="/panel/register"
              onClick={() => setOpen(false)}
              className="rounded-md bg-paprika py-3.5 text-center font-mono text-sm uppercase tracking-wider text-paper"
            >
              {t("Ücretsiz başla")}
            </Link>
            <Link
              href="/panel/login"
              onClick={() => setOpen(false)}
              className="rounded-md border border-ink py-3.5 text-center font-mono text-sm uppercase tracking-wider text-ink"
            >
              {t("Giriş yap")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
