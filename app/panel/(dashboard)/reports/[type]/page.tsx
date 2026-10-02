"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonClass, PageHeader } from "@/components/panel/ui";
import { AnalyticsFilterBar } from "@/components/panel/analytics/filters";
import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import { AnalyticsErrorState, AnalyticsSkeleton, NoDataYet } from "@/components/panel/analytics/states";
import { LineChart } from "@/components/panel/charts/line-chart";
import { ArrowLeftIcon, FileTextIcon } from "@/components/icons";
import { buildCsv, downloadCsv } from "@/lib/analytics/export-csv";
import {
  formatChange,
  formatDateRange,
  formatDayLong,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/components/panel/charts/chart-utils";
import type { ReportPayload } from "@/lib/analytics/reports";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

// Rapor görünümü aynı zamanda yazdırma çıktısıdır: @media print kuralları
// (app/globals.css) panel kabuğunu gizler, kartları sayfaya böler. Böylece PDF
// için ayrı bir üretim hattı ve ek bağımlılık gerekmiyor — tarayıcının
// "PDF olarak kaydet" akışı markalı, düzgün bir belge üretiyor.

const SUMMARY_METRICS: { key: keyof ReportPayload["totals"]; label: string; format: (value: number) => string }[] = [
  { key: "page_views", label: msg("Menü görüntülenme"), format: formatNumber },
  { key: "visitors", label: msg("Tekil ziyaretçi"), format: formatNumber },
  { key: "sessions", label: msg("Oturum"), format: formatNumber },
  { key: "qr_scans", label: msg("QR tarama"), format: formatNumber },
  { key: "cart_adds", label: msg("Sepete ekleme"), format: formatNumber },
  { key: "avg_session_duration", label: msg("Ortalama süre"), format: formatDuration },
  { key: "cart_conversion", label: msg("Sepet dönüşümü"), format: (value) => formatPercent(value) },
  { key: "returning_rate", label: msg("Dönen ziyaretçi"), format: (value) => formatPercent(value) },
];

export default function ReportDetailPage() {
  const { type } = useParams<{ type: string }>();
  const { data, meta, loading, error, reload } = useAnalyticsQuery<ReportPayload>(`reports/${type}`);
  const { t } = useUiLocale();

  function handleCsv() {
    if (!data) return;
    const content = buildCsv(
      data.tables.map((table) => ({
        title: t(table.title),
        columns: table.columns.map((column) => ({ ...column, label: t(column.label) })),
        rows: table.rows,
      })),
      [
        `${data.business.name} — ${t(data.title)}`,
        t("Dönem: {range}", { range: formatDateRange(data.range.from, data.range.to) }),
        t("Oluşturulma: {date}", { date: formatDayLong(data.generatedAt.slice(0, 10)) }),
        t("BUYUR analiz raporu"),
      ]
    );
    downloadCsv(`${data.business.slug}-${data.type}-${data.range.from}_${data.range.to}`, content);
  }

  return (
    <div>
      <div className="print:hidden">
        <Link
          href="/panel/reports"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-paprika"
        >
          <ArrowLeftIcon size={14} /> {t("Rapor merkezi")}
        </Link>

        <PageHeader
          title={data ? t(data.title) : t("Rapor")}
          description={data ? t(data.description) : undefined}
          action={
            data && meta?.plan.export ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={buttonClass("primary")}
                >
                  {t("PDF olarak yazdır")}
                </button>
                <button
                  type="button"
                  onClick={handleCsv}
                  className={buttonClass("outline")}
                >
                  {t("CSV indir")}
                </button>
              </div>
            ) : undefined
          }
        />

        <AnalyticsFilterBar />
      </div>

      {loading && !data && <AnalyticsSkeleton />}
      {error?.isPlanLocked && (
        <FeatureLocked
          feature="advanced_reports"
          subject={t("Raporlar")}
          description={t("Hazır iş raporları ve dışa aktarma.")}
        />
      )}
      {error && !error.isPlanLocked && !data && <AnalyticsErrorState error={error} onRetry={reload} />}

      {data && (
        <article className="report-sheet space-y-5">
          {/* Rapor başlığı — yazdırmada belgenin kapağı */}
          <header className="rounded-md border border-line bg-paper p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-paprika">{t("BUYUR analiz raporu")}</p>
                <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">{t(data.title)}</h1>
                <p className="mt-1 text-sm text-ink-soft">{data.business.name}</p>
              </div>
              <div className="text-right text-xs font-medium text-ink-soft">
                <p>{formatDateRange(data.range.from, data.range.to)}</p>
                {data.comparison && (
                  <p className="mt-0.5">{t("Kıyas: {range}", { range: formatDateRange(data.comparison.from, data.comparison.to) })}</p>
                )}
                <p className="mt-0.5">{formatDayLong(data.generatedAt.slice(0, 10))}</p>
              </div>
            </div>
          </header>

          {data.totals.sessions === 0 && data.totals.page_views === 0 ? (
            <NoDataYet description={t("Seçilen dönemde rapor üretecek veri yok. Farklı bir tarih aralığı deneyin.")} />
          ) : (
            <>
              <section className="rounded-md border border-line bg-paper p-6">
                <h2 className="font-display text-lg font-bold">{t("Özet")}</h2>
                <ul className="mt-3 space-y-1.5">
                  {data.summary.map((line, index) => (
                    <li key={index} className="flex gap-2 text-sm">
                      <span className="text-paprika" aria-hidden>
                        —
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {SUMMARY_METRICS.map((metric) => (
                    <div key={metric.key} className="rounded-md border border-line px-4 py-3">
                      <p className="text-xs font-medium text-ink-soft">{t(metric.label)}</p>
                      <p className="mt-1 font-display text-xl font-extrabold">
                        {metric.format(data.totals[metric.key] as number)}
                      </p>
                      {data.previous && (
                        <p className="mt-0.5 text-xs font-medium text-ink-soft">
                          {formatChange(data.changes[metric.key] ?? null)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {data.score && data.score.score !== null && (
                <section className="rounded-md border border-line bg-paper p-6">
                  <h2 className="font-display text-lg font-bold">{t("Menü performans skoru")}</h2>
                  <p className="mt-2 font-display text-5xl font-extrabold">{data.score.score}<span className="text-lg text-ink-soft"> / 100</span></p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {data.score.components.map((component) => (
                      <p key={component.key} className="flex justify-between gap-3 text-sm">
                        <span>{t(component.label)}</span>
                        <span className="tabular-nums text-ink-soft">
                          {component.display} · {Math.round(component.score)}/100
                        </span>
                      </p>
                    ))}
                  </div>
                </section>
              )}

              {Object.keys(data.series).length > 0 && (
                <section className="rounded-md border border-line bg-paper p-6">
                  <h2 className="font-display text-lg font-bold">{t("Dönem seyri")}</h2>
                  <div className="mt-3">
                    <LineChart
                      series={Object.entries(data.series).map(([key, points]) => ({
                        key,
                        label: key === "page_views" ? t("Menü görüntülenme") : key === "sessions" ? t("Oturum") : key,
                        points,
                      }))}
                    />
                  </div>
                </section>
              )}

              {data.tables.map((table) => (
                <section key={table.key} className="report-block rounded-md border border-line bg-paper p-6">
                  <h2 className="font-display text-lg font-bold">{t(table.title)}</h2>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                          {table.columns.map((column) => (
                            <th key={column.key} className={`py-2 ${column.align === "right" ? "text-right" : ""}`}>
                              {t(column.label)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, index) => (
                          <tr key={index} className="border-b border-line/50 last:border-0">
                            {table.columns.map((column) => (
                              <td
                                key={column.key}
                                className={`py-2 ${column.align === "right" ? "text-right tabular-nums" : ""}`}
                              >
                                {typeof row[column.key] === "number"
                                  ? formatNumber(row[column.key] as number)
                                  : t(String(row[column.key] ?? "—"))}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              {data.insights.length > 0 && (
                <section className="report-block rounded-md border border-line bg-paper p-6">
                  <h2 className="font-display text-lg font-bold">{t("İçgörüler")}</h2>
                  <ul className="mt-3 space-y-3">
                    {data.insights.map((insight, index) => (
                      <li key={index}>
                        <p className="font-semibold">{insight.title}</p>
                        <p className="text-sm text-ink-soft">{insight.detail}</p>
                        <p className="text-xs font-medium text-ink-soft/80">
                          {insight.evidence}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <footer className="flex items-center justify-between gap-3 border-t border-line pt-4 text-xs font-medium text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <FileTextIcon size={12} /> BUYUR · {data.business.name}
                </span>
                <span>{data.business.slug}.buyur.in</span>
              </footer>
            </>
          )}
        </article>
      )}
    </div>
  );
}
