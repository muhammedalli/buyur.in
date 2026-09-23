"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent, trackOnce } from "@/lib/analytics/track-client";
import type { Product, Template } from "@/lib/types";
import { allergenLabels, badgeLabels } from "@/lib/labels";
import { formatPrice } from "@/lib/format";
import { BadgeIcon, CheckCircleIcon, ClockIcon, FlameIcon, PlusIcon } from "@/components/icons";
import { FadeImg } from "@/components/menu/fade-img";
import { ProductPlaceholder } from "@/components/menu/placeholder-art";
import { useMenu } from "@/components/menu/menu-provider";

export function ProductCard({
  product,
  template,
  onAdd,
  onOpen,
}: {
  product: Product;
  template: Template;
  onAdd: (product: Product) => void;
  onOpen?: () => void;
}) {
  const { business, locale, t, tf } = useMenu();
  const [added, setAdded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hasDiscount = product.discount_percent > 0;

  useEffect(() => {
    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        trackOnce(`product_view:${product.id}`, () => {
          trackEvent(business.slug, {
            type: "product_view",
            target: product.id,
            label: product.name,
            productId: product.id,
            categoryId: product.category,
            locale,
          });
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [product.id, product.name, product.category, business.slug, locale]);

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    onAdd(product);
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1100);
  }

  const finalPrice = hasDiscount ? product.price * (1 - product.discount_percent / 100) : product.price;
  const image = product.images?.[0];
  const isGrid = template === "grid";
  const name = tf(product, "name");
  const description = tf(product, "description");

  return (
    <div
      ref={cardRef}
      onClick={onOpen}
      data-reveal
      className={`group relative overflow-hidden rounded-2xl border border-line/60 bg-paper shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-[var(--brand)]/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] ${
        onOpen ? "cursor-pointer active:scale-[0.99]" : ""
      } ${isGrid ? "flex flex-col p-3 sm:p-3.5" : "flex gap-3.5 p-3.5 sm:p-4"}`}
    >
      <div
        className={
          isGrid
            ? "relative mb-2.5 aspect-square w-full overflow-hidden rounded-xl bg-crema/40"
            : "relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-crema/40"
        }
      >
        {image && !imageBroken ? (
          <picture>
            <FadeImg
              src={image}
              alt={name}
              loading="lazy"
              onError={() => setImageBroken(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </picture>
        ) : (
          <ProductPlaceholder size="sm" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base sm:text-lg font-bold leading-snug text-ink transition-colors group-hover:text-[var(--brand-text)]">
              {name}
            </h3>
            {!isGrid && (
              <div className="shrink-0 text-right">
                {hasDiscount && (
                  <p className="font-sans text-xs text-ink-soft line-through">{formatPrice(product.price)}</p>
                )}
                <p className="font-display text-base font-bold text-[var(--brand-text)]">{formatPrice(finalPrice)}</p>
              </div>
            )}
          </div>

          {(product.badges?.length > 0 || product.campaign_label) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {product.badges?.map((b) => (
                <span
                  key={b}
                  className="flex items-center gap-1 rounded-full border border-line/40 bg-crema/60 px-2 py-0.5 font-display text-[10px] font-medium text-ink-soft"
                >
                  <BadgeIcon badge={b} size={10} strokeWidth={2.2} />
                  {badgeLabels[locale][b]}
                </span>
              ))}
              {product.campaign_label && (
                <span className="rounded-full bg-herb/10 px-2 py-0.5 font-display text-[10px] font-semibold text-herb">
                  {tf(product, "campaign_label")}
                </span>
              )}
            </div>
          )}

          {description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">{description}</p>}

          {(product.prep_time_min > 0 || product.calories > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-3 font-display text-[11px] text-ink-soft">
              {product.prep_time_min > 0 && (
                <span className="flex items-center gap-1">
                  <ClockIcon size={12} />
                  {product.prep_time_min}
                  {product.prep_time_max > product.prep_time_min ? `-${product.prep_time_max}` : ""} {t("minUnit")}
                </span>
              )}
              {product.calories > 0 && (
                <span className="flex items-center gap-1">
                  <FlameIcon size={12} />
                  {product.calories} kcal
                </span>
              )}
            </div>
          )}

          {product.allergens?.length > 0 && (
            <p className="mt-1 text-[11px] text-ink-soft">
              {t("allergenPrefix")}: {product.allergens.map((a) => allergenLabels[locale][a]).join(", ")}
            </p>
          )}
        </div>

        {isGrid ? (
          <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-line/30 pt-2">
            <div>
              {hasDiscount && (
                <p className="font-sans text-[11px] text-ink-soft line-through">{formatPrice(product.price)}</p>
              )}
              <p className="font-display text-sm sm:text-base font-bold text-[var(--brand-text)]">
                {formatPrice(finalPrice)}
              </p>
            </div>
            <button
              onClick={handleAdd}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs transition-all duration-200 active:scale-90 ${
                added
                  ? "bg-herb text-white scale-105"
                  : "hover:opacity-90 active:scale-95"
              }`}
              style={!added ? { background: "var(--brand)", color: "var(--brand-on)" } : undefined}
              aria-label={t("addToCart")}
            >
              {added ? <CheckCircleIcon size={15} strokeWidth={2.2} /> : <PlusIcon size={15} strokeWidth={2.2} />}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleAdd}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-display text-xs font-semibold shadow-xs transition-all duration-200 active:scale-95 ${
                added
                  ? "bg-herb text-white"
                  : "hover:opacity-90"
              }`}
              style={!added ? { background: "var(--brand)", color: "var(--brand-on)" } : undefined}
            >
              {added ? (
                <>
                  <CheckCircleIcon size={13} strokeWidth={2.2} />
                  {t("addToCart")}
                </>
              ) : (
                <>
                  <PlusIcon size={13} strokeWidth={2.2} />
                  {t("addToCart")}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
