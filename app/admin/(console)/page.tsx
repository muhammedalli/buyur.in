import Link from "next/link";
import { AuditLogList } from "@/components/admin/audit-log-list";
import { ButtonLink } from "@/components/admin/button-link";
import { PlanBadge } from "@/components/admin/badges";
import { Card, PageHeader, SectionHeader, StatGroup, Table } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { AUDIT_LOG_COLLECTION, HIGHLIGHT_ACTIONS } from "@/lib/audit-log";
import { loadBusinessRows, loadPlatformActivity } from "@/lib/admin-businesses";
import { formatAdminDay } from "@/lib/admin-format";
import { loadBusinessNames } from "@/lib/admin-logs";
import { computeOverview, type ExpiringBusiness } from "@/lib/admin-overview";
import { canPerform } from "@/lib/admin-roles";
import { PLAN_LABELS, PLAN_ORDER } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

// Genel bakış: yalnızca karar verdiren sayılar. Hesap sayıları, plan
// dağılımı, yaklaşan plan bitişleri ve son önemli işlemler.
// Ayrıntı (AI kullanımı, içerik düzenlemeleri, tek işletmenin istatistiği)
// kendi ekranında durur; burada tekrar edilmez.

const count = (n: number) => n.toLocaleString("tr-TR");

/** Önümüzdeki 30 gün içinde bitenler (en yakın önce), ardından son 30 günde
 *  bitmişler (en yeni önce). Aylar önce bitmiş kayıt listeyi işgal etmez. */
function upcomingExpiries(items: ExpiringBusiness[]): ExpiringBusiness[] {
  const upcoming = items.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft);
  const recent = items.filter((b) => b.daysLeft < 0 && b.daysLeft >= -30).sort((a, b) => b.daysLeft - a.daysLeft);
  return [...upcoming, ...recent].slice(0, 10);
}

