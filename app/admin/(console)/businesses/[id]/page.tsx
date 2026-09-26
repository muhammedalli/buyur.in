import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditLogList } from "@/components/admin/audit-log-list";
import { ButtonLink } from "@/components/admin/button-link";
import { PlanBadge, StatusBadge } from "@/components/admin/badges";
import { BusinessActions, BusinessNoteForm } from "@/components/admin/business-actions";
import { ChevronLeftIcon } from "@/components/icons";
import { Card, PageHeader, SectionHeader, StatGroup } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { BUSINESS_ACTIONS, type BusinessActionKind } from "@/lib/admin-business-actions";
import { businessStatus } from "@/lib/admin-business-list";
import { loadBusinessDetail } from "@/lib/admin-businesses";
import { formatAdminDate, formatAdminDay, toDateInputValue } from "@/lib/admin-format";
import { loadLastEvents } from "@/lib/admin-logs";
import { canPerform } from "@/lib/admin-roles";
import { aiUsage, freemiumUsage, normalizePlan } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { menuUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// İşletme detayı: kim, hangi planda, durumu ne, menüsü kullanılıyor mu —
// ve bunlarla ilgili temel işlemler. Ayrıntılı analiz, QR ve değerlendirme
// listeleri işletmenin kendi panelindedir; burada tekrar edilmez.

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

const count = (n: number) => n.toLocaleString("tr-TR");

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ pb, admin }, { id }] = await Promise.all([requireAdmin({ action: "business.view" }), params]);
  // Plan kuralları (süre/kota) canlı katalogdan okunur; giriş geçmişi aynı turda.
  const [detail, , logins, failures] = await Promise.all([
    loadBusinessDetail(id),
    getServicePB().then(ensurePlanCatalog),
    loadLastEvents(pb, "business.login", "business_id", [id]),
    loadLastEvents(pb, "business.login_failed", "business_id", [id]),
  ]);
  if (!detail) notFound();

  const { business, counts, notes, logs, logTotal, activity } = detail;
  const status = businessStatus(business);
  const deleted = status === "deleted";
  const usage = freemiumUsage(business);
  const ai = aiUsage(business);
  const allowed = (Object.keys(BUSINESS_ACTIONS) as BusinessActionKind[]).filter((kind) =>
    canPerform(admin.role, BUSINESS_ACTIONS[kind].permission)
  );
  const lastLogin = logins[id];
  const lastFailure = failures[id];

  return (
    <>
      <Link
        href="/admin/businesses"
        className="mb-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
      >
        <ChevronLeftIcon size={14} />
        İşletmeler
      </Link>
      <PageHeader
        title={business.name || "Adsız hesap"}
        description={business.slug ? menuUrl(business.slug).replace(/^https?:\/\//, "") : "Kurulum henüz tamamlanmadı"}
        action={
          <>
            <ButtonLink href={`/admin/businesses/${business.id}/menu`} size="sm">
              Menü içeriği
            </ButtonLink>
            {business.slug && status !== "setup" && !deleted && (
              <ButtonLink href={menuUrl(business.slug)} external size="sm">
                Menüyü aç ↗
              </ButtonLink>
            )}
          </>
        }
      />

      {deleted && (
        <p role="status" className="mb-6 rounded-md border border-ink/30 bg-ink/10 px-4 py-3 text-sm text-ink">
          {formatAdminDate(business.deleted_at)} tarihinde silindi. Hesap girişe kapalı, menü yayında değil; veri duruyor.
          {business.deletion_reason ? ` Gerekçe: “${business.deletion_reason}”` : ""}
        </p>
      )}

      {status === "suspended" && (
        <p role="status" className="mb-6 rounded-md border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          {formatAdminDate(business.suspended_at)} tarihinden beri askıda.
          {business.suspension_reason ? ` Sahibine gösterilen mesaj: “${business.suspension_reason}”` : ""}
        </p>
      )}

      <Card>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Plan ve durum">
            <span className="flex flex-wrap items-center gap-2">
              <PlanBadge plan={business.plan} />
              <StatusBadge status={status} />
            </span>
          </Fact>
          <Fact label="Plan bitişi">
            {business.plan_expires_at
              ? `${formatAdminDay(business.plan_expires_at)}${usage.limited && usage.daysLeft !== null ? ` · ${usage.daysLeft} gün kaldı` : ""}`
              : "Süresiz"}
          </Fact>
          <Fact label="Menü görüntülenme">
            {usage.limited
              ? `${count(usage.menuViews)}${usage.menuViewLimit !== null ? ` / ${count(usage.menuViewLimit)}` : ""}${usage.exhausted ? " · limit doldu, menü kapalı" : ""}`
              : `${count(Math.max(0, business.menu_views ?? 0))} · sınırsız`}
          </Fact>
          <Fact label="AI tarama (bu ay)">{ai.limit === null ? `${ai.used} · sınırsız` : `${ai.used} / ${ai.limit}`}</Fact>
          <Fact label="Giriş e-postası">{business.email || "—"}</Fact>
          <Fact label="Telefon">{business.phone || "—"}</Fact>
          <Fact label="Son giriş">
            {lastLogin ? formatAdminDate(lastLogin) : "Kayıtlı giriş yok"}
            {lastFailure && (
              <span className="block text-[13px] text-paprika-deep">Son başarısız deneme: {formatAdminDate(lastFailure)}</span>
            )}
          </Fact>
          <Fact label="Kayıt">{formatAdminDay(business.created)}</Fact>
        </dl>
        <p className="mt-5 border-t border-line pt-3 font-mono text-[11px] text-ink-soft">Kimlik · {business.id}</p>
      </Card>

      <StatGroup
        className="mt-6"
        items={[
          { label: "Ürün", value: count(counts.products) },
          { label: "Kategori", value: count(counts.categories) },
          { label: `Ziyaret · ${activity?.days ?? 30} gün`, value: activity ? count(activity.sessions) : "—" },
          { label: `QR tarama · ${activity?.days ?? 30} gün`, value: activity ? count(activity.qrScans) : "—" },
        ]}
      />

      <section className="mt-10">
        <SectionHeader title="İşlemler" description="Her işlem gerekçesiyle denetim kaydına yazılır." />
        <div className="mt-4">
          <BusinessActions
            businessId={business.id}
            allowed={allowed}
            current={{
              plan: normalizePlan(business.plan),
              expiresOn: toDateInputValue(business.plan_expires_at),
              // Silme askıyı da koyar; ekranda "askıda" yerine "silindi" görünür.
              suspended: Boolean(business.suspended_at?.trim()),
              deleted,
              slug: business.slug,
              email: business.email ?? "",
              info: {
                name: business.name ?? "",
                description: business.description ?? "",
                phone: business.phone ?? "",
                address: business.address ?? "",
                working_hours: business.working_hours ?? "",
                contact_email: business.contact_email ?? "",
                whatsapp: business.whatsapp ?? "",
                instagram: business.instagram ?? "",
                google_maps_url: business.google_maps_url ?? "",
                is_active: Boolean(business.is_active),
              },
            }}
          />
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Etkinlik geçmişi"
          description="Sahibinin panel işlemleri, girişleri, yönetim işlemleri ve AI kullanımı."
          action={
            logTotal > logs.length && canPerform(admin.role, "logs.view") ? (
              <ButtonLink href={`/admin/logs?isletme=${business.id}`} size="sm">
                Tümü ({count(logTotal)})
              </ButtonLink>
            ) : undefined
          }
        />
        <Card className="mt-4">
          {logs.length === 0 ? <p className="text-sm text-ink-soft">Henüz kayıtlı bir işlem yok.</p> : <AuditLogList logs={logs} hideBusiness />}
        </Card>
      </section>

      <section className="mt-10">
        <SectionHeader title="İç notlar" description="Müşteri görmez. Notlar silinmez; düzeltme için yeni not ekle." />
        <Card className="mt-4">
          {canPerform(admin.role, "business.note") && <BusinessNoteForm businessId={business.id} />}
          {notes.length === 0 ? (
            <p className={`text-sm text-ink-soft ${canPerform(admin.role, "business.note") ? "mt-4" : ""}`}>Henüz not yok.</p>
          ) : (
            <ul className={`divide-y divide-line ${canPerform(admin.role, "business.note") ? "mt-4 border-t border-line" : ""}`}>
              {notes.map((note) => (
                <li key={note.id} className="py-3 text-sm">
                  <p className="whitespace-pre-wrap text-ink">{note.body}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-soft">
                    {note.admin_email} · {formatAdminDate(note.created)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
