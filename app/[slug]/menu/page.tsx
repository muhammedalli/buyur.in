"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMenu } from "@/components/menu/menu-provider";
import { CategoryTabs } from "@/components/menu/category-tabs";
import { FadeImg } from "@/components/menu/fade-img";
import { BadgeIcon, ChevronRightIcon, MessageIcon, SearchIcon, SparklesIcon, StarIcon } from "@/components/icons";
import { CategoryPlaceholder, ProductPlaceholder } from "@/components/menu/placeholder-art";
import { formatPrice } from "@/lib/format";
import { badgeLabels } from "@/lib/labels";
import { isRTLLocale } from "@/lib/i18n";
import type { Category, Product } from "@/lib/types";

/** Modern Kategori Karosu */
function CategoryTile({ category, image, count }: { category: Category; image?: string; count: number }) {
  const { base, locale, t, tf } = useMenu();
  const description = tf(category, "description");

  return (
    <Link
      href={`${base}/categories/${category.id}`}
      data-reveal
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line/60 bg-paper shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)]/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] active:scale-[0.98]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-crema/40">
        {image ? (
          <picture>
            <FadeImg
              src={image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </picture>
        ) : (
          <CategoryPlaceholder />
        )}
        {/* Ürün sayısı sayacı — yumuşak yarı saydam hap rozet */}
        <span className="absolute end-2.5 top-2.5 z-10 flex items-center rounded-full border border-line/40 bg-paper/90 px-2.5 py-0.5 font-display text-[11px] font-medium text-ink-soft shadow-xs backdrop-blur-md">
          {t("productCount", { count })}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold leading-tight text-ink transition-colors group-hover:text-[var(--brand-text)]">
            {tf(category, "name")}
          </p>
          {description && <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{description}</p>}
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crema/60 text-ink-soft transition-all duration-200 group-hover:translate-x-0.5 group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-on)]">
          <ChevronRightIcon size={14} className={isRTLLocale(locale) ? "rotate-180" : undefined} />
        </span>
      </div>
    </Link>
  );
}

