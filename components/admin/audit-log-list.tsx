import Link from "next/link";
import {
  AUDIT_ACTOR_LABELS,
  auditActionLabel,
  auditActorEmail,
  auditActorType,
  auditBusinessId,
  auditChanges,
  auditFieldLabel,
  auditResourceLabel,
  isAttentionAction,
  showAuditValue,
} from "@/lib/audit-log";
import { formatAdminDate } from "@/lib/admin-format";
import type { AuditActorType, AuditLog } from "@/lib/types";

// Denetim kaydı satırları — genel kayıt ekranı ve işletme detayı aynı
// bileşeni kullanır. Her satır "kim → ne → hangi işletmede → hangi kayıtta →
// ne zaman" sorusunu tek bakışta cevaplar; önce/sonra ve istek bilgisi
// satır açılınca görünür (sunucu bileşeni, istemci JS'i yok: <details>).

const ACTOR_TONE: Record<AuditActorType, string> = {
  admin: "border-paprika/30 bg-paprika/10 text-paprika",
  business: "border-herb/30 bg-herb/10 text-herb",
  system: "border-line bg-crema text-ink-soft",
  superuser: "border-ink/30 bg-ink/10 text-ink",
};

/** Ayrıntıda gösterilen istek/işlem bilgileri (meta). Listede olmayan anahtar
 *  ham adıyla görünür; ayrıca gösterilenler (ad, tarayıcı…) burada yok. */
const META_LABELS: Record<string, string> = {
  model: "Model",
  input_tokens: "Girdi token",
  output_tokens: "Çıktı token",
  pages: "Sayfa",
  categories: "Kategori",
  products: "Ürün",
  items: "Öğe",
  locales: "Diller",
  query: "Arama",
  results: "Sonuç",
  email: "E-posta",
  business_name: "İşletme",
  auth_method: "Giriş yöntemi",
  method: "HTTP",
  source: "Kaynak",
  key: "Ayar",
};
const META_HIDDEN = new Set(["label", "user_agent", "cascaded"]);
/** Kaydı hangi katmanın yazdığı: uygulama sunucusu mu, veritabanı hook'u mu. */
const SOURCE_LABELS: Record<string, string> = { next: "Uygulama sunucusu", pocketbase: "Veritabanı (hook)" };

const BADGE = "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider";

function ValueCell({ value }: { value: unknown }) {
  const text = showAuditValue(value);
  return <span className={`break-all ${text === "boş" ? "text-ink-soft" : "text-ink"}`}>{text}</span>;
}

export interface AuditLogListProps {
  logs: AuditLog[];
  /** İşletme kimliği → adı (satırda bağlantılı gösterilir). */
  businessNames?: Record<string, string>;
  /** İşletme detayında işletme adı tekrar yazılmaz. */
  hideBusiness?: boolean;
  /** Aynı filtrelerle bağlantı üretmek için (ör. yapana tıklayınca). */
  filterHref?: (patch: { actor?: string; business?: string; action?: string }) => string;
}

