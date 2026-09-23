"use client";

import Link from "next/link";
import { useMenu } from "@/components/menu/menu-provider";
import { ArrowLeftIcon } from "@/components/icons";

export function CategoryTabs({ activeId }: { activeId?: string }) {
  const { base, categories, t, tf } = useMenu();

  if (categories.length === 0) return null;

  return (
    <div className="sticky top-[var(--header-h)] z-30 border-b border-line/40 bg-paper/90 backdrop-blur-md">
      <div className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeId && (
          <Link
            href={`${base}/menu`}
            replace
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line/50 bg-crema/70 px-3.5 py-1.5 font-display text-xs font-semibold text-ink-soft transition-all hover:bg-crema hover:text-ink active:scale-95"
          >
            <ArrowLeftIcon size={14} />
            {t("categoriesLabel")}
          </Link>
        )}
        {categories.map((cat) => {
          const active = cat.id === activeId;
          return (
            <Link
              key={cat.id}
              href={`${base}/categories/${cat.id}`}
              replace
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 font-display text-xs sm:text-[13px] transition-all active:scale-95 ${
                active
                  ? "font-bold shadow-xs"
                  : "border border-line/40 bg-crema/60 font-medium text-ink-soft hover:bg-crema hover:text-ink"
              }`}
              style={active ? { background: "var(--brand)", color: "var(--brand-on)" } : undefined}
            >
              {tf(cat, "name")}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