function remaining(item: ExpiringBusiness): string {
  if (item.daysLeft < 0) return `${-item.daysLeft} gün önce bitti${item.closesMenu ? " · menü kapalı" : ""}`;
  if (item.daysLeft === 0) return "Bugün bitiyor";
  return `${item.daysLeft} gün kaldı`;
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb, admin }, params] = await Promise.all([requireAdmin(), searchParams]);
  const canViewBusinesses = canPerform(admin.role, "business.view");
  const canViewLogs = canPerform(admin.role, "logs.view");

  const highlightFilter = HIGHLIGHT_ACTIONS.map((action, i) => pb.filter(`action = {:a${i}}`, { [`a${i}`]: action })).join(" || ");

  // Bağımsız okumalar tek turda. Plan kataloğu "süre dolunca menü kapanır"
  // kararı için canlı kayıttan okunur.
  const [rows, activity, contentCounts, recent] = await Promise.all([
    canViewBusinesses
      ? getServicePB().then(async (service) => {
          await ensurePlanCatalog(service);
          return loadBusinessRows();
        })
      : Promise.resolve(null),
    canViewBusinesses ? loadPlatformActivity() : Promise.resolve(null),
    canViewBusinesses
      ? getServicePB()
          .then((service) =>
            Promise.all(
              ["buyur_products", "buyur_categories"].map((collection) =>
                service.collection(collection).getList(1, 1, { fields: "id", requestKey: null }).then((r) => r.totalItems)
              )
            )
          )
          .catch(() => null)
      : Promise.resolve(null),
    // undefined = yetki yok (bölüm hiç çizilmez); null = okunamadı.
    canViewLogs
      ? pb
          .collection(AUDIT_LOG_COLLECTION)
          .getList<AuditLog>(1, 8, { filter: highlightFilter, sort: "-created", requestKey: null })
          .then((res) => res.items)
          .catch(() => null)
      : Promise.resolve(undefined),
  ]);
  const overview = rows ? computeOverview(rows) : null;
  const names = recent ? await loadBusinessNames(pb, recent) : {};
  const firstName = admin.name?.trim().split(/\s+/)[0];
  const expiries = overview ? upcomingExpiries([...overview.expiring7, ...overview.expiring30, ...overview.expired]) : [];

  return (
    <>
      <PageHeader title="Genel bakış" description={firstName ? `Hoş geldin, ${firstName}. Platformun bugünkü durumu.` : "Platformun bugünkü durumu."} />

      {params.yetkisiz === "1" && (
        <p role="alert" className="mb-6 rounded-md border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          Açmaya çalıştığın sayfa için yetkin yok. Gerekiyorsa bir süper yöneticiden iste.
        </p>
      )}

      {overview && (
        <StatGroup
          items={[
            {
              label: "Toplam işletme",
              value: count(overview.total),
              hint: `Bu hafta ${count(overview.newThisWeek)} yeni kayıt`,
              href: "/admin/businesses",
            },
            {
              label: "Yayında",
              value: count(overview.byStatus.live),
              hint:
                overview.byStatus.suspended > 0
                  ? `${count(overview.byStatus.setup)} kurulum bekliyor · ${count(overview.byStatus.suspended)} askıda`
                  : `${count(overview.byStatus.setup)} kurulum bekliyor`,
              href: "/admin/businesses?durum=live",
            },
            {
              label: "Menülerdeki ürün",
              value: contentCounts ? count(contentCounts[0]) : "—",
              hint: contentCounts ? `${count(contentCounts[1])} kategori` : "Sayılamadı",
            },
            {
              label: `Son ${activity?.days ?? 30} gün ziyaret`,
              value: activity ? count(activity.sessions) : "—",
              hint: activity ? `${count(activity.qrScans)} QR tarama` : "Analitik özeti okunamadı",
            },
          ]}
        />
      )}

      {overview && (
        <section className="mt-10">
          <SectionHeader title="Plan dağılımı" />
          <Table className="mt-4">
            <thead>
              <tr>
                <th>Plan</th>
                <th className="text-right">İşletme</th>
                <th className="w-2/5">
                  <span className="sr-only">Pay</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((plan) => {
                const n = overview.byPlan[plan];
                const share = overview.total > 0 ? (n / overview.total) * 100 : 0;
                return (
                  <tr key={plan}>
                    <td>
                      <Link href={`/admin/businesses?plan=${plan}`} className="font-semibold text-ink hover:text-paprika">
                        {PLAN_LABELS[plan]}
                      </Link>
                    </td>
                    <td className="text-right font-mono tabular-nums">{count(n)}</td>
                    <td>
                      <div className="h-1.5 overflow-hidden rounded-full bg-crema" title={`%${Math.round(share)}`}>
                        <div className="h-full rounded-full bg-paprika" style={{ width: `${share}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}

      {overview && (
        <section className="mt-10">
          <SectionHeader
            title="Plan bitişleri"
            description="Önümüzdeki 30 gün içinde bitenler ve son 30 günde bitenler."
            action={
              <ButtonLink href="/admin/businesses?sirala=expiring" size="sm">
                Tümü
              </ButtonLink>
            }
          />
          {expiries.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
              Yakın zamanda biten ya da bitecek plan yok.
            </p>
          ) : (
            <Table className="mt-4">
              <thead>
                <tr>
                  <th>İşletme</th>
                  <th>Plan</th>
                  <th className="hidden sm:table-cell">Bitiş</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {expiries.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[14rem]">
                      <Link href={`/admin/businesses/${item.id}`} className="block truncate font-semibold text-ink hover:text-paprika">
                        {item.name}
                      </Link>
                    </td>
                    <td>
                      <PlanBadge plan={item.plan} />
                    </td>
                    <td className="hidden font-mono text-[12px] text-ink-soft sm:table-cell">{formatAdminDay(item.expiresAt)}</td>
                    <td className={item.daysLeft < 0 ? "text-paprika-deep" : item.daysLeft <= 7 ? "text-ink" : "text-ink-soft"}>
                      {remaining(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}

      {recent !== undefined && (
        <section className="mt-10">
          <SectionHeader
            title="Son önemli işlemler"
            description="Yeni hesaplar, plan ve erişim kararları, sistem ayarları."
            action={
              <ButtonLink href="/admin/logs" size="sm">
                Denetim kaydı
              </ButtonLink>
            }
          />
          <Card className="mt-4">
            {recent === null ? (
              <p className="text-sm text-ink-soft">Denetim kaydı şu anda okunamıyor.</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-ink-soft">Henüz kayıtlı önemli bir işlem yok.</p>
            ) : (
              <AuditLogList logs={recent} businessNames={names} />
            )}
          </Card>
        </section>
      )}
    </>
  );
}
