import Link from "next/link";
import { ButtonLink } from "@/components/admin/button-link";
import { EmptyState, PageHeader, Table } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { canPerform } from "@/lib/admin-roles";
import { planDrift, planFormValues } from "@/lib/admin-plan-edit";
import { loadPlans, planBusinessCounts } from "@/lib/admin-plans";
import { normalizePlan } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { formatTL, yearlyMonthlyPrice } from "@/lib/pricing";
import { formatSettingValue, systemSetting } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

// Planlar: her planın tek fiyatı (aylık) ve temel kuralları tek tabloda.
// Yıllık ödemenin karşılığı sistem ayarındaki indirimle hesaplanır; burada
// yalnızca gösterilir, ayrı bir fiyat olarak yönetilmez.

const TAG = "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider";

export default async function AdminPlansPage() {
  const { pb, admin } = await requireAdmin({ action: "plans.edit" });
  const [plans, counts] = await Promise.all([
    loadPlans(pb),
    planBusinessCounts(),
    getServicePB()
      .then(ensurePlanCatalog)
      .catch(() => undefined),
  ]);
  const discount = systemSetting("yearly_discount_percent");
  const canEditSettings = canPerform(admin.role, "settings.edit");

  return (
    <>
      <PageHeader
        title="Planlar ve fiyatlar"
        description={`Fiyat sayfası, panel kilitleri ve yasal fiyat tablosu bu kayıtlardan okunur; değişiklik en geç 60 saniyede her yerde geçerli olur. Yıllık ödemede aylık fiyata ${formatSettingValue("yearly_discount_percent", discount)} indirim uygulanır.`}
        action={
          canEditSettings ? (
            <ButtonLink href="/admin/system" size="sm">
              İndirim oranı
            </ButtonLink>
          ) : undefined
        }
      />
      {plans.length === 0 ? (
        <EmptyState title="Plan kaydı yok" description="scripts/migrate-plans.mjs ile tohum kataloğu yüklenmeli." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Plan</th>
              <th className="text-right">Aylık fiyat</th>
              <th className="hidden text-right sm:table-cell">Yıllıkta aylık</th>
              <th className="hidden md:table-cell">Süre</th>
              <th className="hidden lg:table-cell">Görüntülenme</th>
              <th className="hidden lg:table-cell">AI tarama / ay</th>
              <th className="text-right">İşletme</th>
              <th>
                <span className="sr-only">İşlem</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const values = planFormValues(plan);
              const drift = planDrift(plan);
              const paid = values.price_monthly > 0;
              return (
                <tr key={plan.id}>
                  <td className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/plans/${plan.key}`} className="font-display text-base font-bold text-ink hover:text-paprika">
                        {plan.name}
                      </Link>
                      {plan.is_default && <span className={`${TAG} border-line bg-crema text-ink-soft`}>Varsayılan</span>}
                      {!plan.is_active && <span className={`${TAG} border-paprika/40 bg-paprika/10 text-paprika`}>Pasif</span>}
                    </div>
                    {drift.length > 0 && (
                      <p className="mt-1 text-[12px] text-ink-soft" title={drift.join("\n")}>
                        Koddaki yedekten {drift.length} farkı var
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right font-semibold tabular-nums">{paid ? formatTL(values.price_monthly) : "Ücretsiz"}</td>
                  <td className="hidden whitespace-nowrap text-right tabular-nums text-ink-soft sm:table-cell">
                    {paid ? formatTL(yearlyMonthlyPrice(values.price_monthly, discount)) : "—"}
                  </td>
                  <td className="hidden whitespace-nowrap md:table-cell">{values.trial_months === 0 ? "Süresiz" : `${values.trial_months} ay`}</td>
                  <td className="hidden whitespace-nowrap lg:table-cell">
                    {values.menu_views === null ? "Sınırsız" : values.menu_views.toLocaleString("tr-TR")}
                  </td>
                  <td className="hidden whitespace-nowrap lg:table-cell">
                    {values.ai_scans_per_month === null ? "Sınırsız" : values.ai_scans_per_month}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    <Link href={`/admin/businesses?plan=${normalizePlan(plan.key)}`} className="hover:text-paprika">
                      {counts[normalizePlan(plan.key)].toLocaleString("tr-TR")}
                    </Link>
                  </td>
                  <td className="w-px whitespace-nowrap text-right">
                    <ButtonLink href={`/admin/plans/${plan.key}`} size="sm">
                      Düzenle
                    </ButtonLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
