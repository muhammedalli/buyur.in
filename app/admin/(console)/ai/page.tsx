import Link from "next/link";
import { PlanBadge } from "@/components/admin/badges";
import { ButtonLink } from "@/components/admin/button-link";
import { EmptyState, PageHeader, SectionHeader, StatGroup, Table } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { businessStatus } from "@/lib/admin-business-list";
import { loadBusinessRows } from "@/lib/admin-businesses";
import { AUDIT_LOG_COLLECTION } from "@/lib/audit-log";
import { aiUsage } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

// Yapay zekâ kullanımı: bu ayki tarama kotaları (işletme kaydındaki sayaç) ve
// son 30 günün işlem/token toplamı (denetim kaydı). Tek tek işlemler denetim
// kaydında "AI" filtresiyle görülür; kota sıfırlama işletme detayındadır.

const WINDOW_DAYS = 30;
/** Token toplamı için okunacak en fazla kayıt; üstünde toplam "en az" olarak okunur. */
const TOKEN_SAMPLE = 1000;

const count = (n: number) => n.toLocaleString("tr-TR");

export default async function AdminAiPage() {
  const { pb } = await requireAdmin({ action: "ai.view" });
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sinceFilter = pb.filter("created >= {:since}", { since });

  const [rows, translations, tokenRows] = await Promise.all([
    getServicePB().then(async (service) => {
      await ensurePlanCatalog(service);
      return loadBusinessRows();
    }),
    pb
      .collection(AUDIT_LOG_COLLECTION)
      .getList(1, 1, { filter: `action = "ai.translate" && ${sinceFilter}`, fields: "id", requestKey: null })
      .then((res) => res.totalItems)
      .catch(() => null),
    pb
      .collection(AUDIT_LOG_COLLECTION)
      .getList<AuditLog>(1, TOKEN_SAMPLE, {
        filter: `(action = "ai.menu_scan" || action = "ai.translate") && ${sinceFilter}`,
        fields: "meta",
        requestKey: null,
      })
      .catch(() => null),
  ]);

  const tokens = (tokenRows?.items ?? []).reduce((sum, row) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    return sum + (Number(meta.input_tokens) || 0) + (Number(meta.output_tokens) || 0);
  }, 0);
  const partial = tokenRows ? tokenRows.totalItems > tokenRows.items.length : false;

  const usage = rows
    .filter((row) => businessStatus(row) !== "deleted")
    .map((row) => ({ row, ai: aiUsage(row) }))
    .filter(({ ai }) => ai.used > 0)
    .sort((a, b) => b.ai.used - a.ai.used);
  const scansThisMonth = usage.reduce((sum, { ai }) => sum + ai.used, 0);
  const exhausted = usage.filter(({ ai }) => ai.exhausted).length;

  return (
    <>
      <PageHeader
        title="Yapay zekâ"
        description="Menü tarama kotaları ve AI maliyetinin özeti. Her işlem denetim kaydında model ve token bilgisiyle durur."
        action={
          <ButtonLink href="/admin/logs?kaynak=ai" size="sm">
            AI kayıtları
          </ButtonLink>
        }
      />

      <StatGroup
        items={[
          { label: "Bu ay menü taraması", value: count(scansThisMonth), hint: `${count(usage.length)} işletme` },
          { label: "Kotası dolan", value: count(exhausted), hint: "Bu ay" },
          { label: `Çeviri · ${WINDOW_DAYS} gün`, value: translations === null ? "—" : count(translations) },
          {
            label: `Token · ${WINDOW_DAYS} gün`,
            value: tokenRows ? count(tokens) : "—",
            hint: partial ? `İlk ${count(TOKEN_SAMPLE)} işlemden` : "Girdi + çıktı",
          },
        ]}
      />

      <section className="mt-10">
        <SectionHeader title="Bu ayki tarama kullanımı" description="Sayaç işletme kaydında; ay değişince sıfırdan sayılır." />
        {usage.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Bu ay henüz tarama yok" description="İşletmeler menü taradıkça burada kotalarıyla görünür." />
          </div>
        ) : (
          <Table className="mt-4">
            <thead>
              <tr>
                <th>İşletme</th>
                <th>Plan</th>
                <th className="text-right">Tarama / hak</th>
              </tr>
            </thead>
            <tbody>
              {usage.slice(0, 50).map(({ row, ai }) => (
                <tr key={row.id}>
                  <td className="max-w-[18rem]">
                    <Link href={`/admin/businesses/${row.id}`} className="block truncate font-semibold text-ink hover:text-paprika">
                      {row.name || row.slug || "Adsız hesap"}
                    </Link>
                  </td>
                  <td>
                    <PlanBadge plan={row.plan} />
                  </td>
                  <td className={`whitespace-nowrap text-right font-mono tabular-nums ${ai.exhausted ? "text-paprika-deep" : "text-ink"}`}>
                    {ai.limit === null ? `${ai.used} · sınırsız` : `${ai.used} / ${ai.limit}`}
                    {ai.exhausted && <span className="ml-2 font-body text-[12px]">doldu</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}
