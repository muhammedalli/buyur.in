"use client";

import { useState } from "react";
import { CATEGORICAL, CHART_INK_SOFT } from "@/components/panel/charts/palette";
import { formatNumber } from "@/components/panel/charts/chart-utils";
import { ChartEmpty, ChartTable } from "@/components/panel/charts/frame";

// Sıralama (ranking) çubukları. Nominal kategoriler tek renk taşır — çubuk boyu
// zaten değeri gösteriyor, rengi de aynı şeyi kodlamak kimlik kanalını harcar.
// Değer çubuğun ucunda; sığmıyorsa çubuğun dışında.

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** İkincil metin (ör. dönüşüm oranı) — sağda soluk gösterilir. */
  note?: string;
  href?: string;
}

export function BarList({
  items,
  valueFormatter = formatNumber,
  emptyLabel = "Bu dönemde kayıt oluşmamış.",
  max: maxOverride,
  color = CATEGORICAL[0],
  onSelect,
}: {
  items: BarDatum[];
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  max?: number;
  color?: string;
  onSelect?: (item: BarDatum) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (items.length === 0) return <ChartEmpty height={160} label={emptyLabel} />;

  const max = Math.max(1, maxOverride ?? Math.max(...items.map((item) => item.value)));

  return (
    <div>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const ratio = Math.max(0, item.value) / max;
          const interactive = Boolean(onSelect);
          return (
            <li key={item.key}>
              <div
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive ? () => onSelect?.(item) : undefined}
                onKeyDown={
                  interactive
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect?.(item);
                        }
                      }
                    : undefined
                }
                onPointerEnter={() => setHovered(item.key)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.key)}
                onBlur={() => setHovered(null)}
                className={`group rounded-md px-1 py-0.5 outline-none transition-colors ${
                  interactive ? "cursor-pointer hover:bg-crema/60 focus-visible:bg-crema/60" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {item.note && <span className="text-xs text-ink-soft">{item.note}</span>}
                    <span className="font-mono text-xs font-semibold tabular-nums">{valueFormatter(item.value)}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-crema">
                  {/* Veri ucu yuvarlak, taban köşesi düz: çubuk tek bir tabandan büyür */}
                  <div
                    className="h-full rounded-r-[4px] transition-all duration-300"
                    style={{
                      width: `${Math.max(ratio * 100, item.value > 0 ? 2 : 0)}%`,
                      background: color,
                      opacity: hovered && hovered !== item.key ? 0.55 : 1,
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ChartTable
        columns={[
          { key: "label", label: "Kayıt" },
          { key: "value", label: "Değer", align: "right" },
        ]}
        rows={items.map((item) => ({ label: item.label, value: valueFormatter(item.value) }))}
      />
    </div>
  );
}

/** Dikey sütun grafiği — saat/gün gibi sabit sayıda kova için. */
export function ColumnChart({
  values,
  labels,
  height = 160,
  color = CATEGORICAL[0],
  valueFormatter = formatNumber,
  emptyLabel = "Bu dönemde kayıt oluşmamış.",
}: {
  values: number[];
  labels: string[];
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...values, 0);

  if (max <= 0) return <ChartEmpty height={height} label={emptyLabel} />;

  return (
    <div>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {values.map((value, index) => (
          <div
            key={index}
            className="group relative flex h-full flex-1 items-end"
            onPointerEnter={() => setHovered(index)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            role="img"
            aria-label={`${labels[index]}: ${valueFormatter(value)}`}
          >
            <div
              className="w-full rounded-t-[4px] transition-all duration-300"
              style={{
                height: `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%`,
                background: color,
                opacity: hovered === null || hovered === index ? 1 : 0.55,
              }}
            />
            {hovered === index && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-paper px-2 py-1 text-xs shadow-[0_10px_24px_-14px_rgba(35,24,18,0.6)]">
                <span className="font-semibold tabular-nums">{valueFormatter(value)}</span>{" "}
                <span className="text-ink-soft">{labels[index]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px]" style={{ color: CHART_INK_SOFT }}>
        {labels.map((label, index) => (
          <span key={index} className="flex-1 text-center font-mono text-[9px]">
            {/* Kalabalık eksende her etiketi yazmıyoruz */}
            {labels.length > 12 ? (index % 3 === 0 ? label : "") : label}
          </span>
        ))}
      </div>
    </div>
  );
}
