import Link from "next/link";
import { ButtonLink } from "@/components/admin/button-link";
import { StatusBadge, PlanBadge } from "@/components/admin/badges";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/panel/ui";
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
        description={`${rows.length.toLocaleString("tr-TR")} hesap${filtered ? ` · filtreyle ${result.total.toLocaleString("tr-TR")}` : ""}`}
      />

      {/* Sade GET formu: filtreler adres çubuğunda durur, bağlantı paylaşılabilir. */}
      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <Input name="q" defaultValue={query.q} placeholder="Ad, menü adresi ya da e-posta" aria-label="Ara" />
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
            <ButtonLink href="/admin/businesses" variant="ghost" className="px-3">
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
        <Card className="overflow-hidden">
          {/* Satırlar kartın kenarına kadar tıklanabilir olsun diye kart boşluğu geri alınır. */}
          <ul className="-mx-6 -my-6 divide-y divide-line">
            {result.items.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/businesses/${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-crema/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{row.name || "Adsız hesap"}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {row.slug ? `${row.slug} · ` : ""}
                      {row.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlanBadge plan={row.plan} />
                    <StatusBadge status={businessStatus(row)} />
                    <span className="w-full text-right font-mono text-[11px] text-ink-soft sm:w-auto">
                      {row.plan_expires_at ? `Bitiş ${formatAdminDay(row.plan_expires_at)} · ` : ""}
                      Kayıt {formatAdminDay(row.created)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
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
