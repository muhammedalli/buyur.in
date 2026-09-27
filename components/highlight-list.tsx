import { HighlightIcon } from "@/components/icons";
import { highlightLabels } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";
import type { Highlight } from "@/lib/types";

// Mekân özellikleri (Wi-Fi, otopark, erişilebilir…) herkese açık yüzeylerde
// ikon + ad olarak gösterilir. Menü bilgi paneli ve vitrin `chips`, web
// sitesinin "Hakkımızda" bölümü `grid` kullanır; ikon işletmenin marka rengini
// alır. Seçim sınırı yoktur, liste kaç özellik olursa olsun satıra sığar.
export function HighlightList({
  highlights,
  locale,
  variant = "chips",
}: {
  highlights: Highlight[];
  locale: Locale;
  variant?: "chips" | "grid";
}) {
  if (highlights.length === 0) return null;

  if (variant === "grid") {
    return (
      <ul className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {highlights.map((highlight) => (
          <li key={highlight} className="flex min-w-0 items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-[var(--brand-text)]">
              <HighlightIcon highlight={highlight} size={16} strokeWidth={2} />
            </span>
            <span className="min-w-0 font-medium leading-snug">{highlightLabels[locale][highlight]}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {highlights.map((highlight) => (
        <li
          key={highlight}
          className="flex max-w-full items-center gap-1.5 rounded-full border border-line/70 bg-crema/50 px-3 py-1.5 text-xs font-medium text-ink"
        >
          <HighlightIcon highlight={highlight} size={14} strokeWidth={2} className="shrink-0 text-[var(--brand-text)]" />
          <span className="min-w-0 truncate">{highlightLabels[locale][highlight]}</span>
        </li>
      ))}
    </ul>
  );
}
