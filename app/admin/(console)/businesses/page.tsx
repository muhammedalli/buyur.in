import Link from "next/link";
import { ButtonLink } from "@/components/admin/button-link";
import { StatusBadge, PlanBadge } from "@/components/admin/badges";
import { Button, EmptyState, Input, PageHeader, Select, Table } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import {
  BUSINESS_SORT_LABELS,
  BUSINESS_STATUS_LABELS,
  businessListHref,
  businessStatus,
  parseBusinessListQuery,
  queryBusinesses,
} from "@/lib/admin-business-list";
import { loadBusinessRows } from "@/lib/admin-businesses";
import { formatAdminDay } from "@/lib/admin-format";
import { PLAN_LABELS, PLAN_ORDER } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [, params, rows] = await Promise.all([requireAdmin({ action: "business.view" }), searchParams, loadBusinessRows()]);
  const query = parseBusinessListQuery(params);
  const result = queryBusinesses(rows, query);
  const filtered = Boolean(query.q || query.plan || query.status);

  return (
    <>
      <PageHeader
        title="İşletmeler"
        description={`${rows.length.toLocaleString("tr-TR")} hesap${filtered ? ` · filtreyle ${result.total.toLocaleString("tr-TR")}` : ""}. Her işletme bir hesaptır; giriş, plan ve erişim işlemleri işletmenin sayfasındadır.`}
      />

      {/* Sade GET formu: filtreler adres çubuğunda durur, bağlantı paylaşılabilir. */}
      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_11rem_11rem_auto]">
        <Input name="q" defaultValue={query.q} placeholder="Ad, menü adresi ya da e-posta" aria-label="Ara" className="sm:col-span-2 lg:col-span-1" />
        <Select name="plan" defaultValue={query.plan} aria-label="Plan">
          <option value="">Tüm planlar</option>
          {PLAN_ORDER.map((plan) => (
            <option key={plan} value={plan}>
              {PLAN_LABELS[plan]}
            </option>
          ))}
        </Select>
        <Select name="durum" defaultValue={query.status} aria-label="Durum">
          <option value="">Tüm durumlar</option>
          {Object.entries(BUSINESS_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="sirala" defaultValue={query.sort} aria-label="Sıralama">
          {Object.entries(BUSINESS_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Filtrele
          </Button>
          {filtered && (
            <ButtonLink href="/admin/businesses" variant="ghost">
              Temizle
            </ButtonLink>
          )}
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title={filtered ? "Eşleşen işletme yok" : "Henüz işletme yok"}
          description={filtered ? "Aramayı ya da filtreleri değiştirmeyi dene." : "İlk kayıt geldiğinde burada görünecek."}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>İşletme</th>
              <th>Plan</th>
              <th>Durum</th>
              <th className="hidden md:table-cell">Plan bitişi</th>
              <th className="hidden md:table-cell">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr key={row.id}>
                <td className="max-w-[18rem]">
                  <Link href={`/admin/businesses/${row.id}`} className="block truncate font-semibold text-ink hover:text-paprika">
                    {row.name || "Adsız hesap"}
                  </Link>
                  <p className="truncate text-[13px] text-ink-soft">
                    {row.slug ? `${row.slug} · ` : ""}
                    {row.email}
                  </p>
                </td>
                <td>
                  <PlanBadge plan={row.plan} />
                </td>
                <td>
                  <StatusBadge status={businessStatus(row)} />
                </td>
                <td className="hidden whitespace-nowrap font-mono text-[12px] text-ink-soft md:table-cell">
                  {row.plan_expires_at ? formatAdminDay(row.plan_expires_at) : "Süresiz"}
                </td>
                <td className="hidden whitespace-nowrap font-mono text-[12px] text-ink-soft md:table-cell">{formatAdminDay(row.created)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Sayfalar" className="mt-6 flex items-center justify-between gap-3">
          {result.page > 1 ? <ButtonLink href={businessListHref(query, { page: result.page - 1 })}>Önceki</ButtonLink> : <span />}
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <ButtonLink href={businessListHref(query, { page: result.page + 1 })}>Sonraki</ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
