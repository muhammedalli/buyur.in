import Link from "next/link";
import { AdminAccounts, type AdminAccountRow } from "@/components/admin/admin-accounts";
import { SystemSettings, type PricedPlan, type SettingRow } from "@/components/admin/system-settings";
import { PageHeader } from "@/components/panel/ui";
import { ADMIN_COLLECTION, isServiceAccountEmail, requireAdmin } from "@/lib/admin-auth";
import { formatAdminDate } from "@/lib/admin-format";
import { loadLastEvents } from "@/lib/admin-logs";
import { canPerform } from "@/lib/admin-roles";
import { isDisabled } from "@/lib/admin-users";
import { PLAN_LABELS, PLAN_ORDER } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { planPricing } from "@/lib/pricing";
import {
  SETTINGS_COLLECTION,
  SYSTEM_SETTINGS,
  SYSTEM_SETTING_KEYS,
  isSettingLive,
  settingValueError,
  systemSetting,
  type SettingRecordLike,
} from "@/lib/system-settings";
import type { Admin } from "@/lib/types";

export const dynamic = "force-dynamic";

// Sistem (yalnızca super_admin): sistem geneli değişkenler (ör. yıllık ödeme
// indirimi) ve yönetim ekibinin hesapları. Planların kendisi Planlar
// ekranında; altyapı durumu genel bakışta kısa bir liste olarak durur.
// Sekme adres çubuğunda: bağlantı paylaşılabilir.

type Tab = "ayarlar" | "ekip";

export default async function AdminSystemPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb, admin }, params] = await Promise.all([requireAdmin({ action: "system.view" }), searchParams]);
  const canManageAdmins = canPerform(admin.role, "admins.manage");
  const tab: Tab = params.sekme === "ekip" && canManageAdmins ? "ekip" : "ayarlar";

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "ayarlar", label: "Genel ayarlar", show: true },
    { key: "ekip", label: "Yönetim ekibi", show: canManageAdmins },
  ];

  return (
    <>
      <PageHeader title="Sistem" description="Bütün işletmeleri etkileyen genel değişkenler ve yönetim ekibinin erişimi." />
      <nav aria-label="Sistem bölümleri" className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Link
              key={t.key}
              href={t.key === "ayarlar" ? "/admin/system" : `/admin/system?sekme=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`relative -mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[13px] font-semibold uppercase tracking-wide transition-colors ${
                tab === t.key ? "border-paprika text-paprika" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
      </nav>
      {tab === "ayarlar" ? <SettingsTab pb={pb} /> : <TeamTab pb={pb} selfId={admin.id} />}
    </>
  );
}

async function SettingsTab({ pb }: { pb: Awaited<ReturnType<typeof requireAdmin>>["pb"] }) {
  // Ekran kaydın KENDİSİNİ gösterir (önbelleği değil): az önce kaydedilen
  // değer, başka bir sunucu örneğinin 60 sn'lik önbelleğine takılmadan görünür.
  // Fiyatlar (etki önizlemesi) plan kataloğundan.
  const [records] = await Promise.all([
    pb
      .collection(SETTINGS_COLLECTION)
      .getFullList<SettingRecordLike>({ requestKey: null })
      .catch(() => null),
    getServicePB()
      .then(ensurePlanCatalog)
      .catch(() => undefined),
  ]);
  const rows: SettingRow[] = SYSTEM_SETTING_KEYS.map((key) => {
    // Kayıt okunamadıysa o an geçerli olan (son bilinen ya da yedek) değer.
    if (!records) return { key, value: systemSetting(key), live: isSettingLive(key), updated: "" };
    const record = records.find((r) => r.key === key);
    const valid = record !== undefined && settingValueError(key, record.value) === null;
    return {
      key,
      value: valid ? (record.value as number) : SYSTEM_SETTINGS[key].fallback,
      live: valid,
      updated: record?.updated ?? "",
    };
  });
  // İndirim oranının etkisini göstermek için fiyatı bilinen ücretli planlar.
  const plans: PricedPlan[] = PLAN_ORDER.flatMap((plan) => {
    const pricing = planPricing(plan);
    return pricing && pricing.monthly > 0 ? [{ name: PLAN_LABELS[plan], monthly: pricing.monthly }] : [];
  });
  return (
    <>
      {!records && (
        <p role="status" className="mb-4 rounded-md border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          Ayar kayıtları şu anda okunamıyor; gösterilen değerler sunucunun bildiği son değerler.
        </p>
      )}
      <SystemSettings rows={rows} plans={plans} />
    </>
  );
}

async function TeamTab({ pb, selfId }: { pb: Awaited<ReturnType<typeof requireAdmin>>["pb"]; selfId: string }) {
  const admins = await pb.collection(ADMIN_COLLECTION).getFullList<Admin>({ sort: "name", requestKey: null });
  // Servis hesabı bir insan değildir; listede görünmez (hedef de alınamaz).
  const people = admins.filter((a) => (a.role as string) !== "service" && !isServiceAccountEmail(a.email));
  const lastLogins = await loadLastEvents(pb, "admin.login", "actor_id", people.map((a) => a.id));
  const rows: AdminAccountRow[] = people.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    disabled: isDisabled(a),
    created: a.created,
    lastLogin: formatAdminDate(lastLogins[a.id]),
  }));
  return <AdminAccounts rows={rows} selfId={selfId} />;
}
