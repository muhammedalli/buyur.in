"use client";

import { useEffect, useState } from "react";
import type { Business } from "@/lib/types";
import { useSiteLocale, SiteLanguageSwitcher } from "@/components/site/site-locale";
import { useMenuHref } from "@/components/site/storefront-links";
import { Marquee } from "@/components/marquee";
import { MenuIcon } from "@/components/icons";
import { businessMarqueeItems } from "@/lib/marquee";
import { businessLogoUrl } from "@/lib/files";

// İşletme sitesinin sabit parçaları: üst çubuk ve kayan yazı.

/** Üst çubuk: açılışta görünmez — hero kendi "Menüyü gör" eylemini ve
 *  işletmenin adını zaten taşır, görselin üstünde yüzen butonlar sırıtıyordu.
 *  Hero'nun üçte biri geçilince yapışkan çubuk olarak iner: işletme adı, dil
 *  seçici ve "Menü" düğmesi (site → menü geçişi) her an bir dokunuş uzakta. */
export function SiteHeader({ business }: { business: Business }) {
  const { t, tf } = useSiteLocale();
  const menuHref = useMenuHref(business.slug);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > window.innerHeight * 0.35);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      // Gizliyken odaklanılamaz ve ekran okuyucuya görünmez.
      inert={!visible}
      className={`fixed inset-x-0 top-0 z-40 border-b border-line/70 bg-paper/90 shadow-[0_8px_30px_-18px_rgba(35,24,18,0.45)] backdrop-blur-md transition-[transform,opacity] duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex min-w-0 items-center gap-2.5"
        >
          {businessLogoUrl(business, "small") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={businessLogoUrl(business, "small")} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-line/60 object-cover" />
          )}
          <span className="truncate font-display text-base font-bold text-ink">{tf(business, "name")}</span>
        </a>

        <div className="flex shrink-0 items-center gap-2">
          <SiteLanguageSwitcher />
          <a
            href={menuHref}
            className="site-menu-cta inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-on)] shadow-sm transition-transform duration-300 hover:-translate-y-0.5"
          >
            <MenuIcon size={15} />
            {t("navMenu")}
          </a>
        </div>
      </div>
    </header>
  );
}

/** Hero'nun hemen altındaki kayan yazı (Ayarlar → Kayan yazı). */
export function SiteMarquee({ business }: { business: Business }) {
  const { locale, baseLocale, t } = useSiteLocale();
  const items = businessMarqueeItems(business, locale, baseLocale);
  if (items.length === 0) return null;
  return <Marquee items={items} tone="brand" label={t("announcementsLabel")} className="py-3" />;
}
