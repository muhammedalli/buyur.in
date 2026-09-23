"use client";

import Link from "next/link";
import { cartTotal } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useMenu } from "@/components/menu/menu-provider";
import { ShoppingBagIcon } from "@/components/icons";

export default function CartPage() {
  const { base, cartLines, updateQuantity, removeLine, t } = useMenu();

  return (
    <div className="px-5 py-6">
      <h1 className="font-display text-2xl font-extrabold">{t("cartTitle")}</h1>

      {cartLines.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-crema text-ink-soft">
            <ShoppingBagIcon size={28} />
          </div>
          <p className="text-sm text-ink-soft">{t("cartEmpty")}</p>
          <Link
            href={`${base}/menu`}
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
            className="rounded-full px-6 py-2.5 font-display text-sm font-semibold transition-opacity hover:opacity-90 active:scale-95 shadow-xs"
          >
            {t("viewMenu")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            {cartLines.map((line) => (
              <div key={line.key} className="flex items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="font-medium">{line.name}</p>
                  {line.selections.length > 0 && (
                    <p className="text-xs text-ink-soft">{line.selections.map((s) => s.name).join(", ")}</p>
                  )}
                  <div className="mt-2 flex w-fit items-center gap-2 rounded-full border border-line px-2.5 py-1">
                    <button
                      onClick={() => updateQuantity(line.key, line.quantity - 1)}
                      className="text-base leading-none"
                      aria-label={t("decrease")}
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-mono text-sm">{line.quantity}</span>
                    <button
                      onClick={() => updateQuantity(line.key, line.quantity + 1)}
                      className="text-base leading-none"
                      aria-label={t("increase")}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium">{formatPrice(line.unitPrice * line.quantity)}</p>
                  <button
                    onClick={() => removeLine(line.key)}
                    className="mt-2 text-xs text-ink-soft transition-colors hover:text-[var(--brand-text)]"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="font-mono text-sm uppercase tracking-wider text-ink-soft">{t("total")}</span>
            <span className="font-display text-2xl font-bold">{formatPrice(cartTotal(cartLines))}</span>
          </div>
          <p className="mt-4 rounded-2xl bg-crema/60 px-4 py-3 text-center text-xs text-ink-soft">{t("showToWaiter")}</p>
        </>
      )}
    </div>
  );
}
