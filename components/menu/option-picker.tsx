"use client";

import { useMemo, useState } from "react";
import type { CartSelection } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import type { Product, ProductOption } from "@/lib/types";
import { useMenu } from "@/components/menu/menu-provider";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useAnimatedClose } from "@/lib/use-animated-close";

export function OptionPicker({
  product,
  options,
  onConfirm,
  onClose,
}: {
  product: Product;
  options: ProductOption[];
  onConfirm: (selections: CartSelection[], quantity: number) => void;
  onClose: () => void;
}) {
  const { t, tf } = useMenu();
  const { closing, close } = useAnimatedClose(onClose);
  // Açıkken arkadaki menü kaymasın.
  useBodyScrollLock(true);
  const groups = useMemo(() => {
    const map = new Map<string, ProductOption[]>();
    for (const opt of options) {
      const list = map.get(opt.group_name) ?? [];
      list.push(opt);
      map.set(opt.group_name, list);
    }
    return Array.from(map.entries());
  }, [options]);

  const [selected, setSelected] = useState<Record<string, ProductOption>>({});
  const [quantity, setQuantity] = useState(1);

  const selections: CartSelection[] = Object.values(selected).map((opt) => ({
    optionId: opt.id,
    groupName: tf(opt, "group_name"),
    name: tf(opt, "name"),
    priceDelta: opt.price_delta,
  }));

  const basePrice = product.discount_percent > 0 ? product.price * (1 - product.discount_percent / 100) : product.price;
  const unitPrice = basePrice + selections.reduce((sum, s) => sum + s.priceDelta, 0);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-5 ${closing ? "fade-out" : "fade-in"}`}
      onClick={close}
    >
      <div
        className={`max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-6 sm:rounded-2xl ${closing ? "sheet-down" : "sheet-up"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold">{tf(product, "name")}</h2>
        <div className="mt-5 space-y-5">
          {groups.map(([groupName, groupOptions]) => (
            <div key={groupName}>
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                {tf(groupOptions[0], "group_name")}
              </p>
              <div className="mt-2 space-y-2">
                {groupOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-2.5 text-sm transition-colors has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={groupName}
                        checked={selected[groupName]?.id === opt.id}
                        onChange={() => setSelected((prev) => ({ ...prev, [groupName]: opt }))}
                      />
                      {tf(opt, "name")}
                    </span>
                    <span className="font-mono text-ink-soft">
                      {opt.price_delta >= 0 ? "+" : ""}
                      {formatPrice(opt.price_delta)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 rounded-full border border-line px-3 py-1.5">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label={t("decrease")} className="text-lg">
              −
            </button>
            <span className="w-5 text-center font-mono">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => q + 1)} aria-label={t("increase")} className="text-lg">
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onConfirm(selections, quantity)}
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
            className="flex-1 rounded-full px-6 py-3 text-center font-mono text-[13px] uppercase tracking-wider transition-opacity hover:opacity-90"
          >
            {t("addToCart")} · {formatPrice(unitPrice * quantity)}
          </button>
        </div>
      </div>
    </div>
  );
}
