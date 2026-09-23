"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMenu } from "@/components/menu/menu-provider";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { ChevronRightIcon, StarIcon } from "@/components/icons";
import { ProductPlaceholder } from "@/components/menu/placeholder-art";

export function CategoryDrawer({ onClose }: { onClose: () => void }) {
  const { business, base, categories, imageByCategory, productCountByCategory, t, tf } = useMenu();
  // Açıkken arkadaki menü kaymasın.
  useBodyScrollLock(true);
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" aria-hidden />
      <div
        className="relative flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line/40 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {business.logo_url ? (
              <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-line/50 bg-paper shadow-xs">
                <picture>
                  <img src={business.logo_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </picture>
              </span>
            ) : null}
            <span className="truncate font-display text-base font-bold leading-tight text-ink">{tf(business, "name")}</span>
          </div>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line/40 bg-crema/60 text-ink-soft transition-colors hover:bg-crema hover:text-ink"
          >
            ✕
          </button>
        </div>

        <p className="px-5 pt-4 font-display text-xs font-bold uppercase tracking-wider text-ink-soft">{t("categoriesLabel")}</p>

        <nav className="flex flex-col gap-1.5 px-3 py-3">
          {categories.map((cat) => {
            const href = `${base}/categories/${cat.id}`;
            const active = pathname === href;
            const image = cat.image_url || imageByCategory.get(cat.id);
            const count = productCountByCategory.get(cat.id) ?? 0;
            return (
              <Link
                key={cat.id}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-200 hover:bg-crema/70 active:scale-[0.98]"
                style={active ? { background: "color-mix(in srgb, var(--brand) 12%, transparent)" } : undefined}
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-crema/60">
                  {image ? (
                    <picture>
                      <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    </picture>
                  ) : (
                    <ProductPlaceholder size="sm" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate font-display text-[14px] font-bold leading-tight text-ink"
                    style={active ? { color: "var(--brand-text)" } : undefined}
                  >
                    {tf(cat, "name")}
                  </span>
                  <span className="block font-sans text-xs text-ink-soft">{t("productCount", { count })}</span>
                </span>
                <ChevronRightIcon size={16} className="shrink-0 text-ink-soft/60" />
              </Link>
            );
          })}
        </nav>

        {/* Değerlendirme bağlantısı */}
        <div className="mt-auto border-t border-line/40 p-3.5">
          <Link
            href={`${base}/review`}
            onClick={onClose}
            className="flex items-center justify-between rounded-2xl border border-line/60 bg-crema/40 p-3 transition-all duration-200 hover:border-[var(--brand)]/50 hover:bg-crema/70 active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs"
                style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)", color: "var(--brand-text)" }}
              >
                <StarIcon size={17} filled />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-xs font-bold text-ink">{t("reviewUsCta")}</p>
                <p className="truncate font-sans text-[11px] text-ink-soft">{t("reviewBannerTitle")}</p>
              </div>
            </div>
            <ChevronRightIcon size={14} className="shrink-0 text-ink-soft/60" />
          </Link>
        </div>
      </div>
    </div>
  );
}
