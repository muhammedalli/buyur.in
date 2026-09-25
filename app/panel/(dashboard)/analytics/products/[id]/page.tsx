"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
import { LineChart, lineLegend } from "@/components/panel/charts/line-chart";
import { StatTile } from "@/components/panel/charts/stat-tile";
import { BarList } from "@/components/panel/charts/bar-chart";
import { formatCompact, formatDateRange, formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import { ArrowLeftIcon } from "@/components/icons";
import { CATEGORICAL } from "@/components/panel/charts/palette";
import { FeatureLocked } from "@/components/panel/plan-gate";

interface SeriesPoint {
  date: string;
  value: number;
}

interface ProductDetailData {
  product: { id: string; name: string; category: string };
  totals: {
    views: number;
    detail_views: number;
    cart_adds: number;
    cart_removes: number;
    sessions: number;
    detail_rate: number;
    conversion: number;
  };
  previous: { views: number; cart_adds: number; conversion: number } | null;
  changes: { views: number | null; cart_adds: number | null; conversion: number | null } | null;
  series: Record<string, SeriesPoint[]>;
  benchmarks: {
    category_avg_views: number;
    business_avg_views: number;
    vs_category: number | null;
    vs_business: number | null;
    category_products: number;
  };
}

export default function ProductPerformancePage() {
  const { id } = useParams<{ id: string }>();
  const { data, meta, loading, refreshing, error, reload } = useAnalyticsQuery<ProductDetailData>(`products/${id}`);

  return (
    <div>
      <Link
        href="/panel/analytics/products"
        className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
      >
        <ArrowLeftIcon size={14} /> Ürün analitiği
      </Link>

      <PageHeader
        title={data?.product.name ?? "Ürün performansı"}
        description={meta ? formatDateRange(meta.range.from, meta.range.to) : undefined}
      />

      <AnalyticsFilterBar />

      {loading && !data && <AnalyticsSkeleton />}
      {error?.isPlanLocked && (
        <FeatureLocked
          feature="advanced_analytics"
          subject="Ürün performansı"
          description="Tek ürün bazında zaman serisi, dönüşüm ve kategori kıyası."
        />
      )}
      {error && !error.isPlanLocked && !data && <AnalyticsErrorState error={error} onRetry={reload} />}

      {data && (
        <Refreshable refreshing={refreshing}>
          {data.totals.views === 0 && data.totals.detail_views === 0 ? (
            <NoDataYet description="Bu ürün seçilen dönemde hiç görüntülenmemiş. Menüdeki konumunu ve görselini gözden geçirmek isteyebilirsiniz." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Görüntülenme"
                  value={formatCompact(data.totals.views)}
                  change={data.changes?.views ?? undefined}
                  hint="Ürünün menü listesinde görüldüğü oturum sayısı (oturum başına bir kez sayılır)."
                  trend={data.series.views?.slice(-12).map((point) => point.value)}
                />
                <StatTile
                  label="Detay açılışı"
                  value={formatCompact(data.totals.detail_views)}
                  hint="Ürün detay sayfasının açılma sayısı — listedeki ilgiden bir adım öteye geçenler."
                />
                <StatTile
                  label="Sepete ekleme"
                  value={formatCompact(data.totals.cart_adds)}
                  change={data.changes?.cart_adds ?? undefined}
                  trend={data.series.cart_adds?.slice(-12).map((point) => point.value)}
                />
                <StatTile
                  label="Dönüşüm"
                  value={formatPercent(data.totals.conversion)}
                  change={data.changes?.conversion ?? undefined}
                  hint="Sepete ekleme / görüntülenme. Ürünün ilgiyi satışa çevirme gücü."
                />
              </div>

              <ChartFrame
                title="Zaman içinde ürün performansı"
                legend={lineLegend([
                  { key: "views", label: "Görüntülenme", points: [] },
                  { key: "detail_views", label: "Detay açılışı", points: [] },
                  { key: "cart_adds", label: "Sepete ekleme", points: [] },
                ])}
              >
                <LineChart
                  series={[
                    { key: "views", label: "Görüntülenme", points: data.series.views ?? [] },
                    { key: "detail_views", label: "Detay açılışı", points: data.series.detail_views ?? [] },
                    { key: "cart_adds", label: "Sepete ekleme", points: data.series.cart_adds ?? [] },
                  ]}
                />
              </ChartFrame>

              <ChartFrame
                title="Kıyaslama"
                hint={`Kategorisindeki ${formatNumber(data.benchmarks.category_products)} ürün ve menü ortalamasıyla`}
              >
                <BarList
                  color={CATEGORICAL[1]}
                  items={[
                    { key: "product", label: data.product.name, value: data.totals.views },
                    {
                      key: "category",
                      label: "Kategori ortalaması",
                      value: Math.round(data.benchmarks.category_avg_views),
                    },
                    {
                      key: "business",
                      label: "Menü ortalaması",
                      value: Math.round(data.benchmarks.business_avg_views),
                    },
                  ]}
                />
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {data.benchmarks.vs_category !== null && (
                    <p>
                      Kategori ortalamasına göre{" "}
                      <span className="font-semibold">{formatPercent(data.benchmarks.vs_category, 1)}</span>
                    </p>
                  )}
                  {data.benchmarks.vs_business !== null && (
                    <p className="text-ink-soft">
                      Menü ortalamasına göre{" "}
                      <span className="font-semibold text-ink">{formatPercent(data.benchmarks.vs_business, 1)}</span>
                    </p>
                  )}
                </div>
              </ChartFrame>
            </div>
          )}
        </Refreshable>
      )}
    </div>
  );
}
