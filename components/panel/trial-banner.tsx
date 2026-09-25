"use client";

import Link from "next/link";
import { useBusiness } from "@/components/panel/business-context";
import { ClockIcon, LockIcon } from "@/components/icons";
import { planUsageMessage } from "@/components/panel/plan-usage";
import { freemiumUsage } from "@/lib/entitlements";

/** Freemium kullanımını hatırlatan üst bant. Eşikler ve mesajlar tek kaynaktan
 *  (lib/entitlements.ts + plan-usage.tsx) gelir. Ücretli planlarda hiç görünmez —
 *  Premium/Elite'te süre ya da görüntülenme limiti yoktur. */
export function TrialBanner() {
  const { business } = useBusiness();
  if (!business) return null;

  const usage = freemiumUsage(business);
  const message = planUsageMessage(usage, business.plan);
  if (!message) return null;

  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
        usage.exhausted ? "border-paprika/40 bg-paprika/5" : "border-line bg-crema/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${usage.exhausted ? "text-paprika" : "text-ink-soft"}`} aria-hidden>
          {usage.exhausted ? <LockIcon size={18} /> : <ClockIcon size={18} />}
        </span>
        <div>
          <p className="font-display text-sm font-bold">{message.title}</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {message.detail}
            {usage.daysLeft !== null && usage.menuViewLimit !== null && !usage.exhausted && (
              <>
                {" "}
                <span className="whitespace-nowrap">
                  ({usage.daysLeft} gün · {usage.menuViews.toLocaleString("tr-TR")}/
                  {usage.menuViewLimit.toLocaleString("tr-TR")} görüntülenme)
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      <Link
        href="/panel/plan"
        className={`shrink-0 rounded-md px-5 py-2.5 text-center font-mono text-[12px] uppercase tracking-wider transition-colors ${
          usage.exhausted
            ? "bg-ink text-paper hover:bg-paprika"
            : "border border-line text-ink hover:border-paprika hover:text-paprika"
        }`}
      >
        Planımı yükselt
      </Link>
    </div>
  );
}
