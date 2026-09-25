"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { PageHeader } from "@/components/panel/ui";
import { AnalyticsFilterBar, useAnalyticsFilters } from "@/components/panel/analytics/filters";
import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import {
  AnalyticsErrorState,
  AnalyticsSkeleton,
  NoDataYet,
  Refreshable,
} from "@/components/panel/analytics/states";
import { OpportunityBadge } from "@/components/panel/analytics/opportunity-badge";
import { formatChange, formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import type { Opportunity } from "@/lib/analytics/opportunities";
import type { Category } from "@/lib/types";
import { FeatureLocked } from "@/components/panel/plan-gate";

interface ProductRow {
  key: string;
  label: string;
  category: string;
  views: number;
  detail_views: number;
  cart_adds: number;
  sessions: number;
  detail_rate: number;
  conversion: number;
  change: number | null;
  opportunity: Opportunity;
}

interface ProductsData {
  items: ProductRow[];
  total: number;
  trackedProducts: number;
}

const SORTS: { value: string; label: string; compare: (a: ProductRow, b: ProductRow) => number }[] = [
  { value: "views_desc", label: "En çok görüntülenen", compare: (a, b) => b.views - a.views },
  { value: "views_asc", label: "En az görüntülenen", compare: (a, b) => a.views - b.views },
  { value: "cart_desc", label: "En çok sepete eklenen", compare: (a, b) => b.cart_adds - a.cart_adds },
  { value: "conversion_desc", label: "En yüksek dönüşüm", compare: (a, b) => b.conversion - a.conversion },
  { value: "conversion_asc", label: "En düşük dönüşüm", compare: (a, b) => a.conversion - b.conversion },
  {
    value: "growth_desc",
    label: "En hızlı yükselen",
    compare: (a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity),
  },
  {
    value: "growth_asc",
    label: "Düşüşte olan",
    compare: (a, b) => (a.change ?? Infinity) - (b.change ?? Infinity),
  },
  { value: "engagement_desc", label: "En yüksek detay oranı", compare: (a, b) => b.detail_rate - a.detail_rate },
];

export default function ProductAnalyticsPage() {
  const { business } = useBusiness();
  const { filters, setFilters } = useAnalyticsFilters();
  const { data, meta, loading, refreshing, error, reload } = useAnalyticsQuery<ProductsData>("products");
  const [sort, setSort] = useState("views_desc");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!business) return;
    pb.collection("buyur_categories")
      .getFullList<Category>({
        filter: pb.filter("business = {:id}", { id: business.id }),
        sort: "order,created",
        requestKey: null,
      })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [business]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const comparator = SORTS.find((option) => option.value === sort)?.compare;
    return comparator ? items.slice().sort(comparator) : items;
  }, [data, sort]);

  return (
    <div>
      <PageHeader
        title="Ürün analitiği"
        description="Hangi ürün ilgi görüyor, hangisi sepete girmiyor — ve ne yapmalı"
      />

      <AnalyticsFilterBar>
        <select
          value={filters.category ?? ""}
          onChange={(event) => setFilters({ category: event.target.value || undefined })}
          aria-label="Kategori filtresi"
          className="rounded-full border border-line bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-wider text-ink outline-none transition-colors hover:border-paprika"
        >
          <option value="">Tüm kategoriler</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label="Sıralama"
          className="rounded-full border border-line bg-paper px-4 py-2 font-mono text-[12px] uppercase tracking-wider text-ink outline-none transition-colors hover:border-paprika"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </AnalyticsFilterBar>

      {loading && !data && <AnalyticsSkeleton />}
      {error?.isPlanLocked && (
        <FeatureLocked
          feature="advanced_analytics"
          subject="Ürün analitiği"
          description="Ürün bazında görüntülenme, sepete ekleme, dönüşüm ve fırsat analizi."
        />
      )}
      {error && !error.isPlanLocked && !data && <AnalyticsErrorState error={error} onRetry={reload} />}

      {data && (
        <Refreshable refreshing={refreshing}>
          {rows.length === 0 ? (
            <NoDataYet description="Bu dönemde ürünleriniz görüntülenmemiş. Menü paylaşıldıkça ürün performansı burada listelenecek." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-crema/50 text-left font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                    <th className="px-4 py-3">Ürün</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3 text-right">Görüntülenme</th>
                    <th className="px-4 py-3 text-right">Detay</th>
                    <th className="px-4 py-3 text-right">Sepet</th>
                    <th className="px-4 py-3 text-right">Dönüşüm</th>
                    {meta?.comparison && <th className="px-4 py-3 text-right">Trend</th>}
                    <th className="px-4 py-3">Değerlendirme</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-line/60 transition-colors last:border-0 hover:bg-crema/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/panel/analytics/products/${row.key}`}
                          className="font-medium transition-colors hover:text-paprika"
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{categoryNames.get(row.category) ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.views)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.detail_views)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.cart_adds)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPercent(row.conversion, 0)}</td>
                      {meta?.comparison && (
                        <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{formatChange(row.change)}</td>
                      )}
                      <td className="px-4 py-3">
                        <OpportunityBadge opportunity={row.opportunity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.trackedProducts > 0 && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Bu dönemde {formatNumber(data.trackedProducts)} ürün en az bir kez görüntülendi
            </p>
          )}
        </Refreshable>
      )}
    </div>
  );
}
