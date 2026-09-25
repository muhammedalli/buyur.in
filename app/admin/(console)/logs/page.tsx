import { ButtonLink } from "@/components/admin/button-link";
import { Card, EmptyState, PageHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_LOG_COLLECTION, adminLogActionLabel } from "@/lib/admin-audit";
import { formatAdminDate } from "@/lib/admin-format";
import type { AdminLog } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

function pageFrom(value: string | undefined): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** Değişen alanların kısa özeti: "plan: freemium → premium". */
function changeSummary(log: AdminLog): string[] {
  const before = log.before ?? {};
  const after = log.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const show = (value: unknown) => (value === null || value === undefined || value === "" ? "boş" : String(value));
  return keys.map((key) => `${key}: ${show(before[key])} → ${show(after[key])}`);
}

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb }, params] = await Promise.all([requireAdmin({ action: "logs.view" }), searchParams]);
  const page = pageFrom(params.sayfa);

  // Hata sayfa sınırına (app/admin/error.tsx) gider: kayıt okunamıyorsa boş
  // liste göstermek "hiç işlem yok" diye yanlış okunurdu.
  const result = await pb.collection(ADMIN_LOG_COLLECTION).getList<AdminLog>(page, PER_PAGE, {
    sort: "-created",
    requestKey: null,
  });

  return (
    <>
      <PageHeader
        title="Denetim kaydı"
        description="Yönetim panelinde yapılan her işlem burada. Kayıtlar değiştirilemez ve silinemez."
      />

      {result.items.length === 0 ? (
        <EmptyState title="Henüz kayıt yok" description="Yöneticiler giriş yaptıkça ve işlem yaptıkça burada görünecek." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {result.items.map((log) => {
              const changes = changeSummary(log);
              return (
                <li key={log.id} className="py-4 text-sm first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0">
                      <span className="font-semibold text-ink">{adminLogActionLabel(log.action)}</span>
                      <span className="text-ink-soft"> · </span>
                      <span className="break-all text-ink-soft">{log.admin_email}</span>
                    </p>
                    <p className="font-mono text-[11px] text-ink-soft">
                      {formatAdminDate(log.created)}
                      {log.ip ? ` · ${log.ip}` : ""}
                    </p>
                  </div>
                  {log.target_collection && (
                    <p className="mt-1 break-all font-mono text-[11px] text-ink-soft">
                      {log.target_collection}
                      {log.target_id ? ` / ${log.target_id}` : ""}
                    </p>
                  )}
                  {changes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 font-mono text-[12px] text-ink">
                      {changes.map((line) => (
                        <li key={line} className="break-all">
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                  {log.reason && <p className="mt-2 text-ink-soft">Gerekçe: {log.reason}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Sayfalar" className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? (
            <ButtonLink href={`/admin/logs?sayfa=${page - 1}`}>
              Önceki
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {page} / {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <ButtonLink href={`/admin/logs?sayfa=${page + 1}`}>
              Sonraki
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
