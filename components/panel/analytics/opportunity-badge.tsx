"use client";

import { useState } from "react";
import { OPPORTUNITY_TONE, type Opportunity } from "@/lib/analytics/opportunities";
import { STATUS } from "@/components/panel/charts/palette";

// Fırsat rozeti. Renk tek başına anlam taşımıyor: her rozet metin etiketiyle
// birlikte geliyor, ayrıntı ve öneri ise tıklanınca/hover'da açılıyor.

const TONE_STYLE: Record<"good" | "warning" | "critical" | "neutral", { color: string; background: string }> = {
  good: { color: STATUS.good, background: "rgba(47,125,79,0.10)" },
  warning: { color: STATUS.warning, background: "rgba(184,128,26,0.12)" },
  critical: { color: STATUS.critical, background: "rgba(194,56,20,0.10)" },
  neutral: { color: STATUS.neutral, background: "rgba(92,74,61,0.08)" },
};

export function OpportunityBadge({ opportunity, showDetail = false }: { opportunity: Opportunity; showDetail?: boolean }) {
  const [open, setOpen] = useState(false);
  const tone = TONE_STYLE[OPPORTUNITY_TONE[opportunity.kind]];

  if (showDetail) {
    return (
      <div className="rounded-md border border-line p-4" style={{ background: tone.background }}>
        <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: tone.color }}>
          {opportunity.label}
        </p>
        <p className="mt-1.5 text-sm">{opportunity.message}</p>
        {opportunity.recommendation && (
          <p className="mt-1.5 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Öneri: </span>
            {opportunity.recommendation}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
        style={{ color: tone.color, background: tone.background }}
      >
        {opportunity.label}
      </button>

      {open && (
        <span className="absolute right-0 top-full z-20 mt-1 block w-64 rounded-md border border-line bg-paper px-3 py-2 text-left text-xs leading-relaxed shadow-[0_14px_34px_-18px_rgba(35,24,18,0.6)]">
          <span className="block text-ink">{opportunity.message}</span>
          {opportunity.recommendation && (
            <span className="mt-1 block text-ink-soft">{opportunity.recommendation}</span>
          )}
        </span>
      )}
    </span>
  );
}
