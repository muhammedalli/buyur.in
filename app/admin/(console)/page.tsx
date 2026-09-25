import { ButtonLink } from "@/components/admin/button-link";
import { AdminPasswordForm } from "@/components/admin/password-form";
import { Card, PageHeader, SectionHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_LOG_COLLECTION, adminLogActionLabel } from "@/lib/admin-audit";
import { ADMIN_ROLE_LABELS, canPerform } from "@/lib/admin-roles";
import { formatAdminDate } from "@/lib/admin-format";
import type { AdminLog } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb, admin }, params] = await Promise.all([requireAdmin(), searchParams]);
  const canViewLogs = canPerform(admin.role, "logs.view");

  // Kendi son işlemleri: tanımadığı bir giriş görürse hemen fark etsin.
  const recent = canViewLogs
    ? await pb
        .collection(ADMIN_LOG_COLLECTION)
        .getList<AdminLog>(1, 5, {
          filter: pb.filter("admin = {:id}", { id: admin.id }),
          sort: "-created",
          requestKey: null,
        })
        .then((res) => res.items)
        .catch(() => null)
    : null;

  const firstName = admin.name?.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hoş geldin, ${firstName}` : "Hoş geldin"}
        description="buyur platformunun yönetim alanı."
      />

      {params.yetkisiz === "1" && (
        <p role="alert" className="mb-6 rounded-xl border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          Açmaya çalıştığın sayfa için yetkin yok. Gerekiyorsa bir süper yöneticiden iste.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
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
              ? "Planları, fiyatları ve yönetici hesaplarını değiştirebilirsin. Yaptığın her değişiklik denetim kaydına düşer."
              : "İşletmelere destek verebilir, deneme süresini uzatabilir ve AI kotasını sıfırlayabilirsin. Plan ve fiyat kararları süper yöneticidedir."}
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
