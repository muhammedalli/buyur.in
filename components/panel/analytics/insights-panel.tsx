"use client";

import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import { ChartFrame } from "@/components/panel/charts/frame";
import { STATUS } from "@/components/panel/charts/palette";
import { formatNumber } from "@/components/panel/charts/chart-utils";
import type { Insight, InsightKind } from "@/lib/analytics/insights";
import type { MenuScore } from "@/lib/analytics/score";
import { MIN_SESSIONS_FOR_SCORE } from "@/lib/analytics/score";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

// İçgörüler ve menü performans skoru. Skor kara kutu değil: bileşenleri,
// hedefleri ve ağırlıkları ekranda açık.

const KIND_STYLE: Record<InsightKind, { color: string; background: string; label: string }> = {
  positive: { color: STATUS.good, background: "rgba(47,125,79,0.10)", label: msg("İyi gidiyor") },
  opportunity: { color: STATUS.warning, background: "rgba(184,128,26,0.12)", label: msg("Fırsat") },
  warning: { color: STATUS.critical, background: "rgba(194,56,20,0.10)", label: msg("Dikkat") },
  recommendation: { color: STATUS.neutral, background: "rgba(92,74,61,0.08)", label: msg("Öneri") },
};

function scoreTone(score: number): string {
  if (score >= 70) return STATUS.good;
  if (score >= 45) return STATUS.warning;
  return STATUS.critical;
}

function ScoreCard({ score }: { score: MenuScore }) {
  const { t } = useUiLocale();
  if (!score.sufficient || score.score === null) {
    return (
      <ChartFrame title={t("Menü performans skoru")}>
        <div className="rounded-md border border-dashed border-line px-5 py-8 text-center">
          <p className="text-sm font-semibold">{t("Skor için henüz yeterli veri yok")}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {t("Skoru hesaplayabilmek için seçili dönemde en az {min} oturum gerekiyor — şu an {count} oturum var. Az veriden çıkan puan yanıltıcı olurdu.", {
              min: MIN_SESSIONS_FOR_SCORE,
              count: formatNumber(score.sampleSessions),
            })}
          </p>
        </div>
      </ChartFrame>
    );
  }

  const tone = scoreTone(score.score);

  return (
    <ChartFrame title={t("Menü performans skoru")} hint={t("Altı bileşenin ağırlıklı ortalaması")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0 text-center sm:w-40">
          <p className="font-display text-6xl font-extrabold leading-none" style={{ color: tone }}>
            {score.score}
          </p>
          <p className="mt-1 text-xs font-medium text-ink-soft">{t("100 üzerinden")}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {score.components.map((component) => (
            <div key={component.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate" title={t(component.hint)}>
                  {t(component.label)}
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
              <p className="mt-0.5 text-[11px] font-medium text-ink-soft/80">
                {t("Ağırlık %{percent}", { percent: Math.round(component.weight * 100) })} · {t(component.hint)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {(score.strengths.length > 0 || score.weaknesses.length > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {score.strengths.length > 0 && (
            <div className="rounded-md border border-line px-4 py-3">
              <p className="text-xs font-medium" style={{ color: STATUS.good }}>
                {t("Güçlü")}
              </p>
              <p className="mt-1 text-sm">{score.strengths.map((item) => t(item)).join(" · ")}</p>
            </div>
          )}
          {score.weaknesses.length > 0 && (
            <div className="rounded-md border border-line px-4 py-3">
              <p className="text-xs font-medium" style={{ color: STATUS.critical }}>
                {t("Geliştirilecek")}
              </p>
              <p className="mt-1 text-sm">{score.weaknesses.map((item) => t(item)).join(" · ")}</p>
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

export function InsightsPanel() {
  const { t } = useUiLocale();
  const { data, loading, error } = useAnalyticsQuery<{ insights: Insight[]; score: MenuScore }>("insights");

  if (error?.isPlanLocked) {
    return (
      <FeatureLocked
        feature="insights"
        subject={t("Otomatik içgörüler")}
        description={t("Menünüzdeki anlamlı değişimleri yakalayan içgörüler ve menü performans skoru.")}
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

      <ChartFrame title={t("İçgörüler")} hint={t("Yalnızca istatistiksel eşiği geçen değişimler listelenir")}>
        {data.insights.length === 0 ? (
          <div className="rounded-md border border-dashed border-line px-5 py-8 text-center">
            <p className="text-sm font-semibold">{t("Şimdilik öne çıkan bir değişim yok")}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {t("Anlamlı bir artış, düşüş ya da fırsat yakaladığımızda burada göreceksiniz. Küçük dalgalanmaları bilinçli olarak göstermiyoruz.")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {data.insights.map((insight) => {
              const style = KIND_STYLE[insight.kind];
              return (
                <li key={insight.id} className="rounded-md border border-line p-4" style={{ background: style.background }}>
                  <p className="text-xs font-medium" style={{ color: style.color }}>
                    {t(style.label)}
                  </p>
                  <p className="mt-1 font-display text-base font-bold">{insight.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{insight.detail}</p>
                  <p className="mt-1.5 text-xs font-medium text-ink-soft/80">
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
