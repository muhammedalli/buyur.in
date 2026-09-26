"use client";

import { useState } from "react";
import { HEAT_SCALE, heatColor } from "@/components/panel/charts/palette";
import { WEEKDAY_LABELS, formatNumber } from "@/components/panel/charts/chart-utils";
import { ChartEmpty, ChartTable } from "@/components/panel/charts/frame";

// Gün × saat ısı haritası: menünün ne zaman canlandığını tek bakışta gösterir.
// Renk tek hue'lu sıralı rampa (magnitude işi); boş hücre yüzey tonunda kalır.

export function Heatmap({
  matrix,
  emptyLabel = "Saat kırılımı için henüz yeterli ziyaret yok.",
}: {
  matrix: number[][];
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);

  const max = Math.max(0, ...matrix.flat());
  if (max <= 0) return <ChartEmpty height={200} label={emptyLabel} />;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="flex">
            <div className="w-9 shrink-0" />
            <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} className="text-center font-mono text-[9px] text-ink-soft">
                  {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
                </span>
              ))}
            </div>
          </div>

          {matrix.map((hours, day) => (
            <div key={day} className="mt-[2px] flex items-center">
              <span className="w-9 shrink-0 font-mono text-[10px] uppercase text-ink-soft">{WEEKDAY_LABELS[day]}</span>
              <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
                {hours.map((value, hour) => (
                  <button
                    key={hour}
                    type="button"
                    className="relative h-6 rounded-[3px] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-paprika"
                    style={{
                      background: heatColor(value / max),
                      transform: hovered?.day === day && hovered?.hour === hour ? "scale(1.12)" : undefined,
                    }}
                    onPointerEnter={() => setHovered({ day, hour })}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered({ day, hour })}
                    onBlur={() => setHovered(null)}
                    aria-label={`${WEEKDAY_LABELS[day]} ${String(hour).padStart(2, "0")}:00 — ${formatNumber(value)} görüntülenme`}
                  >
                    {hovered?.day === day && hovered?.hour === hour && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-paper px-2 py-1 text-xs shadow-[0_10px_24px_-14px_rgba(35,24,18,0.6)]">
                        <span className="font-semibold tabular-nums">{formatNumber(value)}</span>{" "}
                        <span className="text-ink-soft">
                          {WEEKDAY_LABELS[day]} {String(hour).padStart(2, "0")}:00
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">Az</span>
        <div className="flex gap-[2px]">
          {HEAT_SCALE.map((color) => (
            <span key={color} className="h-2.5 w-6 rounded-[2px]" style={{ background: color }} aria-hidden />
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">Çok ({formatNumber(max)})</span>
      </div>

      <ChartTable
        columns={[
          { key: "day", label: "Gün" },
          { key: "peak", label: "En yoğun saat", align: "right" },
          { key: "total", label: "Toplam", align: "right" },
        ]}
        rows={matrix.map((hours, day) => {
          const peakHour = hours.reduce((best, value, hour) => (value > hours[best]! ? hour : best), 0);
          return {
            day: WEEKDAY_LABELS[day] ?? String(day),
            peak: `${String(peakHour).padStart(2, "0")}:00 (${formatNumber(hours[peakHour] ?? 0)})`,
            total: formatNumber(hours.reduce((sum, value) => sum + value, 0)),
          };
        })}
      />
    </div>
  );
}