/** Öne çıkan ürün kartı */
function FeaturedCard({ product }: { product: Product }) {
  const { base, locale, tf } = useMenu();
  const image = product.images?.[0];
  const hasDiscount = product.discount_percent > 0;
  const finalPrice = hasDiscount ? product.price * (1 - product.discount_percent / 100) : product.price;
  const badge = product.badges?.[0];
  const badgeText = product.campaign_label ? tf(product, "campaign_label") : badge ? badgeLabels[locale][badge] : null;

  return (
    <Link
      href={`${base}/products/${product.id}`}
      className="group w-[155px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line/60 bg-paper shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-[var(--brand)]/60 hover:shadow-[0_8px_18px_rgba(0,0,0,0.06)] active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-crema/40">
        {image ? (
          <picture>
            <FadeImg
              src={image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </picture>
        ) : (
          <ProductPlaceholder size="md" />
        )}
        {badgeText && (
          <span
            className="absolute start-2 top-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[10px] font-semibold tracking-tight shadow-xs"
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
          >
            {!product.campaign_label && badge && <BadgeIcon badge={badge} size={10} strokeWidth={2.2} />}
            {badgeText}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-1 font-display text-[13px] font-bold leading-tight text-ink transition-colors group-hover:text-[var(--brand-text)]">
          {tf(product, "name")}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5">
          {hasDiscount && <span className="font-sans text-[11px] text-ink-soft line-through">{formatPrice(product.price)}</span>}
          <span className="font-display text-[14px] font-bold text-[var(--brand-text)]">{formatPrice(finalPrice)}</span>
        </div>
      </div>
    </Link>
  );
}

/** Bizi Değerlendir / Görüş Bildir Banner Kartı */
function ReviewBanner() {
  const { base, locale, t } = useMenu();

  return (
    <section className="px-4 pt-8">
      <Link
        href={`${base}/review`}
        data-reveal
        className="group relative flex flex-col items-start gap-3.5 overflow-hidden rounded-3xl border border-line/70 bg-gradient-to-br from-paper via-crema/40 to-crema/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)]/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)] active:scale-[0.99]"
      >
        {/* Arka plan dekoratif marka parıltısı */}
        <div
          className="pointer-events-none absolute -end-6 -top-6 h-28 w-28 rounded-full opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
          style={{ background: "var(--brand)" }}
        />

        <div className="flex w-full items-center justify-between gap-3">
          {/* 5 Yıldız Grubu */}
          <div className="flex items-center gap-1 text-amber-400">
            {[...Array(5)].map((_, i) => (
              <StarIcon key={i} size={17} filled className="transition-transform duration-200 group-hover:scale-110" />
            ))}
          </div>

          {/* Kısa Rozet */}
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider shadow-2xs"
            style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)", color: "var(--brand-text)" }}
          >
            <SparklesIcon size={12} strokeWidth={2.5} />
            {t("reviewUsCta")}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16px] font-extrabold leading-snug text-ink transition-colors group-hover:text-[var(--brand-text)]">
            {t("reviewBannerTitle")}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {t("reviewBannerSubtitle")}
          </p>
        </div>

        <div className="mt-1 flex w-full items-center justify-between border-t border-line/40 pt-3">
          <span className="flex items-center gap-1.5 font-display text-xs font-bold text-ink transition-colors group-hover:text-[var(--brand-text)]">
            <MessageIcon size={15} className="text-ink-soft group-hover:text-[var(--brand-text)]" />
            {t("reviewBannerButton")}
          </span>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-1"
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
          >
            <ChevronRightIcon size={14} className={isRTLLocale(locale) ? "rotate-180" : undefined} />
          </span>
        </div>
      </Link>
    </section>
  );
}

export default function MenuCategoriesPage() {
  const { base, business, categories, products, categoriesLoading, imageByCategory, productCountByCategory, t, tf } =
    useMenu();

  const featured = useMemo(
    () => products.filter((p) => p.campaign_label || p.discount_percent > 0 || (p.badges?.length ?? 0) > 0).slice(0, 10),
    [products]
  );

  if (categoriesLoading) {
    return <p className="py-20 text-center text-ink-soft">{t("loading")}</p>;
  }

  if (categories.length === 0) {
    return <p className="py-20 text-center text-ink-soft">{t("menuPreparing")}</p>;
  }

  const description = tf(business, "description");

  return (
    <div className="pb-8">
      <CategoryTabs />

      {/* Tanıtım + arama çubuğu */}
      <div className="px-4 pt-4">
        {description && <p className="text-sm leading-relaxed text-ink-soft">{description}</p>}
        <Link
          href={`${base}/search`}
          className="mt-3.5 flex items-center gap-2.5 rounded-2xl border border-line/60 bg-crema/40 px-4 py-3 text-sm text-ink-soft shadow-xs transition-all duration-200 hover:border-[var(--brand)]/50 hover:bg-crema/70"
        >
          <SearchIcon size={18} className="text-ink-soft/70" />
          <span className="flex-1 text-ink-soft/80">{t("menuSearchCta")}…</span>
        </Link>
      </div>

      {featured.length >= 3 && (
        <section className="pt-6">
          <div className="flex items-center justify-between px-4">
            <h2 className="font-display text-lg font-bold tracking-tight">{t("menuFeatured")}</h2>
          </div>
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featured.map((product) => (
              <FeaturedCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="pt-6">
        <div className="flex items-center justify-between px-4">
          <h2 className="font-display text-lg font-bold tracking-tight">{t("menuAllCategories")}</h2>
          <span className="font-display text-xs font-medium text-ink-soft">
            {t("productCount", { count: products.length })}
          </span>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-3.5 px-4 sm:grid-cols-3">
          {categories.map((cat) => (
            <CategoryTile
              key={cat.id}
              category={cat}
              image={cat.image_url || imageByCategory.get(cat.id)}
              count={productCountByCategory.get(cat.id) ?? 0}
            />
          ))}
        </div>
      </section>

      {/* Değerlendirme Banner'ı */}
      <ReviewBanner />
    </div>
  );
}
