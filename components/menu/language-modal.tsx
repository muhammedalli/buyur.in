"use client";

import { localeCodes, localeLabels, type Locale } from "@/lib/i18n";
import { useMenu } from "@/components/menu/menu-provider";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

// İlk ziyarette gösterilen dil seçim modalı — kampanya popup'ından önce gelir.
// Ziyaretçi bir dil seçince kapanır ve seçim hatırlanır.
export function LanguageModal({ onPick }: { onPick: (locale: Locale) => void }) {
  const { business, locales, tf, t } = useMenu();
  // Açıkken arkadaki menü kaymasın.
  useBodyScrollLock(true);

  return (
    <div className="fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5">
      <div className="pop-in w-full max-w-sm overflow-hidden rounded-2xl bg-paper shadow-2xl">
        <div className="flex flex-col items-center gap-2 px-6 pt-7 text-center">
          {business.logo_url ? (
            <span className="relative mb-1 block h-14 w-14 overflow-hidden rounded-2xl border border-line bg-paper">
              <picture>
                <img src={business.logo_url} alt="" loading="eager" className="absolute inset-0 h-full w-full object-cover" />
              </picture>
            </span>
          ) : null}
          <h2 className="font-display text-xl font-bold leading-tight">{tf(business, "name")}</h2>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{t("chooseLanguage")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-6">
          {locales.map((l, index) => (
            <button
              key={l}
              onClick={() => onPick(l)}
              style={{ animationDelay: `${0.08 + index * 0.04}s` }}
              className="drawer-item flex items-center gap-2.5 rounded-xl border border-line px-4 py-3 text-start transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 active:scale-[0.98]"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold uppercase tracking-wider"
                style={{ background: "var(--brand)", color: "var(--brand-on)" }}
              >
                {localeCodes[l]}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">{localeLabels[l]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
