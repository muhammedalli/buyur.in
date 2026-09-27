"use client";

import { useEffect, useRef, useState } from "react";
import { sectionId } from "@/lib/landing-sections";
import { menuUrl } from "@/lib/site";
import { ExternalLinkIcon } from "@/components/icons";
import { siteClientTranslator } from "@/lib/ui-messages/site-client";
import type { UiLocale } from "@/lib/ui-i18n";

// Ekran görüntüsü değil, gerçek menü: landing'de canlı menü bir telefon
// çerçevesinde açılır. İframe yalnızca geniş ekranda ve bölüm görünür olunca
// yüklenir (sayfa açılışını yavaşlatmasın). Gömülü görüntülemeler işletmenin
// analizine yazılmaz (bkz. lib/analytics/track-client.ts isEmbedded).

export function LiveMenu({
  slug,
  name,
  kind,
  stats,
  locale = "tr",
}: {
  slug: string;
  name: string;
  kind: "customer" | "demo";
  stats: { categories: number; products: number; languages: number } | null;
  locale?: UiLocale;
}) {
  const t = siteClientTranslator(locale);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [embed, setEmbed] = useState(false);
  // Kök adres işletmenin vitrinidir; burada gösterilen menünün kendisi (/menu).
  const [url, setUrl] = useState(`https://${slug}.buyur.in/menu`);

  useEffect(() => {
    setUrl(`${menuUrl(slug)}/menu`);
  }, [slug]);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setEmbed(true);
      },
      { rootMargin: "200px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const openUrl = `${url}?utm_source=buyur&utm_medium=landing&utm_campaign=live_section`;

  return (
    <section
      ref={sectionRef}
      id={sectionId("liveMenu", locale)}
      data-track-view="live_demo_viewed"
      className="border-b border-line bg-ink text-paper"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">
            {kind === "customer" ? t("Canlı müşteri menüsü") : t("Canlı demo menü")}
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("Gerçek bir menüyü şimdi deneyin")}
          </h2>
          <p className="mt-5 leading-relaxed text-paper/70">
            {t(
              "Bu bir ekran görüntüsü değil: {name} menüsü burada canlı açılıyor. Dil seçin, kategorilere girin, sepete ekleyin — müşterinizin telefonunda göreceği deneyim birebir bu.",
              { name }
            )}
          </p>

          {stats && stats.products > 0 && (
            <dl className="mt-8 grid max-w-sm grid-cols-3 gap-4 border-t border-paper/15 pt-6">
              {[
                [t("Kategori"), stats.categories],
                [t("Ürün"), stats.products],
                [t("Dil"), stats.languages],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-paper/50">{label}</dt>
                  <dd className="mt-1 font-display text-3xl font-extrabold">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-track="live_demo_open"
              data-track-location="live_section"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-paprika px-7 py-3.5 font-mono text-[13px] uppercase tracking-wider text-paper transition-colors hover:bg-paprika-deep"
            >
              <ExternalLinkIcon size={15} strokeWidth={2} />
              {t("Menüyü yeni sekmede aç")}
            </a>
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-paper/40">
            {t("Kendi menünüz de bu adreste yayında olur: {slug}.buyur.in → sizin-adiniz.buyur.in", { slug })}
          </p>
        </div>

        {/* Telefon çerçevesi — yalnızca geniş ekranda */}
        <div data-reveal="right" className="hidden lg:block">
          <div className="hero-float relative w-[320px] rounded-[2.6rem] border-[7px] border-paper/90 bg-[#171310] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
            <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#171310]" aria-hidden />
            <div className="h-[620px] overflow-hidden rounded-[2rem] bg-paper">
              {embed ? (
                <iframe
                  src={url}
                  title={t("{name} canlı menü", { name })}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  {t("Menü yükleniyor…")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
