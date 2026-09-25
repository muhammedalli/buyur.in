import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { planDrift, planFormValues } from "@/lib/admin-plan-edit";
import { loadPlans, planBusinessCounts } from "@/lib/admin-plans";
import { formatAdminDate } from "@/lib/admin-format";
import { normalizePlan } from "@/lib/entitlements";
import { formatTL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const { pb } = await requireAdmin({ action: "plans.edit" });
  const [plans, counts] = await Promise.all([loadPlans(pb), planBusinessCounts()]);

  return (
    <>
      <PageHeader
        title="Planlar ve fiyatlar"
        description="Fiyat sayfası, panel kilitleri ve yasal fiyat tablosu bu kayıtlardan okunur. Değişiklik en geç 60 saniyede her yerde geçerli olur."
      />
      {plans.length === 0 ? (
        <EmptyState title="Plan kaydı yok" description="scripts/migrate-plans.mjs ile tohum kataloğu yüklenmeli." />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const values = planFormValues(plan);
            const drift = planDrift(plan);
            return (
              <Link key={plan.id} href={`/admin/plans/${plan.key}`} className="group block">
                <Card className="h-full transition-colors group-hover:border-paprika">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-xl font-bold text-ink">{plan.name}</p>
                    <div className="flex gap-1.5">
                      {plan.is_default && (
                        <span className="rounded-full border border-line bg-crema px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                          Varsayılan
                        </span>
                      )}
                      {!plan.is_active && (
                        <span className="rounded-full border border-paprika/40 bg-paprika/10 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-paprika">
                          Pasif
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {values.price_monthly > 0 ? `${formatTL(values.price_monthly)} / ay` : "Ücretsiz"}
                    {values.price_yearly_monthly > 0 && values.price_yearly_monthly !== values.price_monthly
                      ? ` · yıllıkta ${formatTL(values.price_yearly_monthly)} / ay`
                      : ""}
                  </p>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">İşletme</dt>
                      <dd className="font-semibold text-ink">{counts[normalizePlan(plan.key)].toLocaleString("tr-TR")}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">Süre</dt>
                      <dd className="text-ink">{values.trial_months === 0 ? "Süresiz" : `${values.trial_months} ay`}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">Görüntülenme</dt>
                      <dd className="text-ink">{values.menu_views === null ? "Sınırsız" : values.menu_views.toLocaleString("tr-TR")}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">AI tarama / ay</dt>
                      <dd className="text-ink">{values.ai_scans_per_month === null ? "Sınırsız" : values.ai_scans_per_month}</dd>
                    </div>
                  </dl>
                  {drift.length > 0 && (
                    <p className="mt-4 rounded-xl border border-line bg-crema/60 px-3 py-2 text-xs text-ink-soft">
                      Koddaki yedekten {drift.length} farkı var.
                    </p>
                  )}
                  <p className="mt-4 font-mono text-[11px] text-ink-soft">Son değişiklik {formatAdminDate(plan.updated)}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
