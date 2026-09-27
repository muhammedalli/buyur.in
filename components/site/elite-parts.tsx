"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { isRTLLocale } from "@/lib/i18n";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { useSiteLocale } from "@/components/site/site-locale";
import { useMenuHref } from "@/components/site/storefront-links";
import { typewriterPhrases, type MenuHighlightGroup } from "@/lib/site-content";
import type { Business } from "@/lib/types";

// Elite web sitesinin hareketli parçaları. Sitenin geri kalanı da artık
// istemci bileşeni (dil değişimi için, bkz. sections.tsx) ama animasyon ve
// sürüklenebilir kaydırma yalnızca burada gerekiyor.

/** Animasyonlu tipografi. Metinler işletmenin kendi verisinden gelir (uydurma
 *  slogan yok), seçili dile göre yeniden türetilir. prefers-reduced-motion
 *  açıksa animasyon çalışmaz, ilk ifade sabit gösterilir. */
export function Typewriter({ business, groups }: { business: Business; groups: MenuHighlightGroup[] }) {
  const { locale, baseLocale } = useSiteLocale();
  const phrases = typewriterPhrases(business, groups, locale, baseLocale);

  const [index, setIndex] = useState(0);
  const [text, setText] = useState(phrases[0] ?? "");
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  // Dil değişince ifade listesi de değişir — baştan başla.
  useEffect(() => {
    setIndex(0);
    setText(phrases[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (reduced || phrases.length < 2) return;

    const current = phrases[index % phrases.length] ?? "";
    let charIndex = 0;
    let deleting = false;

    const timer = setInterval(() => {
      if (!deleting) {
        charIndex += 1;
        setText(current.slice(0, charIndex));
        if (charIndex >= current.length) {
          deleting = true;
          // Tamamlanan ifade bir süre ekranda kalsın.
          charIndex += 18;
        }
      } else {
        charIndex -= 1;
        if (charIndex <= current.length) setText(current.slice(0, Math.max(0, charIndex)));
        if (charIndex <= 0) {
          deleting = false;
          setIndex((value) => (value + 1) % phrases.length);
        }
      }
    }, 70);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reduced, locale]);

  if (phrases.length === 0) return null;

  return (
    <p className="font-mono text-sm uppercase tracking-[0.25em] text-[var(--brand-on)]" aria-live="off">
      {reduced ? phrases[0] : text}
      {!reduced && <span className="ms-0.5 animate-pulse">|</span>}
    </p>
  );
}

/** Menü slider'ı: kategori kategori yatay kaydırma. Mevcut menü ürünlerini
 *  kullanır — ikinci bir ürün yönetimi yok. */
export function MenuSlider({ groups, slug }: { groups: MenuHighlightGroup[]; slug: string }) {
  const { t, tf, locale } = useSiteLocale();
  // Oklar görsel yöne göre kaydırır; sağdan sola dilde "geri" sağdaki oktur.
  const rtl = isRTLLocale(locale);
  const menuHref = useMenuHref(slug);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const group = groups[active];
  if (!group) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {groups.map((item, index) => (
          <button
            key={item.category.id}
            type="button"
            onClick={() => {
              setActive(index);
              trackRef.current?.scrollTo({ left: 0, behavior: "smooth" });
            }}
            className={`rounded-full px-4 py-2 font-mono text-[12px] uppercase tracking-wider transition-colors ${
              index === active
                ? "bg-[var(--brand)] text-[var(--brand-on)]"
                : "border border-line text-ink-soft hover:border-[var(--brand)] hover:text-ink"
            }`}
          >
            {tf(item.category, "name")}
          </button>
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label={rtl ? t("scrollMore") : t("back")}
          onClick={() => trackRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
          className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-paper p-2 text-ink-soft shadow-[0_10px_24px_-14px_rgba(35,24,18,0.5)] transition-colors hover:border-[var(--brand)] hover:text-ink sm:flex"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          type="button"
          aria-label={rtl ? t("back") : t("scrollMore")}
          onClick={() => trackRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
          className="absolute right-0 top-1/2 z-10 hidden translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-paper p-2 text-ink-soft shadow-[0_10px_24px_-14px_rgba(35,24,18,0.5)] transition-colors hover:border-[var(--brand)] hover:text-ink sm:flex"
        >
          <ChevronRightIcon size={18} />
        </button>

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {group.products.map((product, index) => (
            <article
              key={`${group.category.id}-${product.id}`}
              style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
              className="slide-in w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-paper"
            >
              {product.images?.[0] && (
                <div className="aspect-[4/3] overflow-hidden bg-crema">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images[0]}
                    alt={tf(product, "name")}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-bold">{tf(product, "name")}</h3>
                  <span className="shrink-0 font-mono text-sm font-semibold">{formatPrice(product.price)}</span>
                </div>
                {tf(product, "description") && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{tf(product, "description")}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <a
          href={menuHref}
          className="group inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-[var(--brand-text)] transition-opacity hover:opacity-75"
        >
          {t("openDigitalMenu")}
          <ArrowRightIcon size={14} className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </a>
      </div>
    </div>
  );
}
