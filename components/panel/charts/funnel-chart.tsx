"use client";

import { ORDINAL } from "@/components/panel/charts/palette";
import { formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import { ChartEmpty, ChartTable } from "@/components/panel/charts/frame";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

// Müşteri yolculuğu hunisi. Adımlar sıralı (ordinal) olduğu için tek renkli,
// koyulaşan rampa kullanılıyor: renk sıranın kendisini anlatıyor.

export interface FunnelStep {
  key: string;
  label: string;
  sessions: number;
  /** Bir önceki adıma göre geçiş oranı; ilk adımda null. */
  conversion: number | null;
  dropoff: number | null;
}

export function FunnelChart({
  steps,
  emptyLabel = msg("Huniyi çizmek için önce menünüzün ziyaret edilmesi gerekiyor."),
}: {
  steps: FunnelStep[];
  emptyLabel?: string;
}) {
  const { t } = useUiLocale();
  const first = steps[0]?.sessions ?? 0;
  if (first <= 0) return <ChartEmpty height={220} label={emptyLabel} />;

  return (
    <div>
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const ratio = first > 0 ? step.sessions / first : 0;
          const color = ORDINAL[Math.min(index, ORDINAL.length - 1)]!;
          return (
            <li key={step.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{t(step.label)}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {step.conversion !== null && (
                    <span className="text-xs text-ink-soft">{t("{percent} geçiş", { percent: formatPercent(step.conversion, 0) })}</span>
                  )}
                  <span className="font-mono text-xs font-semibold tabular-nums">{formatNumber(step.sessions)}</span>
                </span>
              </div>
              <div className="mt-1 h-7 overflow-hidden rounded-md bg-crema">
                <div
                  className="flex h-full items-center rounded-r-[4px] px-2 transition-all duration-300"
                  style={{ width: `${Math.max(ratio * 100, step.sessions > 0 ? 3 : 0)}%`, background: color }}
                >
                  {/* Etiket yalnızca sığdığında içeride; sığmıyorsa değer üstteki satırda zaten var */}
                  {ratio > 0.28 && (
                    <span className="truncate text-xs font-semibold text-paper">{formatPercent(ratio, 0)}</span>
                  )}
                </div>
              </div>
              {step.dropoff !== null && step.dropoff > 0 && (
                <p className="mt-1 text-xs font-medium text-ink-soft">
                  {t("Bu adımda kayıp: {percent}", { percent: formatPercent(step.dropoff, 0) })}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <ChartTable
        columns={[
          { key: "label", label: msg("Adım") },
          { key: "sessions", label: msg("Oturum"), align: "right" },
          { key: "conversion", label: msg("Geçiş"), align: "right" },
        ]}
        rows={steps.map((step) => ({
          label: t(step.label),
          sessions: formatNumber(step.sessions),
          conversion: step.conversion === null ? "—" : formatPercent(step.conversion, 1),
        }))}
      />
    </div>
  );
}
