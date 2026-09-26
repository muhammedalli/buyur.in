"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";
import { formatDateRange } from "@/components/panel/charts/chart-utils";

// Global analiz filtreleri: tarih aralığı, karşılaştırma dönemi ve kırılım
// filtreleri. Sayfalar arası gezinirken korunur (URL + sekme oturumu), böylece
// "son 30 gün · Tatlılar" seçimi Ürünler sayfasına geçince kaybolmaz.
//
// URL'i next/navigation yerine history.replaceState ile güncelliyoruz: panel
// sayfaları statik prerender ediliyor ve useSearchParams orada Suspense sınırı
// istiyor — filtre yüzünden sayfa iskeletini bölmek istemedik.

export interface AnalyticsFilters {
  preset: string;
  from?: string;
  to?: string;
  compare: string;
  category?: string;
  product?: string;
  source?: string;
  device?: string;
}

const DEFAULT_FILTERS: AnalyticsFilters = { preset: "last_30", compare: "previous_period" };

const STORAGE_KEY = "buyur-analytics-filters";

export const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "last_7", label: "Son 7 gün" },
  { value: "last_30", label: "Son 30 gün" },
  { value: "last_90", label: "Son 90 gün" },
  { value: "this_month", label: "Bu ay" },
  { value: "last_month", label: "Geçen ay" },
  { value: "this_year", label: "Bu yıl" },
  { value: "last_year", label: "Geçen yıl" },
];

export const COMPARE_OPTIONS: { value: string; label: string }[] = [
  { value: "previous_period", label: "Önceki dönem" },
  { value: "previous_year", label: "Geçen yıl" },
  { value: "none", label: "Karşılaştırma yok" },
];

interface FilterContextValue {
  filters: AnalyticsFilters;
  setFilters: (next: Partial<AnalyticsFilters>) => void;
  clear: () => void;
  /** API'ye gönderilecek sorgu parametreleri. */
  params: Record<string, string | undefined>;
  hasDimensionFilter: boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function useAnalyticsFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) throw new Error("useAnalyticsFilters, AnalyticsFilterProvider içinde kullanılmalı");
  return context;
}

function readInitialFilters(): AnalyticsFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;

  const query = new URLSearchParams(window.location.search);
  const fromQuery: Partial<AnalyticsFilters> = {};
  for (const key of ["preset", "from", "to", "compare", "category", "product", "source", "device"] as const) {
    const value = query.get(key);
    if (value) fromQuery[key] = value;
  }
  if (Object.keys(fromQuery).length > 0) return { ...DEFAULT_FILTERS, ...fromQuery };

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_FILTERS, ...(JSON.parse(stored) as AnalyticsFilters) };
  } catch {
    /* yoksay */
  }
  return DEFAULT_FILTERS;
}

export function AnalyticsFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  // İlk render sunucu ile aynı kalsın diye kayıtlı filtreleri mount sonrası okuyoruz.
  useEffect(() => {
    setFiltersState(readInitialFilters());
  }, []);

  const persist = useCallback((next: AnalyticsFilters) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* yoksay */
    }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${query.toString()}`);
  }, []);

  const setFilters = useCallback(
    (partial: Partial<AnalyticsFilters>) => {
      setFiltersState((current) => {
        const next = { ...current, ...partial };
        // Preset seçildiğinde özel tarihler temizlenir, tersi de geçerli.
        if (partial.preset && partial.preset !== "custom") {
          delete next.from;
          delete next.to;
        }
        if (partial.from || partial.to) next.preset = "custom";
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clear = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    persist(DEFAULT_FILTERS);
  }, [persist]);

  const value = useMemo<FilterContextValue>(
    () => ({
      filters,
      setFilters,
      clear,
      params: {
        preset: filters.preset,
        from: filters.from,
        to: filters.to,
        compare: filters.compare,
        category: filters.category,
        product: filters.product,
        source: filters.source,
        device: filters.device,
      },
      hasDimensionFilter: Boolean(filters.category || filters.product || filters.source || filters.device),
    }),
    [filters, setFilters, clear]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

function Dropdown({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        aria-expanded={open}
        aria-label={label}
        className="flex items-center gap-2 rounded-md border border-line bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-wider text-ink transition-colors hover:border-paprika hover:text-paprika"
      >
        {icon}
        {active?.label ?? label}
        <span aria-hidden className="text-[10px] text-ink-soft">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md border border-line bg-paper py-1 shadow-[0_18px_40px_-20px_rgba(35,24,18,0.55)]">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-crema/70 ${
                  selected ? "font-semibold" : ""
                }`}
              >
                {option.label}
                {selected && (
                  <span className="text-paprika" aria-hidden>
                    <CheckCircleIcon size={15} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Filtre satırı — grafiklerin üstünde tek sıra, hepsini birden kapsar. */
export function AnalyticsFilterBar({ children }: { children?: ReactNode }) {
  const { filters, setFilters, clear, hasDimensionFilter } = useAnalyticsFilters();
  const [customOpen, setCustomOpen] = useState(false);

  const rangeLabel =
    filters.preset === "custom" && filters.from && filters.to
      ? formatDateRange(filters.from, filters.to)
      : (RANGE_OPTIONS.find((option) => option.value === filters.preset)?.label ?? "Son 30 gün");

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Dropdown
        label="Tarih aralığı"
        value={filters.preset}
        options={[...RANGE_OPTIONS, ...(filters.preset === "custom" ? [{ value: "custom", label: rangeLabel }] : [])]}
        onChange={(value) => setFilters({ preset: value })}
        icon={<ClockIcon size={14} />}
      />

      <Dropdown
        label="Karşılaştırma"
        value={filters.compare}
        options={COMPARE_OPTIONS}
        onChange={(value) => setFilters({ compare: value })}
      />

      <button
        type="button"
        onClick={() => setCustomOpen((open) => !open)}
        className="rounded-md border border-line bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-wider text-ink-soft transition-colors hover:border-paprika hover:text-paprika"
      >
        Özel aralık
      </button>

      {customOpen && (
        <div className="flex items-center gap-2 rounded-md border border-line bg-crema/50 px-3 py-1.5">
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => setFilters({ from: event.target.value })}
            className="bg-transparent font-mono text-[12px] text-ink outline-none"
            aria-label="Başlangıç tarihi"
          />
          <span className="text-ink-soft">→</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => setFilters({ to: event.target.value })}
            className="bg-transparent font-mono text-[12px] text-ink outline-none"
            aria-label="Bitiş tarihi"
          />
        </div>
      )}

      {children}

      {(hasDimensionFilter || filters.preset !== "last_30" || filters.compare !== "previous_period") && (
        <button
          type="button"
          onClick={clear}
          className="ml-auto font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
        >
          Filtreleri temizle
        </button>
      )}
    </div>
  );
}