export function AuditLogList({ logs, businessNames = {}, hideBusiness, filterHref }: AuditLogListProps) {
  return (
    <ul className="divide-y divide-line">
      {logs.map((log) => {
        const actorType = auditActorType(log);
        const actor = auditActorEmail(log);
        const businessId = auditBusinessId(log);
        const businessName = businessNames[businessId];
        const changes = auditChanges(log);
        const meta = (log.meta ?? {}) as Record<string, unknown>;
        const label = typeof meta.label === "string" ? meta.label : "";
        const agent = typeof meta.user_agent === "string" ? meta.user_agent : "";
        const cascaded = meta.cascaded && typeof meta.cascaded === "object" ? (meta.cascaded as Record<string, number>) : null;
        const isSnapshot = !log.before || !log.after;
        const extra = Object.entries(meta).filter(([key, value]) => !META_HIDDEN.has(key) && value !== "" && value !== null && value !== undefined);

        return (
          <li key={log.id} className="py-3.5 text-sm first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`${BADGE} ${ACTOR_TONE[actorType]}`}>{AUDIT_ACTOR_LABELS[actorType]}</span>
                <span className={`font-semibold ${isAttentionAction(log.action) ? "text-paprika" : "text-ink"}`}>
                  {auditActionLabel(log.action)}
                </span>
                {label && <span className="min-w-0 break-all text-ink">“{label}”</span>}
              </p>
              <p className="font-mono text-[11px] text-ink-soft">{formatAdminDate(log.created)}</p>
            </div>

            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-soft">
              {actor &&
                (filterHref ? (
                  <Link href={filterHref({ actor })} className="break-all hover:text-paprika">
                    {actor}
                  </Link>
                ) : (
                  <span className="break-all">{actor}</span>
                ))}
              {!hideBusiness && businessId && (
                <Link href={`/admin/businesses/${businessId}`} className="break-all hover:text-paprika">
                  {businessName || businessId}
                </Link>
              )}
              {log.target_collection && (
                <span className="font-mono text-[11px]">
                  {auditResourceLabel(log.target_collection)}
                  {log.target_id ? ` · ${log.target_id}` : ""}
                </span>
              )}
            </p>

            {log.reason && <p className="mt-1 text-ink-soft">Gerekçe: {log.reason}</p>}

            {(changes.length > 0 || log.ip || agent || cascaded || extra.length > 0) && (
              <details className="group mt-2">
                <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-paprika">
                  {changes.length > 0 ? `${isSnapshot ? "Kayıt" : "Değişiklik"} (${changes.length} alan)` : "Ayrıntı"}
                </summary>
                {changes.length > 0 && (
                  <div className="mt-2 overflow-x-auto rounded-md border border-line">
                    <table className="w-full min-w-[420px] text-left text-[12px]">
                      <thead className="bg-crema/60 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                        <tr>
                          <th className="px-3 py-2 font-medium">Alan</th>
                          {log.before && <th className="px-3 py-2 font-medium">Önce</th>}
                          {log.after && <th className="px-3 py-2 font-medium">Sonra</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-mono">
                        {changes.map((change) => (
                          <tr key={change.field} className="align-top">
                            <td className="whitespace-nowrap px-3 py-1.5 text-ink-soft">{auditFieldLabel(change.field)}</td>
                            {log.before && (
                              <td className="px-3 py-1.5">
                                <ValueCell value={change.before} />
                              </td>
                            )}
                            {log.after && (
                              <td className="px-3 py-1.5">
                                <ValueCell value={change.after} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <dl className="mt-2 grid gap-x-4 gap-y-1 font-mono text-[11px] text-ink-soft sm:grid-cols-[auto_1fr]">
                  {cascaded &&
                    Object.entries(cascaded).map(([collection, count]) => (
                      <div key={collection} className="contents">
                        <dt>Birlikte silinen</dt>
                        <dd className="text-ink">
                          {count} {auditResourceLabel(collection).toLocaleLowerCase("tr-TR")}
                        </dd>
                      </div>
                    ))}
                  {extra.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt>{META_LABELS[key] ?? key}</dt>
                      <dd className="break-all text-ink">{key === "source" ? SOURCE_LABELS[String(value)] ?? String(value) : showAuditValue(value)}</dd>
                    </div>
                  ))}
                  {log.ip && (
                    <div className="contents">
                      <dt>IP</dt>
                      <dd className="break-all text-ink">{log.ip}</dd>
                    </div>
                  )}
                  {agent && (
                    <div className="contents">
                      <dt>Tarayıcı</dt>
                      <dd className="break-all text-ink">{agent}</dd>
                    </div>
                  )}
                  <div className="contents">
                    <dt>İşlem</dt>
                    <dd className="break-all text-ink">
                      {filterHref ? (
                        <Link href={filterHref({ action: log.action })} className="hover:text-paprika">
                          {log.action}
                        </Link>
                      ) : (
                        log.action
                      )}
                    </dd>
                  </div>
                </dl>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
