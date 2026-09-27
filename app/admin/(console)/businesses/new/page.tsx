import { ButtonLink } from "@/components/admin/button-link";
import { NewBusinessWizard, type WizardPlan } from "@/components/admin/new-business-wizard";
import { PageHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { loadPlans } from "@/lib/admin-plans";

export const dynamic = "force-dynamic";

// Yönetim panelinden yeni işletme açma (super_admin, business.create).
// Planlar yöneticinin kendi token'ıyla okunur; pasif plan listelenmez.

export default async function AdminNewBusinessPage() {
  const { pb, admin } = await requireAdmin({ action: "business.create" });
  const plans: WizardPlan[] = (await loadPlans(pb))
    .filter((plan) => plan.is_active)
    .map((plan) => ({ key: plan.key, name: plan.name || plan.key, trial_months: plan.trial_months ?? 0, is_default: plan.is_default }));

  return (
    <>
      <PageHeader
        title="Yeni işletme"
        description="Hesabı e-posta doğrulaması olmadan açın, planını seçin ve menüsünü asistanla hazırlayın. İşletmeye e-posta gönderilmez."
        action={
          <ButtonLink href="/admin/businesses" variant="ghost" size="sm">
            İşletmelere dön
          </ButtonLink>
        }
      />
      <NewBusinessWizard plans={plans} userName={admin.name || admin.email} />
    </>
  );
}
