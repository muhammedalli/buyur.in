"use client";

import { useMemo, useState } from "react";
import { CHART_GRID, CHART_INK_SOFT, CHART_SURFACE, seriesColor } from "@/components/panel/charts/palette";
import {
  formatCompact,
  formatDayLong,
  formatDayShort,
  formatNumber,
  linePath,
  niceTicks,
  useChartWidth,
} from "@/components/panel/charts/chart-utils";
import { ChartEmpty, ChartTable, type LegendItem } from "@/components/panel/charts/frame";

// Zaman serisi çizgi grafiği. Tek eksen (asla çift y ekseni), 2px çizgi,
// yüzey renginde halkalı uç noktası, imleç X'i yakalayan crosshair ve tek
// tooltip'te bütün serilerin değeri.

export interface LineSeries {
  key: string;
  label: string;
  points: { date: string; value: number }[];
  /** Belirtilmezse palet sırasından atanır. */
  color?: string;
}

const PADDING = { top: 12, right: 16, bottom: 26, left: 44 };

export function LineChart({
  series,
  height = 240,
  emptyLabel = "Menünüz ziyaret edilmeye başlayınca bu grafik dolacak.",
  valueFormatter = formatNumber,
}: {
  series: LineSeries[];
  height?: number;
  emptyLabel?: string;
  valueFormatter?: (value: number) => string;
}) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const resolved = useMemo(
    () => series.map((item, index) => ({ ...item, color: item.color ?? seriesColor(index) })),
    [series]
  );

  const dates = resolved[0]?.points.map((point) => point.date) ?? [];
  const maxValue = Math.max(1, ...resolved.flatMap((item) => item.points.map((point) => point.value)));
  const ticks = niceTicks(maxValue);
  const scaleMax = ticks[ticks.length - 1] ?? 1;

  const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
  const plotHeight = Math.max(1, height - PADDING.top - PADDING.bottom);

  const xOf = (index: number) =>
    PADDING.left + (dates.length <= 1 ? plotWidth / 2 : (index / (dates.length - 1)) * plotWidth);
  const yOf = (value: number) => PADDING.top + plotHeight - (value / scaleMax) * plotHeight;

  const hasData = resolved.some((item) => item.points.some((point) => point.value > 0));
  if (dates.length === 0 || !hasData) {
    return (
      <div ref={ref}>
        <ChartEmpty height={height} label={emptyLabel} />
      </div>
    );
  }

  // Etiket sıklığı gün sayısına değil, gerçekte kalan piksele göre belirlenir:
  // dar ekranda "17 Tem21 Tem" gibi çakışan eksen çıkmasın.
  const maxLabels = Math.max(2, Math.floor(plotWidth / 62));
  const labelStep = Math.max(1, Math.ceil(dates.length / maxLabels));

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - PADDING.left;
    const ratio = dates.length <= 1 ? 0 : x / plotWidth;
    const index = Math.round(ratio * (dates.length - 1));
    setHoverIndex(Math.min(dates.length - 1, Math.max(0, index)));
  }

  const tooltipLeft = hoverIndex === null ? 0 : Math.min(Math.max(xOf(hoverIndex), 90), width - 90);

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Zaman serisi grafiği"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
        className="touch-pan-y"
      >
        {/* Izgara: ince, düz, geri planda */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke={CHART_GRID}
              strokeWidth={1}
            />
            <text x={PADDING.left - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={10} fill={CHART_INK_SOFT}>
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        {dates.map((date, index) =>
          index % labelStep === 0 ? (
            <text
              key={date}
              x={xOf(index)}
              y={height - 8}
              textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"}
              fontSize={10}
              fill={CHART_INK_SOFT}
            >
              {formatDayShort(date)}
            </text>
          ) : null
        )}

        {hoverIndex !== null && (
          <line
            x1={xOf(hoverIndex)}
            x2={xOf(hoverIndex)}
            y1={PADDING.top}
            y2={PADDING.top + plotHeight}
            stroke={CHART_INK_SOFT}
            strokeWidth={1}
            strokeOpacity={0.35}
          />
        )}

        {resolved.map((item) => {
          const points = item.points.map((point, index) => ({ x: xOf(index), y: yOf(point.value) }));
          const last = points[points.length - 1]!;
          return (
            <g key={item.key}>
              {resolved.length === 1 && (
                <path
                  d={`${linePath(points)} L${last.x},${PADDING.top + plotHeight} L${points[0]!.x},${PADDING.top + plotHeight} Z`}
                  fill={item.color}
                  fillOpacity={0.1}
                />
              )}
              <path
                d={linePath(points)}
                fill="none"
                stroke={item.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Uç nokta: yüzey renginde 2px halka ile çizgiden ayrışır */}
              <circle cx={last.x} cy={last.y} r={4} fill={item.color} stroke={CHART_SURFACE} strokeWidth={2} />
              {hoverIndex !== null && (
                <circle
                  cx={xOf(hoverIndex)}
                  cy={yOf(item.points[hoverIndex]?.value ?? 0)}
                  r={4}
                  fill={item.color}
                  stroke={CHART_SURFACE}
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
      </svg>

      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-line bg-paper px-3 py-2 shadow-[0_12px_30px_-16px_rgba(35,24,18,0.6)]"
          style={{ left: tooltipLeft }}
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {formatDayLong(dates[hoverIndex]!)}
          </p>
          <div className="mt-1 space-y-0.5">
            {resolved.map((item) => (
              <p key={item.key} className="flex items-center gap-2 text-sm">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden />
                <span className="font-semibold tabular-nums">{valueFormatter(item.points[hoverIndex]?.value ?? 0)}</span>
                <span className="text-xs text-ink-soft">{item.label}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      <ChartTable
        columns={[
          { key: "date", label: "Tarih" },
          ...resolved.map((item) => ({ key: item.key, label: item.label, align: "right" as const })),
        ]}
        rows={dates.map((date, index) => ({
          date: formatDayLong(date),
          ...Object.fromEntries(resolved.map((item) => [item.key, valueFormatter(item.points[index]?.value ?? 0)])),
        }))}
      />
    </div>
  );
}

export function lineLegend(series: LineSeries[]): LegendItem[] {
  return series.map((item, index) => ({
    label: item.label,
    color: item.color ?? seriesColor(index),
    shape: "line" as const,
  }));
}
