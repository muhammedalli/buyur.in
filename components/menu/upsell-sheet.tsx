"use client";

import { useEffect } from "react";
import { unitPriceFor } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useMenu } from "@/components/menu/menu-provider";
import { CheckCircleIcon } from "@/components/icons";
import type { Product } from "@/lib/types";
import { productImageUrl } from "@/lib/files";

/** Görünür kalma süresi — müşteri dokunmazsa kendiliğinden kapanır. */
const AUTO_CLOSE_MS = 9000;

// "Sepete ekle" sonrası küçük öneri: yanına içecek. Oturum başına bir kez,
// sepet çubuğunun üstünde açılır; hiçbir akışı kilitlemez.
export function UpsellSheet({
  addedName,
  items,
  onAdd,
  onClose,
}: {
  addedName: string;
  items: Product[];
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const { t, tf } = useMenu();

  useEffect(() => {
    const id = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 px-4" role="dialog" aria-label={t("upsellTitle")}>
      <div className="upsell-in pointer-events-auto mx-auto max-w-3xl sm:flex sm:justify-end">
        <div className="w-full rounded-2xl border border-line bg-paper p-4 shadow-[0_24px_48px_-16px_rgba(35,24,18,0.55)] sm:w-96">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-herb">
                <CheckCircleIcon size={13} strokeWidth={2.2} />
                <span className="truncate">{t("upsellAdded", { name: addedName })}</span>
              </p>
              <p className="mt-1 font-display text-base font-bold leading-tight">{t("upsellTitle")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="-me-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-crema"
            >
              ✕
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {items.map((product) => {
              const image = productImageUrl(product, "card");
              return (
                <li key={product.id} className="flex items-center gap-3">
                  <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-crema">
                    {image && (
                      <picture>
                        <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      </picture>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{tf(product, "name")}</span>
                    <span className="block font-mono text-xs text-[var(--brand-text)]">
                      {formatPrice(unitPriceFor(product, []))}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdd(product)}
                    aria-label={`${tf(product, "name")} — ${t("addToCart")}`}
                    className="flex h-9 shrink-0 items-center rounded-full px-3.5 font-mono text-[12px] font-bold uppercase tracking-wider"
                    style={{ background: "var(--brand)", color: "var(--brand-on)" }}
                  >
                    + {t("addToCart")}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-md py-2 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-ink"
          >
            {t("noThanks")}
          </button>
        </div>
      </div>
    </div>
  );
}
