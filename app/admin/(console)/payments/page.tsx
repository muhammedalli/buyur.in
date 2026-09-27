import { ButtonLink } from "@/components/admin/button-link";
import { NewPaymentButton, PaymentsTable, type PaymentBusinessOption } from "@/components/admin/payments";
import { Button, EmptyState, Input, Label, PageHeader, Select, StatGroup } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { loadBusinessRows } from "@/lib/admin-businesses";
import { loadPayments, toPaymentRow } from "@/lib/admin-payments";
import { canPerform } from "@/lib/admin-roles";
import {
  PAYMENTS_PAGE_SIZE,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  filterPayments,
  formatAmount,
  isFilteredQuery,
  parsePaymentQuery,
  paymentListHref,
  paymentsOverview,
  summarizePayments,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

// Ödemeler: işletmelerden alınan ve işletmelere yapılan bütün para
// hareketleri. Üstte genel özet (filtreden bağımsız), altında filtrelenebilir
// kayıt listesi. Filtreler adres çubuğunda durur (GET formu): bağlantı
// paylaşılabilir. Hesap kuralları lib/payments.ts'te, docs/payments.md'de.

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb, admin }, params] = await Promise.all([requireAdmin({ action: "payments.view" }), searchParams]);
  const [payments, businessRows] = await Promise.all([loadPayments(pb), loadBusinessRows()]);
  const canEdit = canPerform(admin.role, "payments.edit");
  const query = parsePaymentQuery(params);
  const filtered = isFilteredQuery(query);

  const businesses: PaymentBusinessOption[] = businessRows
    .filter((row) => !row.deleted_at?.trim())
    .map((row) => ({ id: row.id, name: row.name || row.slug || row.email || "Adsız hesap" }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const header = (
    <PageHeader
      title="Ödemeler"
      description="İşletmelerden alınan ve işletmelere yapılan bütün para hareketleri. Kalan borç her zaman kayıtlardan hesaplanır."
      action={canEdit ? <NewPaymentButton businesses={businesses} /> : undefined}
    />
  );

  if (!payments) {
    return (
      <>
        {header}
        <p role="status" className="rounded-md border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          Ödeme kayıtları şu anda okunamıyor. Bağlantıyı kontrol edip sayfayı yenileyin; sorun sürerse ödeme koleksiyonunun
          kurulduğundan emin olun (scripts/migrate-payments.mjs).
        </p>
      </>
    );
  }

  const overview = paymentsOverview(payments);
  const matching = filterPayments(payments, query);
  const matchingSummary = summarizePayments(matching);
  const totalPages = Math.max(1, Math.ceil(matching.length / PAYMENTS_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const rows = matching.slice((page - 1) * PAYMENTS_PAGE_SIZE, page * PAYMENTS_PAGE_SIZE).map(toPaymentRow);

  return (
    <>
      {header}

      <StatGroup
        items={[
          { label: "Toplam alınan", value: formatAmount(overview.totalReceived) },
          { label: "Toplam verilen", value: formatAmount(overview.totalPaidOut) },
          { label: "Toplam bekleyen", value: formatAmount(overview.totalPending), hint: "Tahsil edilmeyi bekleyen" },
          {
            label: "Toplam borç",
            value: formatAmount(overview.totalOutstanding),
            hint: overview.debtorCount > 0 ? `${overview.debtorCount.toLocaleString("tr-TR")} işletmenin kalan borcu` : "Borcu kalan işletme yok",
          },
          { label: "Bu ay alınan", value: formatAmount(overview.monthReceived) },
          { label: "Bu ay verilen", value: formatAmount(overview.monthPaidOut) },
        ]}
        columns={3}
        size="sm"
        className="grid-cols-1 min-[360px]:grid-cols-2"
      />

      {/* Sade GET formu: filtreler adres çubuğunda durur, bağlantı paylaşılabilir. */}
      <form method="get" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Label htmlFor="filter-business">İşletme</Label>
          <Select id="filter-business" name="business" defaultValue={query.business}>
            <option value="">Tüm işletmeler</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-type">İşlem tipi</Label>
          <Select id="filter-type" name="type" defaultValue={query.type}>
            <option value="">Tümü</option>
            {PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PAYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-status">Durum</Label>
          <Select id="filter-status" name="status" defaultValue={query.status}>
            <option value="">Tümü</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-from">Başlangıç</Label>
          <Input id="filter-from" type="date" name="from" defaultValue={query.from} />
        </div>
        <div>
          <Label htmlFor="filter-to">Bitiş</Label>
          <Input id="filter-to" type="date" name="to" defaultValue={query.to} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
          <Button type="submit" className="flex-1 sm:flex-none">
            Filtrele
          </Button>
          {filtered && (
            <ButtonLink href="/admin/payments" variant="ghost">
              Temizle
            </ButtonLink>
          )}
        </div>
      </form>

      <div className="mt-6">
        {filtered && matching.length > 0 && (
          <p className="mb-3 text-sm text-ink-soft">
            {matching.length.toLocaleString("tr-TR")} kayıt · alınan {formatAmount(matchingSummary.totalReceived)} · verilen{" "}
            {formatAmount(matchingSummary.totalPaidOut)}
            {matchingSummary.totalDebt > 0 ? ` · borç ${formatAmount(matchingSummary.totalDebt)}` : ""}
            {matchingSummary.pendingIncoming + matchingSummary.pendingOutgoing + matchingSummary.pendingDebt > 0
              ? ` · bekleyen ${formatAmount(matchingSummary.pendingIncoming + matchingSummary.pendingOutgoing + matchingSummary.pendingDebt)}`
              : ""}
          </p>
        )}
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Eşleşen kayıt yok" : "Henüz ödeme kaydı yok"}
            description={
              filtered
                ? "Filtreleri değiştirmeyi deneyin."
                : "İlk kaydı “Yeni ödeme” ile ekleyin: borç kaydı, alınan ya da verilen ödeme."
            }
          />
        ) : (
          <PaymentsTable rows={rows} businesses={businesses} showBusiness canEdit={canEdit} />
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Sayfalar" className="mt-6 flex items-center justify-between gap-3">
          {page > 1 ? <ButtonLink href={paymentListHref(query, { page: page - 1 })}>Önceki</ButtonLink> : <span />}
          <span className="text-xs font-medium text-ink-soft">
            {page} / {totalPages}
          </span>
          {page < totalPages ? <ButtonLink href={paymentListHref(query, { page: page + 1 })}>Sonraki</ButtonLink> : <span />}
        </nav>
      )}
    </>
  );
}
