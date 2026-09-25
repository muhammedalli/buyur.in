"use client";

import Link from "next/link";
import { PageHeader } from "@/components/panel/ui";
import { AnalyticsFilterBar } from "@/components/panel/analytics/filters";
import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import { AnalyticsErrorState } from "@/components/panel/analytics/states";
import { FileTextIcon } from "@/components/icons";
import { formatDateRange } from "@/components/panel/charts/chart-utils";
import type { ReportDefinition } from "@/lib/analytics/reports";
import { FeatureLocked } from "@/components/panel/plan-gate";

export default function ReportsPage() {
  const { data, meta, loading, error, reload } = useAnalyticsQuery<{
    reports: ReportDefinition[];
    canExport: boolean;
  }>("reports");

  return (
    <div>
      <PageHeader
        title="Rapor merkezi"
        description="Seçtiğiniz dönem için hazır iş raporları — ekranda inceleyin, PDF olarak yazdırın veya CSV indirin"
      />

      <AnalyticsFilterBar />

      {error?.isPlanLocked && (
        <FeatureLocked
          feature="advanced_reports"
          subject="Rapor merkezi"
          description="Menü, ürün, kategori, müşteri davranışı ve trafik raporları ile yönetici özeti; PDF/CSV dışa aktarma."
        />
      )}
      {error && !error.isPlanLocked && <AnalyticsErrorState error={error} onRetry={reload} />}

      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-crema/70" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.reports.map((report) => (
              <Link
                key={report.type}
                href={`/panel/reports/${report.type}`}
                className="group rounded-2xl border border-line bg-paper p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-paprika/50 hover:shadow-[0_18px_40px_-24px_rgba(35,24,18,0.5)]"
              >
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  <FileTextIcon size={14} /> Rapor
                </span>
                <h2 className="mt-2 font-display text-lg font-bold transition-colors group-hover:text-paprika">
                  {report.title}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">{report.description}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {report.sections.map((section) => (
                    <li
                      key={section}
                      className="rounded-full bg-crema/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft"
                    >
                      {section}
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {meta ? `Seçili dönem: ${formatDateRange(meta.range.from, meta.range.to)}` : ""}
            {data.canExport ? " · PDF ve CSV dışa aktarma açık" : ""}
          </p>
        </>
      )}
    </div>
  );
}
