"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ClockIcon, EyeIcon, LockIcon } from "@/components/icons";
import { STATUS } from "@/components/panel/charts/palette";
import { formatNumber } from "@/components/panel/charts/chart-utils";
import {
  PLAN_LABELS,
  PLAN_LABELS_DATIVE,
  entitlementsFor,
  freemiumLimits,
  freemiumUsage,
  normalizePlan,
  upgradePlans,
  type FreemiumUsage,
} from "@/lib/entitlements";
import type { Business, Plan } from "@/lib/types";
import { buttonClass } from "@/components/panel/ui";
import { useUiLocale } from "@/components/ui-locale-provider";
import type { Translator } from "@/lib/ui-i18n";

// Freemium kullanımının tek görsel kaynağı: süre ve menü görüntülenme, yan yana.
// Kural (lib/entitlements.ts): iki limitten hangisi önce dolarsa Freemium biter.
// Ücretli planlarda hiçbir limit gösterilmez — çünkü uygulanmaz.

function toneFor(ratio: number): string {
  if (ratio >= 1) return STATUS.critical;
  if (ratio >= 0.9) return STATUS.critical;
  if (ratio >= 0.75) return STATUS.warning;
  return STATUS.good;
}

function Meter({ label, value, hint, ratio, icon }: { label: string; value: string; hint: string; ratio: number; icon: ReactNode }) {
  const tone = toneFor(ratio);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
          {icon}
          {label}
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums" style={{ color: tone }}>
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-crema">
        <div
          className="h-full rounded-r-[4px] transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(ratio * 100, 2))}%`, background: tone }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </div>
  );
}

export function planUsageMessage(usage: FreemiumUsage, plan: Plan, t: Translator): { title: string; detail: string } | null {
  if (!usage.limited) return null;
  const next = upgradePlans(plan)[0];

  if (usage.exhausted) {
    return usage.reason === "menu_views"
      ? {
          title: t("Freemium menü görüntülenme limitiniz doldu"),
          detail: t("Menünüzü aktif tutmak ve verilerinize erişmeye devam etmek için bir plana yükseltin."),
        }
      : {
          title: t("Freemium kullanım süreniz doldu"),
          detail: t("Menünüzü aktif tutmak ve verilerinize erişmeye devam etmek için bir plana yükseltin."),
        };
  }

  switch (usage.warningThreshold) {
    case 90:
      return {
        title: t("Freemium limitinize yaklaşıyorsunuz"),
        detail: next
          ? t("{planDative} geçerek kesintisiz devam edin.", { planDative: PLAN_LABELS_DATIVE[next], plan: PLAN_LABELS[next] })
          : t("Limit dolmadan bizimle iletişime geçin."),
      };
    case 75:
      return {
        title: t("Freemium kullanımınızın %75'ine ulaştınız"),
        detail: t("Limit dolmadan planınızı yükseltmek kesinti yaşamamanızı sağlar."),
      };
    case 50:
      return {
        title: t("Freemium kullanımınızın yarısına ulaştınız"),
        detail: t("Süre ya da menü görüntülenmeden hangisi önce dolarsa Freemium sona erer."),
      };
    default:
      return null;
  }
}

/** Panelde plan durumunu ve Freemium kullanımını gösteren kart. */
export function PlanUsageCard({ business, compact = false }: { business: Business; compact?: boolean }) {
  const { t, tag } = useUiLocale();
  const usage = freemiumUsage(business);
  const plan = normalizePlan(business.plan);
  const entitlements = entitlementsFor(plan);

  if (!usage.limited) {
    return (
      <div className="rounded-md border border-line bg-paper p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-ink-soft">{t("Plan")}</p>
          <Link
            href="/panel/plan"
            className="text-xs font-medium text-paprika transition-colors hover:text-paprika-deep"
          >
            {t("Plan detayı →")}
          </Link>
        </div>
        <p className="mt-2 font-display text-3xl font-extrabold">{PLAN_LABELS[plan]}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {t("Sınırsız menü görüntülenme · süre sınırı yok")}
          {entitlements.features.website ? ` · ${t("web sitesi")}` : ""}
        </p>
      </div>
    );
  }

  const viewRatio = usage.menuViewLimit ? usage.menuViews / usage.menuViewLimit : 0;
  // Süre çubuğu planın gerçek süresine göre dolar (sabit 90 gün değil).
  const totalDays = entitlements.limits.durationMonths ? entitlements.limits.durationMonths * 30 : null;
  const timeRatio = usage.daysLeft === null || !totalDays ? 0 : 1 - Math.min(1, usage.daysLeft / totalDays);
  const message = planUsageMessage(usage, plan, t);
  const upgrades = upgradePlans(plan);

  return (
    <div className="rounded-md border border-line bg-paper p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-ink-soft">{t("Plan")}</p>
        <Link
          href="/panel/plan"
          className="text-xs font-medium text-paprika transition-colors hover:text-paprika-deep"
        >
          Plan detayı →
        </Link>
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold">{PLAN_LABELS[plan]}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("{summary} — hangisi önce dolarsa", { summary: freemiumLimits(t, tag).summary })}</p>

      <div className="mt-4 space-y-3.5">
        <Meter
          icon={<ClockIcon size={13} />}
          label={t("Kalan süre")}
          value={usage.daysLeft === null ? "—" : t("{count} gün", { count: usage.daysLeft })}
          hint={usage.expiresAt ? t("Bitiş: {date}", { date: usage.expiresAt.toLocaleDateString(tag) }) : t("Süre bilgisi yok")}
          ratio={timeRatio}
        />
        <Meter
          icon={<EyeIcon size={13} />}
          label={t("Menü görüntülenme")}
          value={`${formatNumber(usage.menuViews)} / ${formatNumber(usage.menuViewLimit ?? 0)}`}
          hint={t("{count} görüntülenme kaldı", { count: formatNumber(Math.max(0, (usage.menuViewLimit ?? 0) - usage.menuViews)) })}
          ratio={viewRatio}
        />
      </div>

      {message && !compact && (
        <div
          className="mt-4 rounded-md px-4 py-3"
          style={{ background: usage.exhausted ? "rgba(194,56,20,0.08)" : "rgba(184,128,26,0.10)" }}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {usage.exhausted && <LockIcon size={14} className="text-paprika" />}
            {message.title}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{message.detail}</p>
          {upgrades.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {upgrades.map((target, index) => (
                <Link key={target} href="/panel/plan" className={buttonClass(index === 0 ? "primary" : "outline")}>
                  {t("{planDative} geç", { planDative: PLAN_LABELS_DATIVE[target], plan: PLAN_LABELS[target] })}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
