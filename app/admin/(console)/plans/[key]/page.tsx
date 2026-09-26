import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanForm } from "@/components/admin/plan-form";
import { ChevronLeftIcon } from "@/components/icons";
import { PageHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { planDrift, planFormValues } from "@/lib/admin-plan-edit";
import { loadPlans, planBusinessCounts } from "@/lib/admin-plans";
import { normalizePlan } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { systemSetting } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

export default async function AdminPlanEditPage({ params }: { params: Promise<{ key: string }> }) {
  const [{ pb }, { key }] = await Promise.all([requireAdmin({ action: "plans.edit" }), params]);
  // Yıllık fiyat önizlemesi için indirim oranı sistem ayarından (katalogla aynı tur).
  const [plans, counts] = await Promise.all([
    loadPlans(pb),
    planBusinessCounts(),
    getServicePB()
      .then(ensurePlanCatalog)
      .catch(() => undefined),
  ]);
  const plan = plans.find((p) => p.key === key);
  if (!plan) notFound();
  const drift = planDrift(plan);

  return (
    <>
      <Link
        href="/admin/plans"
        className="mb-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
      >
        <ChevronLeftIcon size={14} />
        Planlar
      </Link>
      <PageHeader title={`${plan.name} planı`} description={`${counts[normalizePlan(plan.key)].toLocaleString("tr-TR")} işletme bu planda.`} />

      {drift.length > 0 && (
        <details className="mb-6 rounded-md border border-line bg-crema/60 px-5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">Canlı kayıt koddaki yedekten {drift.length} noktada farklı</summary>
          <p className="mt-2 text-ink-soft">
            Bu normal (plan panelden değişir). Ama PocketBase okunamazsa uygulama yedeğe düşer ve bu farklar o süre boyunca
            geçerli olmaz. Kalıcı bir değişiklikse yedeği (lib/entitlements.ts) ve tohum kataloğunu da güncelletin.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink">
            {drift.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}

      <PlanForm
        planKey={plan.key}
        initial={planFormValues(plan)}
        updated={plan.updated}
        businessCount={counts[normalizePlan(plan.key)]}
        isDefault={plan.is_default}
        yearlyDiscountPercent={systemSetting("yearly_discount_percent")}
      />
    </>
  );
}
