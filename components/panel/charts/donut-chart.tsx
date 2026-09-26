"use client";

import { useState } from "react";
import { CHART_SURFACE, seriesColor } from "@/components/panel/charts/palette";
import { formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import { ChartEmpty, ChartTable } from "@/components/panel/charts/frame";

// Pay dağılımı (trafik kaynağı gibi). Dilim sayısı 6'yı geçerse kalanı "Diğer"e
// katlanır: palet sırası döngüye sokulmaz, okunmayan ince dilim de üretilmez.

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
}

const MAX_SLICES = 6;
const SIZE = 168;
const STROKE = 26;

export function DonutChart({
  items,
  centerLabel,
  emptyLabel = "Bu dönemde ziyaret kaydı yok.",
}: {
  items: DonutDatum[];
  centerLabel?: string;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = items.slice().sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, MAX_SLICES);
  const tail = sorted.slice(MAX_SLICES);
  const slices = tail.length
    ? [...head, { key: "other", label: "Diğer", value: tail.reduce((sum, item) => sum + item.value, 0) }]
    : head;

  const total = slices.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <ChartEmpty height={SIZE} label={emptyLabel} />;

  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <svg width={SIZE} height={SIZE} role="img" aria-label="Dağılım grafiği" className="shrink-0">
          <g transform={`translate(${SIZE / 2} ${SIZE / 2}) rotate(-90)`}>
            {slices.map((slice, index) => {
              const fraction = slice.value / total;
              const length = fraction * circumference;
              const dash = `${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`;
              const element = (
                <circle
                  key={slice.key}
                  r={radius}
                  fill="none"
                  stroke={seriesColor(index)}
                  strokeWidth={STROKE}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  opacity={hovered && hovered !== slice.key ? 0.5 : 1}
                  onPointerEnter={() => setHovered(slice.key)}
                  onPointerLeave={() => setHovered(null)}
                  style={{ transition: "opacity 200ms" }}
                />
              );
              offset += length;
              return element;
            })}
          </g>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={radius - STROKE / 2} fill={CHART_SURFACE} />
          <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" fontSize={22} fontWeight={700} fill="#231812">
            {formatNumber(total)}
          </text>
          {centerLabel && (
            <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" fontSize={10} fill="#5c4a3d">
              {centerLabel}
            </text>
          )}
        </svg>

        <ul className="w-full space-y-1.5">
          {slices.map((slice, index) => (
            <li
              key={slice.key}
              className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-crema/60"
              onPointerEnter={() => setHovered(slice.key)}
              onPointerLeave={() => setHovered(null)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: seriesColor(index) }} aria-hidden />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="text-xs text-ink-soft">{formatPercent(slice.value / total, 0)}</span>
                <span className="font-mono text-xs font-semibold tabular-nums">{formatNumber(slice.value)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ChartTable
        columns={[
          { key: "label", label: "Kaynak" },
          { key: "value", label: "Oturum", align: "right" },
          { key: "share", label: "Pay", align: "right" },
        ]}
        rows={slices.map((slice) => ({
          label: slice.label,
          value: formatNumber(slice.value),
          share: formatPercent(slice.value / total, 1),
        }))}
      />
    </div>
  );
}
