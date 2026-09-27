"use client";

import { PageHeader } from "@/components/panel/ui";
import { AnalyticsFilterBar } from "@/components/panel/analytics/filters";
import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import {
  AnalyticsErrorState,
  AnalyticsSkeleton,
  NoDataYet,
  Refreshable,
} from "@/components/panel/analytics/states";
import { ChartFrame } from "@/components/panel/charts/frame";
import { ColumnChart } from "@/components/panel/charts/bar-chart";
import { Heatmap } from "@/components/panel/charts/heatmap";
import { StatTile } from "@/components/panel/charts/stat-tile";
import { CATEGORICAL } from "@/components/panel/charts/palette";
import { formatNumber, formatPercent, weekdayLabels } from "@/components/panel/charts/chart-utils";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

interface ActivityData {
  hourly: number[];
  matrix: number[][];
  weekdayTotals: number[];
  peak: { hour: number; weekday: number };
  series: { date: string; value: number }[];
}

interface SearchData {
  totals: { searches: number; terms: number; no_results: number };
  items: { key: string; label: string; searches: number; no_results: number; avg_results: number }[];
}

const FULL_WEEKDAYS = [msg("Pazartesi"), msg("Salı"), msg("Çarşamba"), msg("Perşembe"), msg("Cuma"), msg("Cumartesi"), msg("Pazar")];

export default function ActivityPage() {
  const { t } = useUiLocale();
  const activity = useAnalyticsQuery<ActivityData>("activity");
  const search = useAnalyticsQuery<SearchData>("search");

  const data = activity.data;
  const planLocked = activity.error?.isPlanLocked;
  const totalViews = data?.hourly.reduce((sum, value) => sum + value, 0) ?? 0;

  return (
    <div>
      <PageHeader title={t("Müşteri aktivitesi")} description={t("Menü hangi gün ve saatlerde canlanıyor")} />
      <AnalyticsFilterBar />

      {activity.loading && !data && <AnalyticsSkeleton />}
      {planLocked && (
        <FeatureLocked
          feature="advanced_analytics"
          subject={t("Aktivite analizi")}
          description={t("Gün ve saat kırılımı, yoğunluk haritası ve arama analizi.")}
        />
      )}
      {activity.error && !planLocked && !data && (
        <AnalyticsErrorState error={activity.error} onRetry={activity.reload} />
      )}

      {data && (
        <Refreshable refreshing={activity.refreshing}>
          {totalViews === 0 ? (
            <NoDataYet description={t("Saat ve gün kırılımı için önce menünüzün ziyaret edilmesi gerekiyor.")} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label={t("En yoğun saat")}
                  value={`${String(data.peak.hour).padStart(2, "0")}:00`}
                  hint={t("Menünün en çok açıldığı saat dilimi (işletmenizin saat dilimine göre).")}
                />
                <StatTile label={t("En yoğun gün")} value={t(FULL_WEEKDAYS[data.peak.weekday] ?? "—")} />
                <StatTile
                  label={t("En sakin saat")}
                  value={`${String(data.hourly.indexOf(Math.min(...data.hourly.filter((value) => value >= 0)))).padStart(2, "0")}:00`}
                  hint={t("Kampanya ve duyuru için en uygun boşluk burası olabilir.")}
                />
                <StatTile label={t("Toplam görüntülenme")} value={formatNumber(totalViews)} />
              </div>

              <ChartFrame title={t("Gün ve saat yoğunluğu")} hint={t("Koyu hücre = daha çok menü açılışı")}>
                <Heatmap matrix={data.matrix} />
              </ChartFrame>

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFrame title={t("Saatlik dağılım")}>
                  <ColumnChart
                    values={data.hourly}
                    labels={Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))}
                  />
                </ChartFrame>

                <ChartFrame title={t("Gün dağılımı")}>
                  <ColumnChart color={CATEGORICAL[1]} values={data.weekdayTotals} labels={weekdayLabels()} />
                </ChartFrame>
              </div>

              {search.data && search.data.totals.searches > 0 && (
                <ChartFrame
                  title={t("Menü içi arama")}
                  hint={t("Sonuçsuz aramalar eksik ürün talebini gösterir")}
                  actions={
                    <span className="text-xs font-medium text-ink-soft">
                      {t("{count} arama · {percent} sonuçsuz", {
                        count: formatNumber(search.data.totals.searches),
                        percent: formatPercent(search.data.totals.no_results / Math.max(1, search.data.totals.searches), 0),
                      })}
                    </span>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                          <th className="py-2">{t("Aranan")}</th>
                          <th className="py-2 text-right">{t("Arama")}</th>
                          <th className="py-2 text-right">{t("Ort. sonuç")}</th>
                          <th className="py-2 text-right">{t("Sonuçsuz")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {search.data.items.slice(0, 15).map((item) => (
                          <tr key={item.key} className="border-b border-line/50 last:border-0">
                            <td className="py-2">{item.label}</td>
                            <td className="py-2 text-right tabular-nums">{formatNumber(item.searches)}</td>
                            <td className="py-2 text-right tabular-nums">{item.avg_results.toFixed(1)}</td>
                            <td className="py-2 text-right tabular-nums">
                              {item.no_results > 0 ? formatNumber(item.no_results) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartFrame>
              )}
            </div>
          )}
        </Refreshable>
      )}
    </div>
  );
}
