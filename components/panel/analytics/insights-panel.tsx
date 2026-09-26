"use client";

import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import { ChartFrame } from "@/components/panel/charts/frame";
import { STATUS } from "@/components/panel/charts/palette";
import { formatNumber } from "@/components/panel/charts/chart-utils";
import type { Insight, InsightKind } from "@/lib/analytics/insights";
import type { MenuScore } from "@/lib/analytics/score";
import { MIN_SESSIONS_FOR_SCORE } from "@/lib/analytics/score";
import { FeatureLocked } from "@/components/panel/plan-gate";

// İçgörüler ve menü performans skoru. Skor kara kutu değil: bileşenleri,
// hedefleri ve ağırlıkları ekranda açık.

const KIND_STYLE: Record<InsightKind, { color: string; background: string; label: string }> = {
  positive: { color: STATUS.good, background: "rgba(47,125,79,0.10)", label: "İyi gidiyor" },
  opportunity: { color: STATUS.warning, background: "rgba(184,128,26,0.12)", label: "Fırsat" },
  warning: { color: STATUS.critical, background: "rgba(194,56,20,0.10)", label: "Dikkat" },
  recommendation: { color: STATUS.neutral, background: "rgba(92,74,61,0.08)", label: "Öneri" },
};

function scoreTone(score: number): string {
  if (score >= 70) return STATUS.good;
  if (score >= 45) return STATUS.warning;
  return STATUS.critical;
}

function ScoreCard({ score }: { score: MenuScore }) {
  if (!score.sufficient || score.score === null) {
    return (
      <ChartFrame title="Menü performans skoru">
        <div className="rounded-md border border-dashed border-line px-5 py-8 text-center">
          <p className="text-sm font-semibold">Skor için henüz yeterli veri yok</p>
          <p className="mt-1 text-xs text-ink-soft">
            Skoru hesaplayabilmek için seçili dönemde en az {MIN_SESSIONS_FOR_SCORE} oturum gerekiyor — şu an{" "}
            {formatNumber(score.sampleSessions)} oturum var. Az veriden çıkan puan yanıltıcı olurdu.
          </p>
        </div>
      </ChartFrame>
    );
  }

  const tone = scoreTone(score.score);

  return (
    <ChartFrame title="Menü performans skoru" hint="Altı bileşenin ağırlıklı ortalaması">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0 text-center sm:w-40">
          <p className="font-display text-6xl font-extrabold leading-none" style={{ color: tone }}>
            {score.score}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft">100 üzerinden</p>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {score.components.map((component) => (
            <div key={component.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate" title={component.hint}>
                  {component.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-xs text-ink-soft">{component.display}</span>
                  <span className="font-mono text-xs font-semibold tabular-nums">{Math.round(component.score)}</span>
                </span>
              </div>
              {/* Ölçer: dolu kısım durumu taşır, boş kısım aynı rampanın açık adımı */}
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-crema">
                <div
                  className="h-full rounded-r-[4px] transition-all duration-300"
                  style={{ width: `${Math.max(component.score, 2)}%`, background: scoreTone(component.score) }}
                />
              </div>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-soft/80">
                Ağırlık %{Math.round(component.weight * 100)} · {component.hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {(score.strengths.length > 0 || score.weaknesses.length > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {score.strengths.length > 0 && (
            <div className="rounded-md border border-line px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: STATUS.good }}>
                Güçlü
              </p>
              <p className="mt-1 text-sm">{score.strengths.join(" · ")}</p>
            </div>
          )}
          {score.weaknesses.length > 0 && (
            <div className="rounded-md border border-line px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: STATUS.critical }}>
                Geliştirilecek
              </p>
              <p className="mt-1 text-sm">{score.weaknesses.join(" · ")}</p>
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

export function InsightsPanel() {
  const { data, loading, error } = useAnalyticsQuery<{ insights: Insight[]; score: MenuScore }>("insights");

  if (error?.isPlanLocked) {
    return (
      <FeatureLocked
        feature="insights"
        subject="Otomatik içgörüler"
        description="Menünüzdeki anlamlı değişimleri yakalayan içgörüler ve menü performans skoru."
      />
    );
  }

  if (loading && !data) {
    return <div className="h-40 animate-pulse rounded-md bg-crema/70" />;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <ScoreCard score={data.score} />

      <ChartFrame title="İçgörüler" hint="Yalnızca istatistiksel eşiği geçen değişimler listelenir">
        {data.insights.length === 0 ? (
          <div className="rounded-md border border-dashed border-line px-5 py-8 text-center">
            <p className="text-sm font-semibold">Şimdilik öne çıkan bir değişim yok</p>
            <p className="mt-1 text-xs text-ink-soft">
              Anlamlı bir artış, düşüş ya da fırsat yakaladığımızda burada göreceksiniz. Küçük dalgalanmaları
              bilinçli olarak göstermiyoruz.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {data.insights.map((insight) => {
              const style = KIND_STYLE[insight.kind];
              return (
                <li key={insight.id} className="rounded-md border border-line p-4" style={{ background: style.background }}>
                  <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: style.color }}>
                    {style.label}
                  </p>
                  <p className="mt-1 font-display text-base font-bold">{insight.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{insight.detail}</p>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft/80">
                    {insight.evidence}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </ChartFrame>
    </div>
  );
}
