"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { GlobeIcon } from "@/components/icons";
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

// Bölüm çapaları: `id` sayfadaki bölümün kimliği (kaydırırken hangisinde
// olunduğu buradan izlenir). Dil kökü önek olarak eklenir (/#… ya da /en#…).
const LINKS = [
  { id: "platform", label: msg("Platform") },
  { id: "ozellikler", label: msg("Özellikler") },
  { id: "canli-menu", label: msg("Canlı demo") },
  { id: "fiyat", label: msg("Fiyatlar") },
] as const;

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

/** TR | EN seçici. Dil başına ayrı adres (/, /en): arama motorları iki dili de
 *  ayrı sayfa olarak dizinler; seçim çerezde hatırlanır. */
export function SiteLanguageSelect({ locale, compact = false }: { locale: UiLocale; compact?: boolean }) {
  const t = siteClientTranslator(locale);
  return (
    <div
      role="group"
      aria-label={t("Dil seçimi")}
      className={`inline-flex items-center rounded-md border border-line bg-paper/70 p-0.5 font-mono text-[12px] uppercase tracking-wider ${
        compact ? "" : "backdrop-blur"
      }`}
    >
      <GlobeIcon size={14} className="mx-1.5 text-ink-soft" />
      {UI_LOCALES.map((option) => {
        const active = option === locale;
        return (
          <a
            key={option}
            href={siteLocalePath(option)}
            hrefLang={option}
            lang={option}
            aria-current={active ? "true" : undefined}
            title={uiLocaleLabels[option]}
            onClick={() => rememberLocale(option)}
            className={`rounded px-2 py-1 transition-colors duration-200 ${
              active ? "bg-ink text-paper" : "text-ink-soft hover:bg-crema hover:text-ink"
            }`}
          >
            {uiLocaleCodes[option]}
          </a>
        );
      })}
    </div>
  );
}

export function Navbar({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteClientTranslator(locale);
  const home = siteLocalePath(locale);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const links = [
    ...LINKS.map((link) => ({ href: `${home}#${link.id}`, id: link.id as string, label: t(link.label) })),
    { href: "/docs", id: "", label: t("Yardım") },
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
    const sections = LINKS.map((link) => document.getElementById(link.id)).filter(
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
  }, []);

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
          <SiteLanguageSelect locale={locale} />
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
          <SiteLanguageSelect locale={locale} compact />
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
