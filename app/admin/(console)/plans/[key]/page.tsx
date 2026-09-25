import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/admin/button-link";
import { PlanForm } from "@/components/admin/plan-form";
import { PageHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { planDrift, planFormValues } from "@/lib/admin-plan-edit";
import { loadPlans, planBusinessCounts } from "@/lib/admin-plans";
import { normalizePlan } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function AdminPlanEditPage({ params }: { params: Promise<{ key: string }> }) {
  const [{ pb }, { key }] = await Promise.all([requireAdmin({ action: "plans.edit" }), params]);
  const [plans, counts] = await Promise.all([loadPlans(pb), planBusinessCounts()]);
  const plan = plans.find((p) => p.key === key);
  if (!plan) notFound();
  const drift = planDrift(plan);

  return (
    <>
      <PageHeader
        title={`${plan.name} planı`}
        description={`${counts[normalizePlan(plan.key)].toLocaleString("tr-TR")} işletme bu planda.`}
        action={
          <ButtonLink href="/admin/plans" variant="ghost" className="px-3">
            Planlara dön
          </ButtonLink>
        }
      />

      {drift.length > 0 && (
        <div className="mb-6 rounded-2xl border border-line bg-crema/60 px-5 py-4 text-sm">
          <p className="font-semibold text-ink">Canlı kayıt koddaki yedekten farklı</p>
          <p className="mt-1 text-ink-soft">
            Bu normal (plan panelden değişir). Ama PocketBase okunamazsa uygulama yedeğe düşer ve bu farklar o süre boyunca
            geçerli olmaz. Kalıcı bir değişiklikse yedeği (lib/entitlements.ts) ve tohum kataloğunu da güncelletin.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink">
            {drift.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <PlanForm
        planKey={plan.key}
        initial={planFormValues(plan)}
        updated={plan.updated}
        businessCount={counts[normalizePlan(plan.key)]}
        isDefault={plan.is_default}
      />
    </>
  );
}
