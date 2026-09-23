"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CartLine } from "@/lib/cart";
import { cartCount, cartTotal } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useMenu } from "@/components/menu/menu-provider";

// Yüzen sepet çubuğu — sepet sayfasına götürür (modal değil). Sepette ürün
// varken ve sepet sayfasında değilken görünür; sayaç arttığında kısa zıplar.
export function CartBar({ lines, base }: { lines: CartLine[]; base: string }) {
  const { t } = useMenu();
  const pathname = usePathname();
  const count = cartCount(lines);
  const [bump, setBump] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    const increased = count > prevCount.current;
    prevCount.current = count;
    if (!increased) return;
    setBump(true);
    const id = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(id);
  }, [count]);

  if (count === 0 || pathname.startsWith(`${base}/cart`)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 px-4">
      <div className="mx-auto flex max-w-3xl justify-end">
        <Link
          href={`${base}/cart`}
          style={{ background: "var(--brand)", color: "var(--brand-on)" }}
          className={`pointer-events-auto flex w-full items-center justify-between rounded-2xl px-5 py-3.5 shadow-xl sm:w-96 transition-transform active:scale-[0.98] ${bump ? "cart-pop" : ""}`}
        >
          <span className="font-display text-sm font-bold">{t("cartBarLabel", { count })}</span>
          <span className="font-display text-base font-bold">{formatPrice(cartTotal(lines))}</span>
        </Link>
      </div>
    </div>
  );
}
