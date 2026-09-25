import Link from "next/link";
import { ButtonLink } from "@/components/admin/button-link";
import { PlanBadge } from "@/components/admin/badges";
import { AdminPasswordForm } from "@/components/admin/password-form";
import { Card, PageHeader, SectionHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_LOG_COLLECTION, adminLogActionLabel } from "@/lib/admin-audit";
import { loadBusinessRows, loadPlatformActivity } from "@/lib/admin-businesses";
import { formatAdminDate, formatAdminDay } from "@/lib/admin-format";
import { computeOverview, type ExpiringBusiness } from "@/lib/admin-overview";
import { ADMIN_ROLE_LABELS, canPerform } from "@/lib/admin-roles";
import { PLAN_LABELS, PLAN_ORDER } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import type { AdminLog } from "@/lib/types";

export const dynamic = "force-dynamic";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function ExpiringList({ items, empty }: { items: ExpiringBusiness[]; empty: string }) {
  if (items.length === 0) return <p className="mt-4 text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="mt-4 divide-y divide-line text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/admin/businesses/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-paprika">
            <span className="min-w-0 truncate font-semibold">{item.name}</span>
            <span className="flex items-center gap-2">
              <PlanBadge plan={item.plan} />
              <span className="font-mono text-[11px] text-ink-soft">
                {formatAdminDay(item.expiresAt)} ·{" "}
                {item.daysLeft < 0 ? `${-item.daysLeft} gün geçti` : item.daysLeft === 0 ? "bugün" : `${item.daysLeft} gün`}
                {item.closesMenu ? " · menü kapanır" : ""}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const count = (n: number) => n.toLocaleString("tr-TR");

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb, admin }, params] = await Promise.all([requireAdmin(), searchParams]);
  const canViewBusinesses = canPerform(admin.role, "business.view");
  const canViewLogs = canPerform(admin.role, "logs.view");

  // Bağımsız okumalar tek turda. Plan kataloğu, "ücretli plan" ve "süre dolunca
  // menü kapanır" kararları için canlı kayıttan okunur.
  const [rows, activity, recent] = await Promise.all([
    canViewBusinesses
      ? getServicePB().then(async (service) => {
          await ensurePlanCatalog(service);
          return loadBusinessRows();
        })
      : Promise.resolve(null),
    canViewBusinesses ? loadPlatformActivity() : Promise.resolve(null),
    canViewLogs
      ? pb
          .collection(ADMIN_LOG_COLLECTION)
          .getList<AdminLog>(1, 5, { filter: pb.filter("admin = {:id}", { id: admin.id }), sort: "-created", requestKey: null })
          .then((res) => res.items)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const overview = rows ? computeOverview(rows) : null;
  const firstName = admin.name?.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader title={firstName ? `Hoş geldin, ${firstName}` : "Hoş geldin"} description="buyur platformunun genel durumu." />

      {params.yetkisiz === "1" && (
        <p role="alert" className="mb-6 rounded-xl border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          Açmaya çalıştığın sayfa için yetkin yok. Gerekiyorsa bir süper yöneticiden iste.
        </p>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Toplam hesap" value={count(overview.total)} hint={`Bugün ${count(overview.newToday)} · 7 günde ${count(overview.newThisWeek)} yeni`} />
            <Kpi label="Yayında" value={count(overview.byStatus.live)} hint={overview.byStatus.suspended ? `${count(overview.byStatus.suspended)} askıda` : undefined} />
            <Kpi label="Kurulum bekliyor" value={count(overview.byStatus.setup)} hint="Kayıt olup menü adresi seçmemiş" />
            <Kpi
              label="Ücretli plan oranı"
              value={overview.paidShare === null ? "—" : `%${Math.round(overview.paidShare * 100)}`}
              hint="Kurulumu bitmiş hesaplar içinde"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card>
              <SectionHeader title="Plan dağılımı" />
              <ul className="mt-4 space-y-3 text-sm">
                {PLAN_ORDER.map((plan) => {
                  const n = overview.byPlan[plan];
                  const share = overview.total > 0 ? Math.round((n / overview.total) * 100) : 0;
                  return (
                    <li key={plan}>
                      <div className="flex justify-between gap-3">
                        <Link href={`/admin/businesses?plan=${plan}`} className="text-ink hover:text-paprika">
                          {PLAN_LABELS[plan]}
                        </Link>
                        <span className="font-mono text-[12px] text-ink-soft">
                          {count(n)} · %{share}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-crema">
                        <div className="h-full rounded-full bg-paprika" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="lg:col-span-2">
              <SectionHeader title={`Son ${activity?.days ?? 30} gün, tüm menüler`} description="Günlük özetlerden; bugünün verisi gece işlenir." />
              {activity ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Kpi label="Ziyaret" value={count(activity.sessions)} />
                  <Kpi label="Sayfa görüntüleme" value={count(activity.pageViews)} />
                  <Kpi label="QR tarama" value={count(activity.qrScans)} />
                  <Kpi label="Ürün görüntüleme" value={count(activity.productViews)} />
                  <Kpi label="AI tarama (bu ay)" value={count(overview.aiScansThisMonth)} />
                  <Kpi label="Menü görüntülenme (tümü)" value={count(overview.menuViewsTotal)} hint="Hesap sayaçlarının toplamı" />
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-soft">Analitik özeti şu anda okunamıyor.</p>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card>
              <SectionHeader title="7 gün içinde bitiyor" description="Satış ve yenileme için ilk bakılacak liste." />
              <ExpiringList items={overview.expiring7} empty="Önümüzdeki 7 günde biten plan yok." />
            </Card>
            <Card>
              <SectionHeader title="8–30 gün içinde bitiyor" />
              <ExpiringList items={overview.expiring30} empty="Bu aralıkta biten plan yok." />
            </Card>
            <Card>
              <SectionHeader title="Süresi geçmiş" description="Süreli planda menü kapalıdır; ücretli planda yenileme gecikmiştir." />
              <ExpiringList items={overview.expired} empty="Süresi geçmiş plan yok." />
            </Card>
          </div>
        </>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <SectionHeader title="Hesabın" />
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">E-posta</dt>
              <dd className="mt-0.5 break-all text-ink">{admin.email}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Rol</dt>
              <dd className="mt-0.5 text-ink">{ADMIN_ROLE_LABELS[admin.role]}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-ink-soft">
            {canPerform(admin.role, "plans.edit")
              ? "Planları, fiyatları ve işletme erişimini değiştirebilirsin. Yaptığın her değişiklik denetim kaydına düşer."
              : "İşletmelere destek verebilir, süreyi uzatabilir ve AI kotasını sıfırlayabilirsin. Plan ve fiyat kararları süper yöneticidedir."}
          </p>
          <AdminPasswordForm />
        </Card>

        {canViewLogs && (
          <Card>
            <SectionHeader
              title="Son işlemlerin"
              action={
                <ButtonLink href="/admin/logs" className="px-3.5 py-2 text-[12px]">
                  Tümü
                </ButtonLink>
              }
            />
            {recent === null ? (
              <p className="mt-4 text-sm text-ink-soft">Denetim kaydı şu anda okunamıyor.</p>
            ) : recent.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">Henüz kayıtlı bir işlemin yok.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line text-sm">
                {recent.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                    <span className="text-ink">{adminLogActionLabel(log.action)}</span>
                    <span className="font-mono text-[11px] text-ink-soft">
                      {formatAdminDate(log.created)}
                      {log.ip ? ` · ${log.ip}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
