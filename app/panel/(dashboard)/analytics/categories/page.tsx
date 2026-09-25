"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/panel/ui";
import { AnalyticsFilterBar, useAnalyticsFilters } from "@/components/panel/analytics/filters";
import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import {
  AnalyticsErrorState,
  AnalyticsSkeleton,
  NoDataYet,
  Refreshable,
} from "@/components/panel/analytics/states";
import { ChartFrame } from "@/components/panel/charts/frame";
import { BarList } from "@/components/panel/charts/bar-chart";
import { formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import { CATEGORICAL } from "@/components/panel/charts/palette";
import { FeatureLocked } from "@/components/panel/plan-gate";

interface CategoryRow {
  key: string;
  label: string;
  views: number;
  product_views: number;
  cart_adds: number;
  sessions: number;
  conversion: number;
}

export default function CategoryAnalyticsPage() {
  const router = useRouter();
  const { setFilters } = useAnalyticsFilters();
  const { data, loading, refreshing, error, reload } = useAnalyticsQuery<{ items: CategoryRow[] }>("categories");

  const items = data?.items ?? [];

  /** Kategoriye tıklayınca filtre kalıcı olarak seçilir ve ürün listesine iniyoruz. */
  function drillDown(categoryId: string) {
    setFilters({ category: categoryId });
    router.push("/panel/analytics/products");
  }

  return (
    <div>
      <PageHeader title="Kategori analitiği" description="Hangi kategori ilgi çekiyor, hangisi sepete dönüyor" />

      <AnalyticsFilterBar />

      {loading && !data && <AnalyticsSkeleton />}
      {error?.isPlanLocked && (
        <FeatureLocked
          feature="advanced_analytics"
          subject="Kategori analitiği"
          description="Kategori bazında görüntülenme, dönüşüm ve karşılaştırma."
        />
      )}
      {error && !error.isPlanLocked && !data && <AnalyticsErrorState error={error} onRetry={reload} />}

      {data && (
        <Refreshable refreshing={refreshing}>
          {items.length === 0 ? (
            <NoDataYet description="Bu dönemde kategori görüntülenmesi kaydedilmemiş." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFrame title="Kategori görüntülenmeleri" hint="Kategoriye tıklayarak ürünlerine inebilirsiniz">
                  <BarList
                    items={items.map((item) => ({ key: item.key, label: item.label, value: item.views }))}
                    onSelect={(item) => drillDown(item.key)}
                  />
                </ChartFrame>

                <ChartFrame title="Sepete dönüşüm" hint="Sepete ekleme / ürün görüntülenme">
                  <BarList
                    color={CATEGORICAL[3]}
                    valueFormatter={(value) => formatPercent(value / 100, 1)}
                    items={items
                      .slice()
                      .sort((a, b) => b.conversion - a.conversion)
                      .map((item) => ({
                        key: item.key,
                        label: item.label,
                        value: Math.round(item.conversion * 1000) / 10,
                        note: `${formatNumber(item.cart_adds)} sepet`,
                      }))}
                  />
                </ChartFrame>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-crema/50 text-left font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3 text-right">Görüntülenme</th>
                      <th className="px-4 py-3 text-right">Ürün görüntülenme</th>
                      <th className="px-4 py-3 text-right">Sepete ekleme</th>
                      <th className="px-4 py-3 text-right">Dönüşüm</th>
                      <th className="px-4 py-3 text-right">Oturum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.key}
                        onClick={() => drillDown(item.key)}
                        className="cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-crema/40"
                      >
                        <td className="px-4 py-3 font-medium">{item.label}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.views)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.product_views)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.cart_adds)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatPercent(item.conversion, 1)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.sessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Refreshable>
      )}
    </div>
  );
}
