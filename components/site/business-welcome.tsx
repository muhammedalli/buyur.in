"use client";

import { useEffect, useRef, useState } from "react";
import type { Business } from "@/lib/types";
import { useSiteLocale, SiteLanguageSwitcher } from "@/components/site/site-locale";
import { useMenuHref } from "@/components/site/storefront-links";
import { BusinessInfoContent } from "@/components/menu/business-info";
import { Marquee } from "@/components/marquee";
import { PoweredBy } from "@/components/powered-by";
import { ArrowRightIcon, MessageIcon, PhoneIcon, WhatsappIcon } from "@/components/icons";
import { businessMarqueeItems } from "@/lib/marquee";
import { reservationAction } from "@/lib/site-content";
import { PLATFORM_BRANDING, showsPlatformSignature } from "@/lib/branding";

// İşletmenin web sitesi yoksa vitrinde (isletme.buyur.in) gösterilen karşılama
// sayfası. Ayrı bir içerik girilmez: tamamı panelde girilmiş işletme
// bilgilerinden türetilir (kapak, logo, ad, açıklama, adres, saatler, iletişim,
// sosyal medya). Boş alan hiçbir koşulda çizilmez.
//
// Tek amacı misafiri hızla menüye geçirmek: ana eylem "Menüyü gör"; ekran
// kaydırılıp bu buton görünmez olunca altta yapışkan bir kopyası belirir.

export function BusinessWelcome({ business }: { business: Business }) {
  const { t, tf, locale, baseLocale } = useSiteLocale();
  const menuHref = useMenuHref(business.slug);
  const reviewHref = useMenuHref(business.slug, "/review");
  const ctaRef = useRef<HTMLAnchorElement | null>(null);
  const [ctaHidden, setCtaHidden] = useState(false);

  const name = tf(business, "name");
  const description = tf(business, "description").trim();
  const marquee = businessMarqueeItems(business, locale, baseLocale);
  const reservation = reservationAction(business);
  const hasCover = Boolean(business.cover_url);

  // Ana buton ekrandan çıkınca alttaki yapışkan kopya görünür.
  useEffect(() => {
    const element = ctaRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCtaHidden(!entry.isIntersecting), {
      rootMargin: "0px 0px -40px 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-dvh bg-paper pb-28 text-ink">
      {/* Kapak: yoksa marka renginden yumuşak bir zemin — boş gri kutu değil. */}
      <header className="relative isolate">
        <div className="relative h-[42svh] min-h-[260px] max-h-[460px] w-full overflow-hidden">
          {hasCover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={business.cover_url}
                alt=""
                fetchPriority="high"
                className="welcome-cover absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-paper" />
            </>
          ) : (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 20% 10%, color-mix(in srgb, var(--brand) 38%, transparent), transparent 60%), radial-gradient(90% 80% at 90% 30%, color-mix(in srgb, var(--brand) 22%, transparent), transparent 65%), var(--color-crema)",
              }}
            />
          )}
        </div>
        <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
          <SiteLanguageSwitcher dark={hasCover} />
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-20 max-w-xl px-5 sm:-mt-24">
        <div className="flex flex-col items-center text-center">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt=""
              className="rise rise-1 h-24 w-24 rounded-2xl border-4 border-paper bg-paper object-cover shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] sm:h-28 sm:w-28"
            />
          ) : (
            <span
              aria-hidden
              className="rise rise-1 flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-paper font-display text-4xl font-extrabold shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] sm:h-28 sm:w-28"
              style={{ background: "var(--brand)", color: "var(--brand-on)" }}
            >
              {name.charAt(0)}
            </span>
          )}

          <p className="rise rise-2 mt-5 text-xs font-medium text-[var(--brand-text)]">
            {t("welcomeTitle")}
          </p>
          <h1 className="rise rise-2 mt-1.5 font-display text-[2.1rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {name}
          </h1>
          {description && (
            <p className="rise rise-3 mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">{description}</p>
          )}

          <a
            ref={ctaRef}
            href={menuHref}
            className="rise rise-4 group mt-7 flex w-full items-center justify-center gap-3 rounded-2xl py-4 font-display text-lg font-extrabold shadow-[0_18px_36px_-16px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
          >
            {t("seeMenu")}
            <ArrowRightIcon size={20} className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </a>

          {reservation && (
            <a
              href={reservation.href}
              target={reservation.kind === "phone" ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="rise rise-5 mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-paper py-3.5 font-display text-sm font-bold text-ink transition-colors hover:border-[var(--brand)]"
            >
              {reservation.kind === "whatsapp" ? <WhatsappIcon size={16} /> : <PhoneIcon size={16} />}
              {reservation.kind === "whatsapp" ? t("reservationViaWhatsapp") : t("reservationViaPhone")}
            </a>
          )}
        </div>
      </main>

      {marquee.length > 0 && (
        <Marquee items={marquee} tone="brand" label={t("announcementsLabel")} className="mt-10 py-3" />
      )}

      <section data-reveal className="mx-auto mt-10 max-w-xl px-5">
        <h2 className="mb-3 text-xs font-medium text-ink-soft">{t("visitUs")}</h2>
        <div className="rounded-3xl border border-line/70 bg-paper p-5 shadow-[0_10px_30px_-22px_rgba(35,24,18,0.45)] sm:p-6">
          <BusinessInfoContent business={business} header={false} />
        </div>

        <a
          href={reviewHref}
          className="mx-auto mt-6 flex w-fit items-center gap-2 text-sm font-semibold text-ink transition-opacity hover:opacity-70"
        >
          <MessageIcon size={16} />
          {t("reviewUsCta")}
        </a>
      </section>

      {showsPlatformSignature(business) && (
        <footer className="mt-10 flex justify-center px-5">
          <PoweredBy label={t("poweredByBuyur", { brand: PLATFORM_BRANDING.name })} />
        </footer>
      )}

      {/* Mobilde ana buton ekrandan çıkınca: yapışkan "Menüyü gör". */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-all duration-300 sm:hidden ${
          ctaHidden ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        }`}
        aria-hidden={!ctaHidden}
      >
        <a
          href={menuHref}
          tabIndex={ctaHidden ? 0 : -1}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 font-display text-base font-extrabold shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)]"
          style={{ background: "var(--brand)", color: "var(--brand-on)" }}
        >
          {t("seeMenu")}
          <ArrowRightIcon size={18} className="rtl:rotate-180" />
        </a>
      </div>
    </div>
  );
}
