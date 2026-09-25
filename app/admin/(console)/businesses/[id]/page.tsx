import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/admin/button-link";
import { PlanBadge, StatusBadge } from "@/components/admin/badges";
import { BusinessActions, BusinessNoteForm } from "@/components/admin/business-actions";
import { Card, PageHeader, SectionHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { adminLogActionLabel, adminLogChangeLines } from "@/lib/admin-audit";
import { BUSINESS_ACTIONS, type BusinessActionKind } from "@/lib/admin-business-actions";
import { businessStatus } from "@/lib/admin-business-list";
import { loadBusinessDetail } from "@/lib/admin-businesses";
import { formatAdminDate, formatAdminDay, toDateInputValue } from "@/lib/admin-format";
import { canPerform } from "@/lib/admin-roles";
import { aiUsage, freemiumUsage, normalizePlan } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { menuUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-crema/40 px-4 py-3">
      <p className="font-display text-xl font-bold text-ink">{value.toLocaleString("tr-TR")}</p>
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</p>
    </div>
  );
}

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ admin }, { id }] = await Promise.all([requireAdmin({ action: "business.view" }), params]);
  // Plan kuralları (süre/kota) canlı katalogdan okunur.
  const [detail] = await Promise.all([loadBusinessDetail(id), getServicePB().then(ensurePlanCatalog)]);
  if (!detail) notFound();

  const { business, counts, reviews, qrCodes, notes, logs, logTotal, activity } = detail;
  const status = businessStatus(business);
  const usage = freemiumUsage(business);
  const ai = aiUsage(business);
  const allowed = (Object.keys(BUSINESS_ACTIONS) as BusinessActionKind[]).filter((kind) =>
    canPerform(admin.role, BUSINESS_ACTIONS[kind].permission)
  );

  return (
    <>
      <PageHeader
        title={business.name || "Adsız hesap"}
        description={business.slug ? menuUrl(business.slug).replace(/^https?:\/\//, "") : "Kurulum henüz tamamlanmadı"}
        action={
          <>
            <ButtonLink href="/admin/businesses" variant="ghost" className="px-3">
              Listeye dön
            </ButtonLink>
            {business.slug && status !== "setup" && (
              <a href={menuUrl(business.slug)} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3.5 py-2 font-mono text-[12px] uppercase tracking-wider text-ink transition-colors hover:border-paprika hover:text-paprika">
                Menüyü aç
              </a>
            )}
          </>
        }
      />

      {status === "suspended" && (
        <p role="status" className="mb-6 rounded-xl border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          {formatAdminDate(business.suspended_at)} tarihinden beri askıda.
          {business.suspension_reason ? ` Sahibine gösterilen mesaj: “${business.suspension_reason}”` : ""}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Hesap" />
          <dl className="mt-4 space-y-3">
            <Fact label="E-posta">{business.email || "—"}</Fact>
            <Fact label="Telefon">{business.phone || "—"}</Fact>
            <Fact label="Kayıt">{formatAdminDate(business.created)}</Fact>
            <Fact label="Son güncelleme">{formatAdminDate(business.updated)}</Fact>
            <Fact label="Kimlik">
              <span className="font-mono text-[12px]">{business.id}</span>
            </Fact>
          </dl>
        </Card>

        <Card>
          <SectionHeader title="Plan ve kullanım" />
          <dl className="mt-4 space-y-3">
            <Fact label="Plan">
              <span className="flex flex-wrap items-center gap-2">
                <PlanBadge plan={business.plan} />
                <StatusBadge status={status} />
              </span>
            </Fact>
            <Fact label="Bitiş">
              {business.plan_expires_at
                ? `${formatAdminDay(business.plan_expires_at)}${usage.limited && usage.daysLeft !== null ? ` · ${usage.daysLeft} gün kaldı` : ""}`
                : "Süresiz"}
            </Fact>
            {usage.limited && (
              <Fact label="Menü görüntülenme">
                {usage.menuViews.toLocaleString("tr-TR")}
                {usage.menuViewLimit !== null ? ` / ${usage.menuViewLimit.toLocaleString("tr-TR")}` : ""}
                {usage.exhausted ? " · limit doldu, menü kapalı" : ""}
              </Fact>
            )}
            <Fact label="AI tarama (bu ay)">
              {ai.limit === null ? `${ai.used} · sınırsız` : `${ai.used} / ${ai.limit}`}
            </Fact>
          </dl>
        </Card>

        <Card>
          <SectionHeader title="İçerik" />
          <dl className="mt-4 divide-y divide-line text-sm">
            {[
              ["Ürün", counts.products],
              ["Kategori", counts.categories],
              ["QR kod", counts.qrCodes],
              ["Değerlendirme", counts.reviews],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="font-display text-lg font-bold text-ink">{Number(value).toLocaleString("tr-TR")}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="mt-6">
        <SectionHeader title="İşlemler" description="Her işlem gerekçesiyle denetim kaydına yazılır." />
        <div className="mt-4">
          <BusinessActions
            businessId={business.id}
            allowed={allowed}
            current={{
              plan: normalizePlan(business.plan),
              expiresOn: toDateInputValue(business.plan_expires_at),
              suspended: status === "suspended",
              slug: business.slug,
              email: business.email ?? "",
            }}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <SectionHeader title={`Son ${activity?.days ?? 30} gün`} description="Günlük özetlerden; bugünün verisi gece işlenir." />
        {activity ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ziyaret" value={activity.sessions} />
            <Stat label="Sayfa görüntüleme" value={activity.pageViews} />
            <Stat label="QR tarama" value={activity.qrScans} />
            <Stat label="Ürün görüntüleme" value={activity.productViews} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Analitik özeti şu anda okunamıyor.</p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="İç notlar" description="Müşteri görmez. Notlar silinmez; düzeltme için yeni not ekle." />
          {canPerform(admin.role, "business.note") && (
            <div className="mt-4">
              <BusinessNoteForm businessId={business.id} />
            </div>
          )}
          {notes.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Henüz not yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
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

        <Card>
          <SectionHeader
            title="İşlem geçmişi"
            description="Bu işletmede yönetimden yapılan değişiklikler."
            action={
              logTotal > logs.length && canPerform(admin.role, "logs.view") ? (
                <ButtonLink href={`/admin/logs?hedef=${business.id}`} className="px-3.5 py-2 text-[12px]">
                  Tümü ({logTotal})
                </ButtonLink>
              ) : undefined
            }
          />
          {logs.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Henüz bir işlem yapılmadı.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {logs.map((log) => (
                <li key={log.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{adminLogActionLabel(log.action)}</span>
                    <span className="font-mono text-[11px] text-ink-soft">{formatAdminDate(log.created)}</span>
                  </div>
                  <p className="break-all text-ink-soft">{log.admin_email}</p>
                  {adminLogChangeLines(log).map((line) => (
                    <p key={line} className="break-all font-mono text-[12px] text-ink">
                      {line}
                    </p>
                  ))}
                  {log.reason && <p className="mt-1 text-ink-soft">Gerekçe: {log.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="QR kodlar" />
          {qrCodes.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Etiketli QR kodu yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {qrCodes.map((qr) => (
                <li key={qr.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <span className="text-ink">{qr.name || qr.code}</span>
                  <span className="font-mono text-[11px] text-ink-soft">
                    {qr.code}
                    {qr.is_active ? "" : " · kapalı"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader title="Son değerlendirmeler" />
          {reviews.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Henüz değerlendirme yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {reviews.map((review) => (
                <li key={review.id} className="py-2.5">
                  <p className="font-mono text-[11px] text-ink-soft">
                    Memnuniyet {review.satisfaction}/5 · Hijyen {review.hygiene}/5 · Tekrar {review.revisit}/5 ·{" "}
                    {formatAdminDay(review.created)}
                  </p>
                  {review.comment && <p className="mt-1 text-ink">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
