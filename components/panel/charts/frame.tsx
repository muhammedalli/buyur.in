"use client";

import { useState, type ReactNode } from "react";
import { CHART_INK_SOFT } from "@/components/panel/charts/palette";

// Her grafiğin ortak kabuğu: başlık, açıklama, lejant, boş/yükleniyor durumu ve
// "tabloyu göster" katmanı. Tablo görünümü isteğe bağlı bir süs değil: tooltip'e
// erişemeyen (klavye, ekran okuyucu, dokunmatik) okuyucu için değerlerin ikinci
// yolu — dataviz kuralı gereği her grafikte var.

export interface LegendItem {
  label: string;
  color: string;
  /** Çizgi serileri kısa çizgiyle, alan/bar serileri kare ile temsil edilir. */
  shape?: "line" | "rect";
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-ink-soft">
          {item.shape === "rect" ? (
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} aria-hidden />
          ) : (
            <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="animate-pulse rounded-md bg-crema/70" style={{ height }} role="status" aria-label="Grafik yükleniyor" />
  );
}

export function ChartEmpty({ height = 220, label }: { height?: number; label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line px-6 text-center"
      style={{ minHeight: height }}
    >
      <p className="text-sm font-semibold">Henüz yeterli veri yok</p>
      <p className="max-w-xs text-xs text-ink-soft">{label}</p>
    </div>
  );
}

export interface ChartTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

/** Grafik değerlerinin metin karşılığı — hover'a erişemeyen okuyucu için. */
export function ChartTable({ columns, rows }: { columns: ChartTableColumn[]; rows: Record<string, string>[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
        aria-expanded={open}
      >
        {open ? "Tabloyu gizle" : "Tabloyu göster"}
      </button>
      {open && (
        <div className="mt-2 max-h-64 overflow-auto rounded-md border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-crema/80 text-left font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={`px-3 py-2 ${column.align === "right" ? "text-right" : ""}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-line/70">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-1.5 ${column.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {row[column.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ChartFrame({
  title,
  hint,
  legend,
  actions,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  legend?: LegendItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-line bg-paper p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold">{title}</h3>
          {hint && <p className="mt-0.5 text-xs" style={{ color: CHART_INK_SOFT }}>{hint}</p>}
        </div>
        <div className="flex items-center gap-3">
          {legend && <ChartLegend items={legend} />}
          {actions}
        </div>
      </header>
      {children}
    </section>
  );
}
