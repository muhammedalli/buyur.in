import { BUSINESS_STATUS_LABELS, type BusinessStatus } from "@/lib/admin-business-list";
import { PLAN_LABELS, normalizePlan } from "@/lib/entitlements";

// Yönetim ekranlarında işletme durumu ve planı için küçük etiketler. Renk
// anlamı: herb = yayında, paprika = dikkat (askıda), nötr = diğerleri.

const BADGE = "inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider";

const STATUS_TONE: Record<BusinessStatus, string> = {
  live: "border-herb/30 bg-herb/10 text-herb",
  setup: "border-line bg-crema text-ink-soft",
  offline: "border-line bg-paper text-ink-soft",
  suspended: "border-paprika/40 bg-paprika/10 text-paprika",
  deleted: "border-ink/30 bg-ink/10 text-ink",
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return <span className={`${BADGE} ${STATUS_TONE[status]}`}>{BUSINESS_STATUS_LABELS[status]}</span>;
}

export function PlanBadge({ plan }: { plan: string | undefined }) {
  return <span className={`${BADGE} border-line bg-paper text-ink`}>{PLAN_LABELS[normalizePlan(plan)]}</span>;
}
