import { AuditLogList } from "@/components/admin/audit-log-list";
import { ButtonLink } from "@/components/admin/button-link";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { loadAuditPage, loadBusinessNames, resolveBusinessIds } from "@/lib/admin-logs";
import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTOR_LABELS,
  AUDIT_ACTOR_TYPES,
  AUDIT_RESOURCE_LABELS,
  auditLogHref,
  hasAuditFilters,
  parseAuditLogQuery,
} from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// Merkezi denetim kaydı: yönetici, işletme, sistem ve veritabanı yöneticisi
// işlemleri tek listede. Filtreler adres çubuğunda durur (sade GET formu):
// bağlantı paylaşılabilir, işletme detayındaki "tüm geçmiş" buraya
// işletme filtresiyle gelir.

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ pb }, params] = await Promise.all([requireAdmin({ action: "logs.view" }), searchParams]);
  const parsed = parseAuditLogQuery(params);
  const businessIds = await resolveBusinessIds(pb, parsed.business);
  const query = { ...parsed, businessIds };

  // Hata sayfa sınırına (app/admin/error.tsx) gider: kayıt okunamıyorsa boş
  // liste göstermek "hiç işlem yok" diye yanlış okunurdu.
  const result = await loadAuditPage(pb, query);
  const names = await loadBusinessNames(pb, result.items);
  const filtered = hasAuditFilters(parsed);
  const href = (patch: Parameters<typeof auditLogHref>[1]) => auditLogHref(parsed, { page: 1, ...patch });

  const actionsByGroup = AUDIT_ACTION_GROUPS.map((group) => ({
    ...group,
    actions: Object.keys(AUDIT_ACTION_LABELS).filter((action) =>
      group.prefix === "plan" ? action.startsWith("plan.") || action.startsWith("plans.") : action.startsWith(group.prefix)
    ),
  }));

  return (
    <>
      <PageHeader
        title="Denetim kaydı"
        description={
          parsed.target
            ? `Yalnızca ${parsed.target} kaydıyla ilgili işlemler.`
            : "Sistemde kim, ne zaman, neyi değiştirdi. Kayıtlar değiştirilemez ve silinemez."
        }
      />

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          name="q"
          defaultValue={parsed.q}
          placeholder="Ara: ürün adı, e-posta, gerekçe, kimlik…"
          aria-label="Ara"
          className="sm:col-span-2"
        />
        <Input name="isletme" defaultValue={parsed.business} placeholder="İşletme: ad, menü adresi ya da kimlik" aria-label="İşletme" />
        <Input name="kullanici" defaultValue={parsed.actor} placeholder="Yapan: e-posta ya da kimlik" aria-label="Yapan" />
        <Select name="aktor" defaultValue={parsed.actorType} aria-label="Yapan türü">
          <option value="">Tüm yapanlar</option>
          {AUDIT_ACTOR_TYPES.map((type) => (
            <option key={type} value={type}>
              {AUDIT_ACTOR_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select name="islem" defaultValue={parsed.action} aria-label="İşlem tipi">
          <option value="">Tüm işlemler</option>
          {actionsByGroup.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((action) => (
                <option key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action]}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Select name="kaynak" defaultValue={parsed.resource} aria-label="Kaynak">
          <option value="">Tüm kaynaklar</option>
          {Object.entries(AUDIT_RESOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" name="baslangic" defaultValue={parsed.from} aria-label="Başlangıç tarihi" title="Başlangıç" />
          <Input type="date" name="bitis" defaultValue={parsed.to} aria-label="Bitiş tarihi" title="Bitiş" />
        </div>
        {parsed.target && <input type="hidden" name="hedef" value={parsed.target} />}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          <Button type="submit" className="flex-1 lg:flex-none">
            Filtrele
          </Button>
          {filtered && (
            <ButtonLink href="/admin/logs" variant="ghost">
              Temizle
            </ButtonLink>
          )}
        </div>
      </form>

      {parsed.business && businessIds.length === 0 && (
        <p role="status" className="mb-4 rounded-md border border-paprika/30 bg-paprika/10 px-4 py-3 text-sm text-paprika">
          “{parsed.business}” ile eşleşen işletme bulunamadı.
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState
          title={filtered ? "Eşleşen kayıt yok" : "Henüz kayıt yok"}
          description={filtered ? "Filtreleri genişletmeyi dene." : "İşlem yapıldıkça burada görünecek."}
        />
      ) : (
        <>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {result.totalItems.toLocaleString("tr-TR")} kayıt
          </p>
          <Card>
            <AuditLogList
              logs={result.items}
              businessNames={names}
              filterHref={({ actor, action }) => href({ ...(actor ? { actor } : {}), ...(action ? { action } : {}) })}
            />
          </Card>
        </>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Sayfalar" className="mt-6 flex items-center justify-between gap-3">
          {result.page > 1 ? <ButtonLink href={auditLogHref(parsed, { page: result.page - 1 })}>Önceki</ButtonLink> : <span />}
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <ButtonLink href={auditLogHref(parsed, { page: result.page + 1 })}>Sonraki</ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
