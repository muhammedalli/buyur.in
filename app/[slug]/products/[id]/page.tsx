"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { useMenu } from "@/components/menu/menu-provider";
import { allergenLabels, badgeLabels } from "@/lib/labels";
import { formatPrice } from "@/lib/format";
import { BadgeIcon, CheckCircleIcon, ClockIcon, FlameIcon, PlusIcon } from "@/components/icons";
import { ImageCredit } from "@/components/menu/image-credit";
import { CategoryPlaceholder } from "@/components/menu/placeholder-art";
import type { Product, ProductOption } from "@/lib/types";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { business, base, addProduct, track, locale, t, tf } = useMenu();
  const [product, setProduct] = useState<Product | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      pb.collection("buyur_products").getOne<Product>(id, { requestKey: null }),
      pb.collection("buyur_product_options").getFullList<ProductOption>({
        filter: pb.filter("product = {:id}", { id }),
        requestKey: null,
        sort: "order,created",
      }),
    ])
      .then(([prod, opts]) => {
        if (cancelled) return;
        setProduct(prod);
        setOptions(opts);
        setLoading(false);
        track({
          type: "product_detail_view",
          target: prod.id,
          label: prod.name,
          productId: prod.id,
          categoryId: prod.category,
        });
      })
      .catch(() => {
        if (!cancelled) router.replace(`${base}/menu`);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, base, router]);

  if (loading || !product) {
    return <p className="py-20 text-center text-ink-soft">{t("loading")}</p>;
  }

  const hasDiscount = product.discount_percent > 0;
  const finalPrice = hasDiscount ? product.price * (1 - product.discount_percent / 100) : product.price;
  const image = product.images?.[0];
  const name = tf(product, "name");
  const description = tf(product, "description");

  const optionGroups = new Map<string, ProductOption[]>();
  for (const opt of options) {
    const list = optionGroups.get(opt.group_name) ?? [];
    list.push(opt);
    optionGroups.set(opt.group_name, list);
  }

  return (
    <div className="pb-10">
      {image && !imageBroken ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-crema sm:aspect-[2/1]">
          <picture>
            <img
              src={image}
              alt={name}
              loading="eager"
              fetchPriority="high"
              onError={() => setImageBroken(true)}
              className="ken-burns absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper/60 to-transparent" />
        </div>
      ) : (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-crema sm:aspect-[2/1]">
          <CategoryPlaceholder />
        </div>
      )}
      {image && !imageBroken && <ImageCredit product={product} locale={locale} />}

      <div className="space-y-4 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl font-bold leading-tight text-ink">{name}</h1>
          <div className="shrink-0 text-right">
            {hasDiscount && <p className="font-sans text-sm text-ink-soft line-through">{formatPrice(product.price)}</p>}
            <p className="font-display text-2xl font-bold text-[var(--brand-text)]">
              {formatPrice(finalPrice)}
            </p>
          </div>
        </div>

        {(product.badges?.length > 0 || product.campaign_label) && (
          <div className="flex flex-wrap gap-1.5">
            {product.badges?.map((b) => (
              <span
                key={b}
                className="flex items-center gap-1.5 rounded-full border border-line/40 bg-crema/60 px-3 py-1 font-display text-xs font-medium text-ink-soft"
              >
                <BadgeIcon badge={b} size={12} strokeWidth={2.2} />
                {badgeLabels[locale][b]}
              </span>
            ))}
            {product.campaign_label && (
              <span className="rounded-full bg-herb/10 px-3 py-1 font-display text-xs font-semibold text-herb">
                {tf(product, "campaign_label")}
              </span>
            )}
          </div>
        )}

        {description && <p className="text-sm leading-relaxed text-ink-soft">{description}</p>}

        {(product.prep_time_min > 0 || product.calories > 0) && (
          <div className="flex flex-wrap gap-4 font-display text-xs text-ink-soft">
            {product.prep_time_min > 0 && (
              <span className="flex items-center gap-1.5">
                <ClockIcon size={14} />
                {product.prep_time_min}
                {product.prep_time_max > product.prep_time_min ? `-${product.prep_time_max}` : ""} {t("minUnit")}
              </span>
            )}
            {product.calories > 0 && (
              <span className="flex items-center gap-1.5">
                <FlameIcon size={14} />
                {product.calories} kcal
              </span>
            )}
          </div>
        )}

        {product.allergens?.length > 0 && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-ink-soft">{t("allergensLabel")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {product.allergens.map((a) => (
                <span key={a} className="rounded-full border border-line/50 bg-crema/40 px-2.5 py-1 text-xs text-ink-soft">
                  {allergenLabels[locale][a]}
                </span>
              ))}
            </div>
          </div>
        )}

        {optionGroups.size > 0 && (
          <div className="space-y-3">
            {Array.from(optionGroups.entries()).map(([groupName, groupOptions]) => (
              <div key={groupName} className="rounded-2xl border border-line/60 bg-crema/30 p-4 shadow-xs">
                <p className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {tf(groupOptions[0], "group_name")}
                </p>
                <div className="mt-2 space-y-2">
                  {groupOptions.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{tf(opt, "name")}</span>
                      <span className="font-display font-semibold text-[var(--brand-text)]">
                        {opt.price_delta >= 0 ? "+" : ""}
                        {formatPrice(opt.price_delta)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            addProduct(product);
            setAdded(true);
            if (addedTimer.current) clearTimeout(addedTimer.current);
            addedTimer.current = setTimeout(() => setAdded(false), 1100);
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-base font-bold shadow-md transition-all active:scale-[0.98] ${
            added ? "cart-pop bg-herb text-white" : "hover:opacity-95"
          }`}
          style={!added ? { background: "var(--brand)", color: "var(--brand-on)" } : undefined}
        >
          {added ? (
            <>
              <CheckCircleIcon size={18} strokeWidth={2.4} />
              {t("addToCart")}
            </>
          ) : (
            <>
              <PlusIcon size={18} strokeWidth={2.4} />
              {t("addToCart")} · {formatPrice(finalPrice)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
