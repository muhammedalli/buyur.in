"use client";

import { useState, type ReactNode } from "react";
import { CATEGORICAL, CHART_SURFACE, STATUS } from "@/components/panel/charts/palette";
import { formatChange, formatCompact, linePath, useChartWidth } from "@/components/panel/charts/chart-utils";

// Özet metrik kartı: etiket · değer · (opsiyonel) önceki döneme göre değişim ·
// (opsiyonel) 12 noktalık trend. Büyük değer orantılı rakamlarla yazılır;
// tabular-nums yalnızca hizalanması gereken tablo sütunlarında kullanılır.

export function Sparkline({
  points,
  color = CATEGORICAL[0],
  height = 34,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  const { ref, width } = useChartWidth<HTMLDivElement>(120);
  if (points.length < 2) return <div ref={ref} style={{ height }} />;

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(1, max - min);
  const coords = points.map((value, index) => ({
    x: (index / (points.length - 1)) * (width - 6) + 3,
    y: height - 3 - ((value - min) / span) * (height - 6),
  }));
  const last = coords[coords.length - 1]!;

  return (
    <div ref={ref} style={{ height }}>
      <svg width={width} height={height} aria-hidden>
        <path
          d={`${linePath(coords)} L${last.x},${height} L${coords[0]!.x},${height} Z`}
          fill={color}
          fillOpacity={0.1}
        />
        <path d={linePath(coords)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r={3} fill={color} stroke={CHART_SURFACE} strokeWidth={2} />
      </svg>
    </div>
  );
}

export interface StatTileProps {
  label: string;
  value: string;
  /** Önceki döneme göre değişim oranı (0.184 = %18,4 artış). */
  change?: number | null;
  /** Artışın iyi mi kötü mü olduğu — renk yönü buna göre belirlenir. */
  upIsGood?: boolean;
  /** Metriğin ne anlama geldiğini açıklayan kısa metin (ipucu). */
  hint?: string;
  comparisonLabel?: string;
  trend?: number[];
  trendColor?: string;
  action?: ReactNode;
}

export function StatTile({
  label,
  value,
  change,
  upIsGood = true,
  hint,
  comparisonLabel = "önceki döneme göre",
  trend,
  trendColor,
  action,
}: StatTileProps) {
  const [showHint, setShowHint] = useState(false);

  const direction = change === null || change === undefined || !Number.isFinite(change) ? 0 : Math.sign(change);
  const positive = direction === 0 ? null : (direction > 0) === upIsGood;
  const changeColor = positive === null ? STATUS.neutral : positive ? STATUS.good : STATUS.critical;

  return (
    <div className="relative rounded-md border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</p>
        {hint && (
          <button
            type="button"
            onPointerEnter={() => setShowHint(true)}
            onPointerLeave={() => setShowHint(false)}
            onFocus={() => setShowHint(true)}
            onBlur={() => setShowHint(false)}
            onClick={() => setShowHint((open) => !open)}
            aria-label={`${label} nedir?`}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[9px] text-ink-soft transition-colors hover:border-paprika hover:text-paprika"
          >
            ?
          </button>
        )}
        {action}
      </div>

      {showHint && hint && (
        <p className="absolute right-3 top-10 z-20 w-52 rounded-md border border-line bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft shadow-[0_12px_30px_-16px_rgba(35,24,18,0.6)]">
          {hint}
        </p>
      )}

      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>

      {change !== undefined && (
        <p className="mt-1 text-xs" style={{ color: changeColor }}>
          {formatChange(change)}{" "}
          <span className="text-ink-soft">{change === null ? "karşılaştırma yok" : comparisonLabel}</span>
        </p>
      )}

      {trend && trend.length > 1 && (
        <div className="mt-3">
          <Sparkline points={trend} color={trendColor} />
        </div>
      )}
    </div>
  );
}

export { formatCompact };
