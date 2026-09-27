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
import { InsightsPanel } from "@/components/panel/analytics/insights-panel";
import { ChartFrame } from "@/components/panel/charts/frame";
import { LineChart, lineLegend, type LineSeries } from "@/components/panel/charts/line-chart";
import { BarList } from "@/components/panel/charts/bar-chart";
import { DonutChart } from "@/components/panel/charts/donut-chart";
import { FunnelChart, type FunnelStep } from "@/components/panel/charts/funnel-chart";
import { StatTile } from "@/components/panel/charts/stat-tile";
import { formatCompact, formatDateRange, formatDuration, formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import { CATEGORICAL } from "@/components/panel/charts/palette";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

interface SeriesPoint {
  date: string;
  value: number;
}

interface DimensionEntry {
  key: string;
  label: string;
  metrics: Record<string, number>;
}

interface OverviewTotals {
  sessions: number;
  visitors: number;
  page_views: number;
  qr_scans: number;
  category_views: number;
  product_views: number;
  product_detail_views: number;
  cart_adds: number;
  cart_views: number;
  searches: number;
  new_sessions: number;
  returning_sessions: number;
  bounced_sessions: number;
  avg_session_duration: number;
  pages_per_session: number;
  cart_conversion: number;
  bounce_rate: number;
  returning_rate: number;
}

interface OverviewData {
  totals: Partial<OverviewTotals>;
  previous?: OverviewTotals | null;
  changes?: Record<string, number | null>;
  series: Record<string, SeriesPoint[]>;
  funnel?: FunnelStep[];
  sources?: DimensionEntry[];
  devices?: DimensionEntry[];
  topProducts?: DimensionEntry[];
  topCategories?: DimensionEntry[];
  locked?: string[];
}

const DEVICE_LABELS: Record<string, string> = { mobile: msg("Mobil"), tablet: msg("Tablet"), desktop: msg("Masaüstü") };

const SOURCE_LABELS: Record<string, string> = {
  qr: msg("QR kod"),
  instagram: "Instagram",
  google: "Google",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  youtube: "YouTube",
  campaign: msg("Kampanya linki"),
  direct: msg("Doğrudan"),
  other: msg("Diğer"),
};

export default function AnalyticsOverviewPage() {
  const { t } = useUiLocale();
  const { data, meta, loading, refreshing, error, reload } = useAnalyticsQuery<OverviewData>("overview");

  const advanced = meta?.plan.advanced ?? false;
  const compareLabel = meta?.comparison
    ? meta.comparison.mode === "previous_year"
      ? t("geçen yılın aynı dönemine göre")
      : t("önceki döneme göre")
    : t("karşılaştırma kapalı");

  return (
    <div>
      <PageHeader
        title={t("Analiz")}
        description={
          meta
            ? `${formatDateRange(meta.range.from, meta.range.to)}${meta.approximate ? ` · ${t("tekil ziyaretçi yaklaşık")}` : ""}`
            : t("Menünüzün performansı")
        }
      />

      <AnalyticsFilterBar />

      {loading && !data && <AnalyticsSkeleton />}
      {error && !error.isPlanLocked && !data && <AnalyticsErrorState error={error} onRetry={reload} />}

      {data && (
        <Refreshable refreshing={refreshing}>
          {(data.totals.page_views ?? 0) === 0 && (data.totals.sessions ?? 0) === 0 ? (
            <NoDataYet description={t("Menünüz yayınlandıktan ve ilk QR taramaları geldikten sonra müşteri davranışları burada görünmeye başlayacak.")} />
          ) : (
            <div className="space-y-4">
              {/* Trend'li iki kart kendi ikili satırında — dar 4'lü sütunda sparkline
                  sıkışıyordu, burada her birine iki katı genişlik var. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <StatTile
                  label={t("Menü görüntülenme")}
                  value={formatCompact(data.totals.page_views ?? 0)}
                  change={advanced ? (data.changes?.page_views ?? null) : undefined}
                  comparisonLabel={compareLabel}
                  hint={t("Menünün açıldığı toplam sayfa sayısı — aynı ziyaretçi birden çok sayfa açtıysa her biri sayılır.")}
                  trend={data.series.page_views?.slice(-12).map((point) => point.value)}
                />
                <StatTile
                  label={t("Sepete ekleme")}
                  value={formatCompact(data.totals.cart_adds ?? 0)}
                  change={advanced ? (data.changes?.cart_adds ?? null) : undefined}
                  comparisonLabel={compareLabel}
                  hint={t("Müşterilerin menüden sepete eklediği ürün sayısı — ilgi düzeyinin en güçlü sinyali.")}
                  trend={data.series.cart_adds?.slice(-12).map((point) => point.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <StatTile
                  label={t("Tekil ziyaretçi")}
                  value={formatCompact(data.totals.visitors ?? 0)}
                  change={advanced ? (data.changes?.visitors ?? null) : undefined}
                  comparisonLabel={compareLabel}
                  hint={t("Dönem boyunca menüyü açan farklı cihaz sayısı. Aynı kişi birden çok kez geldiyse bir kez sayılır.")}
                />
                <StatTile
                  label={t("QR tarama")}
                  value={formatCompact(data.totals.qr_scans ?? 0)}
                  change={advanced ? (data.changes?.qr_scans ?? null) : undefined}
                  comparisonLabel={compareLabel}
                  hint={t("Menüye QR kod üzerinden başlayan ziyaretler. Linke tıklayarak gelenler bu sayıya girmez.")}
                />
              </div>

              {advanced && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label={t("Oturum")}
                    value={formatCompact(data.totals.sessions ?? 0)}
                    change={data.changes?.sessions ?? null}
                    comparisonLabel={compareLabel}
                    hint={t("Bir ziyaretçinin menüde geçirdiği kesintisiz zaman dilimi. 30 dakika hareketsizlikten sonra yeni oturum başlar.")}
                  />
                  <StatTile
                    label={t("Ortalama süre")}
                    value={formatDuration(data.totals.avg_session_duration ?? 0)}
                    change={data.changes?.avg_session_duration ?? null}
                    comparisonLabel={compareLabel}
                    hint={t("Ziyaretçilerin menüde kaldığı ortalama süre.")}
                  />
                  <StatTile
                    label={t("Sepet dönüşümü")}
                    value={formatPercent(data.totals.cart_conversion ?? 0)}
                    change={data.changes?.cart_conversion ?? null}
                    comparisonLabel={compareLabel}
                    hint={t("Sepete ekleme yapan oturumların oranı: sepete ekleme / oturum.")}
                  />
                  <StatTile
                    label={t("Dönen ziyaretçi")}
                    value={formatPercent(data.totals.returning_rate ?? 0)}
                    change={data.changes?.returning_rate ?? null}
                    comparisonLabel={compareLabel}
                    hint={t("Daha önce menünüzü açmış ziyaretçilerin oturumlardaki payı.")}
                  />
                </div>
              )}

              <ChartFrame
                title={t("Zaman içinde menü performansı")}
                hint={meta ? formatDateRange(meta.range.from, meta.range.to) : undefined}
                legend={
                  advanced
                    ? lineLegend([
                        { key: "page_views", label: t("Menü görüntülenme"), points: [] },
                        { key: "sessions", label: t("Oturum"), points: [] },
                        { key: "cart_adds", label: t("Sepete ekleme"), points: [] },
                      ] as LineSeries[])
                    : undefined
                }
              >
                <LineChart
                  series={
                    advanced
                      ? [
                          { key: "page_views", label: t("Menü görüntülenme"), points: data.series.page_views ?? [] },
                          { key: "sessions", label: t("Oturum"), points: data.series.sessions ?? [] },
                          { key: "cart_adds", label: t("Sepete ekleme"), points: data.series.cart_adds ?? [] },
                        ]
                      : [{ key: "page_views", label: t("Menü görüntülenme"), points: data.series.page_views ?? [] }]
                  }
                />
              </ChartFrame>

              {advanced ? (
                <>
                  {meta?.plan.insights && <InsightsPanel />}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ChartFrame
                      title={t("Müşteri yolculuğu")}
                      hint={t("Her adıma ulaşan oturum sayısı ve bir önceki adımdan geçiş oranı")}
                    >
                      <FunnelChart steps={data.funnel ?? []} />
                    </ChartFrame>

                    <ChartFrame title={t("Trafik kaynağı")} hint={t("Ziyaretçiler menüye nereden geldi")}>
                      <DonutChart
                        centerLabel={t("oturum")}
                        items={(data.sources ?? []).map((entry) => ({
                          key: entry.key,
                          label: t(SOURCE_LABELS[entry.key] ?? entry.label),
                          value: entry.metrics.sessions ?? 0,
                        }))}
                      />
                    </ChartFrame>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ChartFrame title={t("En çok görüntülenen ürünler")} hint={t("Listede görülme sayısı ve sepete dönüşüm")}>
                      <BarList
                        items={(data.topProducts ?? []).map((entry) => ({
                          key: entry.key,
                          label: entry.label,
                          value: entry.metrics.views ?? 0,
                          note:
                            (entry.metrics.views ?? 0) > 0
                              ? t("{percent} sepet", { percent: formatPercent((entry.metrics.cart_adds ?? 0) / (entry.metrics.views ?? 1), 0) })
                              : undefined,
                        }))}
                        emptyLabel={t("Ürünleriniz görüntülenmeye başlayınca burada sıralanacak.")}
                      />
                    </ChartFrame>

                    <ChartFrame title={t("En çok görüntülenen kategoriler")}>
                      <BarList
                        color={CATEGORICAL[1]}
                        items={(data.topCategories ?? []).map((entry) => ({
                          key: entry.key,
                          label: entry.label,
                          value: entry.metrics.views ?? 0,
                        }))}
                        emptyLabel={t("Kategori görüntülenmeleri burada listelenecek.")}
                      />
                    </ChartFrame>
                  </div>

                  <ChartFrame title={t("Cihaz dağılımı")} hint={t("Menü hangi cihazlardan açılıyor")}>
                    <BarList
                      color={CATEGORICAL[3]}
                      valueFormatter={formatNumber}
                      items={(data.devices ?? []).map((entry) => ({
                        key: entry.key,
                        label: t(DEVICE_LABELS[entry.key] ?? entry.label),
                        value: entry.metrics.sessions ?? 0,
                      }))}
                      emptyLabel={t("Cihaz kırılımı için henüz ziyaret yok.")}
                    />
                  </ChartFrame>
                </>
              ) : (
                <FeatureLocked
                  feature="advanced_analytics"
                  subject={t("Gelişmiş analizler")}
                  description={t("Dönem karşılaştırması, müşteri yolculuğu hunisi, trafik kaynakları, ürün ve kategori performansı, saat/gün analizi ve drill-down.")}
                />
              )}
            </div>
          )}
        </Refreshable>
      )}
    </div>
  );
}
