import type { Business, Plan } from "@/lib/types";

// Abonelik kurallarının OKUMA KAPISI.
//
// Panel, genel menü, analytics API'si, rapor üretimi ve pazarlama sitesi —
// hepsi buradan okur. Plan kontrolü hiçbir yerde elle yazılmaz; böylece
// "landing'de yazan ile panelde uygulanan" ayrışamaz.
//
// KAYNAK `buyur_plans` koleksiyonudur: özellikler, süre, görüntülenme ve AI
// kotası orada tutulur ve admin panelinden değişir (bkz. applyPlanRecords,
// lib/plan-catalog-loader.ts). Aşağıdaki DEFAULT_PLAN_ENTITLEMENTS yalnızca
// YEDEKTİR: kayıt okunamadığında ya da bir alan eksik olduğunda devreye girer,
// böylece geçici bir ağ hatası ödeme yapan işletmeyi kilitlemez.
//
// Buyur'da tek ilişki geçerlidir: bir kullanıcı → bir işletme. Ekip/rol yok,
// dolayısıyla yetki yalnızca plana bağlıdır.

export const PLAN_ORDER: Plan[] = ["freemium", "premium", "elite"];

export const PLAN_LABELS: Record<Plan, string> = {
  freemium: "Freemium",
  premium: "Premium",
  elite: "Elite",
};

/** Kilitlenebilir yetenekler. Yeni özellik eklenince tek yer burası. */
export type Feature =
  | "menu"
  | "basic_analytics"
  | "advanced_analytics"
  | "insights"
  | "campaigns"
  | "branding_removal"
  | "website"
  | "advanced_reports"
  | "report_export"
  | "ai_menu_import"
  | "ai_translation";

export interface PlanEntitlements {
  features: Record<Feature, boolean>;
  /** Freemium'a özgü kullanım limitleri; ücretli planlarda null (sınırsız). */
  limits: {
    /** Süre limiti (ay). null = süresiz. */
    durationMonths: number | null;
    /** Menü görüntülenme limiti. null = sınırsız. */
    menuViews: number | null;
    /** Ham event saklama süresi (gün). */
    retentionDays: number;
    /** Ay başına AI menü tarama hakkı. null = sınırsız.
     *  Bir "tarama" = kullanıcının yüklediği sayfa kümesinin tek seferde
     *  modele gönderilmesi; sayfa sayısı değil istek sayısı sayılır. */
    aiScansPerMonth: number | null;
    /** Tek taramada gönderilebilecek en fazla sayfa (fotoğraf/PDF sayfası). */
    aiPagesPerScan: number;
  };
}

const NONE: Record<Feature, boolean> = {
  menu: false,
  basic_analytics: false,
  advanced_analytics: false,
  insights: false,
  campaigns: false,
  branding_removal: false,
  website: false,
  advanced_reports: false,
  report_export: false,
  ai_menu_import: false,
  ai_translation: false,
};

/** YEDEK ÖZELLİK MATRİSİ — canlı kayıt okunamazsa geçerli olan değerler.
 *  Alan alan `buyur_plans` ile örtüşmelidir (tests/plan-catalog.test.ts kilitler). */
export const DEFAULT_PLAN_ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  freemium: {
    features: { ...NONE, menu: true, basic_analytics: true, ai_menu_import: true, ai_translation: true },
    limits: { durationMonths: 1, menuViews: 5_000, retentionDays: 90, aiScansPerMonth: 2, aiPagesPerScan: 5 },
  },
  premium: {
    features: {
      ...NONE,
      menu: true,
      basic_analytics: true,
      advanced_analytics: true,
      insights: true,
      campaigns: true,
      branding_removal: true,
      ai_menu_import: true,
      ai_translation: true,
    },
    // Ücretli planlarda Freemium limitleri UYGULANMAZ.
    limits: { durationMonths: null, menuViews: null, retentionDays: 365, aiScansPerMonth: 5, aiPagesPerScan: 5 },
  },
  elite: {
    features: {
      ...NONE,
      menu: true,
      basic_analytics: true,
      advanced_analytics: true,
      insights: true,
      campaigns: true,
      branding_removal: true,
      website: true,
      advanced_reports: true,
      report_export: true,
      ai_menu_import: true,
      ai_translation: true,
    },
    limits: { durationMonths: null, menuViews: null, retentionDays: 1095, aiScansPerMonth: 10, aiPagesPerScan: 5 },
  },
};

export function normalizePlan(value: unknown): Plan {
  return PLAN_ORDER.includes(value as Plan) ? (value as Plan) : "freemium";
}

// ─── Canlı katalog (buyur_plans) ───────────────────────────────────────

/** Canlı kayıtlardan türetilmiş yetkiler. Boşsa her okuma yedeğe düşer. */
let liveCatalog: Partial<Record<Plan, PlanEntitlements>> = {};

/** Feature → plan kaydındaki `limits` anahtarı. Var olan alanlar yeniden
 *  kullanıldı (analytics, reports…) ki aynı bilgi iki yerde durmasın. */
const FEATURE_LIMIT_KEYS: Record<Exclude<Feature, "menu">, string> = {
  basic_analytics: "analytics",
  advanced_analytics: "analytics_advanced",
  insights: "insights",
  campaigns: "campaigns",
  branding_removal: "branding_removal",
  website: "website",
  advanced_reports: "reports",
  report_export: "reports_export",
  ai_menu_import: "ai_menu_import",
  ai_translation: "ai_translation",
};

/** applyPlanRecords'un ihtiyaç duyduğu en küçük kayıt şekli. */
export interface PlanRecordLike {
  key?: string;
  name?: string;
  description?: string;
  features?: unknown;
  price_monthly?: unknown;
  price_yearly_monthly?: unknown;
  trial_months?: number;
  limits?: unknown;
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Tek bir plan kaydını yetkilere çevirir. Eksik ya da bozuk her alan o
 *  planın YEDEK değerine düşer; kayıt kısmen dolu olsa da plan kilitlenmez. */
export function entitlementsFromRecord(record: PlanRecordLike, fallback: PlanEntitlements): PlanEntitlements {
  const raw = (record.limits && typeof record.limits === "object" ? record.limits : {}) as Record<string, unknown>;

  const features = { ...fallback.features };
  for (const [feature, key] of Object.entries(FEATURE_LIMIT_KEYS) as [Exclude<Feature, "menu">, string][]) {
    if (typeof raw[key] === "boolean") features[feature] = raw[key] as boolean;
  }

  // Süre üst düzey `trial_months` alanından okunur: 0 = süresiz.
  const durationMonths = isNumber(record.trial_months)
    ? record.trial_months > 0
      ? record.trial_months
      : null
    : fallback.limits.durationMonths;

  // null "sınırsız" demektir ve geçerli bir değerdir; yalnızca anahtar HİÇ
  // yoksa ya da tipi bozuksa yedeğe düşülür.
  const nullableNumber = (key: string, fallbackValue: number | null) =>
    key in raw && (raw[key] === null || isNumber(raw[key])) ? (raw[key] as number | null) : fallbackValue;

  return {
    features,
    limits: {
      durationMonths,
      menuViews: nullableNumber("menu_views", fallback.limits.menuViews),
      retentionDays: isNumber(raw.analytics_retention_days)
        ? raw.analytics_retention_days
        : fallback.limits.retentionDays,
      aiScansPerMonth: nullableNumber("ai_scans_per_month", fallback.limits.aiScansPerMonth),
      aiPagesPerScan: isNumber(raw.ai_pages_per_scan) ? raw.ai_pages_per_scan : fallback.limits.aiPagesPerScan,
    },
  };
}

/** `buyur_plans` kayıtlarını canlı katalog olarak yükler. Tanınmayan anahtarlar
 *  yok sayılır; listede olmayan planlar yedekte kalır. */
export function applyPlanRecords(records: PlanRecordLike[]): void {
  const next: Partial<Record<Plan, PlanEntitlements>> = {};
  for (const record of records) {
    if (!PLAN_ORDER.includes(record.key as Plan)) continue;
    const plan = record.key as Plan;
    next[plan] = entitlementsFromRecord(record, DEFAULT_PLAN_ENTITLEMENTS[plan]);
  }
  liveCatalog = next;
}

/** Canlı kataloğu boşaltır: her okuma yedek değerlere döner (testler için). */
export function resetPlanCatalog(): void {
  liveCatalog = {};
}

export function entitlementsFor(plan: Plan): PlanEntitlements {
  const key = normalizePlan(plan);
  return liveCatalog[key] ?? DEFAULT_PLAN_ENTITLEMENTS[key];
}

// ─── Freemium kullanımı ────────────────────────────────────────────────

export type FreemiumLimitReason = "duration" | "menu_views";

export interface FreemiumUsage {
  /** Bu plan süre/görüntülenme limitine tabi mi (yalnızca Freemium). */
  limited: boolean;
  /** Kalan gün; süresiz planda null. */
  daysLeft: number | null;
  expiresAt: Date | null;
  menuViews: number;
  menuViewLimit: number | null;
  /** 0–1 arası; iki limitten hangisi daha doluysa o. */
  usageRatio: number;
  /** Limit doldu mu ve hangisi yüzünden. */
  exhausted: boolean;
  reason: FreemiumLimitReason | null;
  /** Uyarı eşiği: 50 / 75 / 90 / 100 ya da null. */
  warningThreshold: 50 | 75 | 90 | 100 | null;
}

export const FREEMIUM_WARNING_THRESHOLDS = [50, 75, 90, 100] as const;

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** İşletmenin Freemium kullanım durumu. Ücretli planlarda `limited: false`
 *  döner ve hiçbir limit uygulanmaz — bu ayrım kritik. */
export function freemiumUsage(
  business: Pick<Business, "plan" | "plan_expires_at" | "menu_views">,
  now: Date = new Date()
): FreemiumUsage {
  const plan = normalizePlan(business.plan);
  const { limits } = entitlementsFor(plan);

  const menuViews = Math.max(0, business.menu_views ?? 0);

  if (limits.durationMonths === null && limits.menuViews === null) {
    return {
      limited: false,
      daysLeft: null,
      expiresAt: null,
      menuViews,
      menuViewLimit: null,
      usageRatio: 0,
      exhausted: false,
      reason: null,
      warningThreshold: null,
    };
  }

  const expiresAt = parseDate(business.plan_expires_at);
  const msLeft = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  const daysLeft = msLeft === null ? null : Math.max(0, Math.ceil(msLeft / 86_400_000));

  const viewRatio = limits.menuViews ? menuViews / limits.menuViews : 0;
  // Süre oranı: toplam süreye göre ne kadarı geçti.
  const totalMs = limits.durationMonths ? limits.durationMonths * 30 * 86_400_000 : null;
  const timeRatio = totalMs && msLeft !== null ? 1 - Math.max(0, msLeft) / totalMs : 0;

  const usageRatio = Math.min(1, Math.max(0, Math.max(viewRatio, timeRatio)));

  const viewsExhausted = limits.menuViews !== null && menuViews >= limits.menuViews;
  const timeExhausted = msLeft !== null && msLeft <= 0;

  // Hangisi önce dolduysa Freemium biter.
  const reason: FreemiumLimitReason | null = viewsExhausted
    ? "menu_views"
    : timeExhausted
      ? "duration"
      : null;

  let warningThreshold: FreemiumUsage["warningThreshold"] = null;
  const percent = usageRatio * 100;
  for (const threshold of FREEMIUM_WARNING_THRESHOLDS) {
    if (percent >= threshold) warningThreshold = threshold;
  }

  return {
    limited: true,
    daysLeft,
    expiresAt,
    menuViews,
    menuViewLimit: limits.menuViews,
    usageRatio,
    exhausted: viewsExhausted || timeExhausted,
    reason,
    warningThreshold,
  };
}

// ─── AI kullanım kotası ────────────────────────────────────────────────

/** Kotanın sayıldığı dönem anahtarı: işletmenin kaydındaki `ai_scans_period`
 *  ile karşılaştırılır; ay değişince sayaç sıfırdan başlar. */
export function aiPeriodKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface AiUsage {
  /** Bu plan tarama sayısına tabi mi (Elite'te sınırsız). */
  limited: boolean;
  /** Bu dönem kullanılan tarama sayısı. */
  used: number;
  /** Dönem başına hak; sınırsızsa null. */
  limit: number | null;
  /** Kalan hak; sınırsızsa null. */
  remaining: number | null;
  /** Hak bitti mi. */
  exhausted: boolean;
  /** Tek taramada gönderilebilecek en fazla sayfa. */
  pagesPerScan: number;
  /** Sayacın ait olduğu dönem (YYYY-MM). */
  period: string;
}

/** İşletmenin bu ayki AI tarama kullanımı. Kayıttaki dönem geçmiş bir aya
 *  aitse sayaç sıfır kabul edilir — dönem sıfırlaması için ayrı bir cron'a
 *  gerek kalmasın diye okuma anında hesaplanıyor. */
export function aiUsage(
  business: Pick<Business, "plan"> & { ai_scans_used?: number; ai_scans_period?: string },
  now: Date = new Date()
): AiUsage {
  const plan = normalizePlan(business.plan);
  const { limits } = entitlementsFor(plan);
  const period = aiPeriodKey(now);

  const samePeriod = business.ai_scans_period === period;
  const used = samePeriod ? Math.max(0, business.ai_scans_used ?? 0) : 0;
  const limit = limits.aiScansPerMonth;

  return {
    limited: limit !== null,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    exhausted: limit !== null && used >= limit,
    pagesPerScan: limits.aiPagesPerScan,
    period,
  };
}

/** Abonelik hâlâ geçerli mi (Freemium'da limit dolmamış, ücretli planda her zaman). */
export function isSubscriptionActive(
  business: Pick<Business, "plan" | "plan_expires_at" | "menu_views">,
  now: Date = new Date()
): boolean {
  return !freemiumUsage(business, now).exhausted;
}

/** Bir özellik bu işletme için kullanılabilir mi.
 *  Freemium limiti dolduğunda temel menü dışındaki yetenekler kapanır; veri
 *  silinmez, yalnızca erişim kısıtlanır. */
export function isFeatureAvailable(
  business: Pick<Business, "plan" | "plan_expires_at" | "menu_views">,
  feature: Feature,
  now: Date = new Date()
): boolean {
  const plan = normalizePlan(business.plan);
  const allowed = entitlementsFor(plan).features[feature];
  if (!allowed) return false;

  // Freemium süresi/limitleri dolduysa menü dışındaki özellikler kilitlenir.
  if (feature !== "menu" && !isSubscriptionActive(business, now)) return false;
  return true;
}

/** Bir özelliğin açık olduğu en düşük plan — "hangi plana geçmeliyim" mesajı için. */
export function requiredPlanFor(feature: Feature): Plan | null {
  return PLAN_ORDER.find((plan) => entitlementsFor(plan).features[feature]) ?? null;
}

// ─── Yükseltme önerisi ─────────────────────────────────────────────────
//
// "Hangi plana yükselt" kararı ekranlarda elle yazılmaz. Kilit kartları, plan
// kullanım kartı ve kota mesajları buradan okur; böylece Elite'te "Premium'a
// yükselt" gibi geriye dönük bir CTA hiçbir ekranda çıkamaz.

/** Türkçe ek uyumu: "Premium'a yükselt", "Elite'e geç". */
export const PLAN_LABELS_DATIVE: Record<Plan, string> = {
  freemium: "Freemium'a",
  premium: "Premium'a",
  elite: "Elite'e",
};

/** Türkçe ek uyumu: "Ürün analitiği Premium'da", "Raporlar Elite'te". */
export const PLAN_LABELS_LOCATIVE: Record<Plan, string> = {
  freemium: "Freemium'da",
  premium: "Premium'da",
  elite: "Elite'te",
};

const planRank = (plan: Plan) => PLAN_ORDER.indexOf(plan);

/** Mevcut plandan yüksek planlar, küçükten büyüğe. En üst planda boş. */
export function upgradePlans(plan: Plan): Plan[] {
  const current = normalizePlan(plan);
  return PLAN_ORDER.filter((candidate) => planRank(candidate) > planRank(current));
}

/** Kilitli bir özellik (ya da genel yükseltme) için önerilecek plan.
 *  - Özellik daha yüksek bir planda açılıyorsa o plan.
 *  - Özellik bu planda var ama erişim kapalıysa (ör. Freemium süresi doldu)
 *    bir üst plan.
 *  - En üst plandaysa null: gösterilecek bir yükseltme yoktur. */
export function upgradeTargetFor(business: Pick<Business, "plan">, feature?: Feature): Plan | null {
  const current = normalizePlan(business.plan);
  if (feature) {
    const required = requiredPlanFor(feature);
    if (required && planRank(required) > planRank(current)) return required;
  }
  return upgradePlans(current)[0] ?? null;
}

const formatCount = (value: number) => value.toLocaleString("tr-TR");

/** Freemium limitlerinin metin hâli — landing, SSS ve panel aynı cümleyi kursun.
 *  Canlı katalogdan okunur; rakam değişince metinler kendiliğinden değişir. */
export function freemiumLimits(): { months: number | null; views: number | null; viewsLabel: string; summary: string } {
  const { durationMonths: months, menuViews: views } = entitlementsFor("freemium").limits;
  const viewsLabel = views === null ? "sınırsız" : formatCount(views);
  const parts = [
    months === null ? null : `${months} ay`,
    views === null ? null : `${viewsLabel} menü görüntülenmesi`,
  ].filter(Boolean);
  return { months, views, viewsLabel, summary: parts.length > 0 ? parts.join(" veya ") : "süre ve görüntülenme sınırı yok" };
}

// ─── Pazarlama ve panel için ortak karşılaştırma tablosu ───────────────

export interface FeatureMatrixRow {
  label: string;
  /** Plana göre gösterilecek değer: true/false ya da serbest metin. */
  values: Record<Plan, boolean | string>;
}

const feat = (feature: Feature) => (plan: Plan): boolean | string => entitlementsFor(plan).features[feature];

/** Satır tanımları: etiket sabit, DEĞERLER canlı katalogdan hesaplanır. */
const MATRIX_ROWS: { label: string; value: (plan: Plan) => boolean | string }[] = [
  { label: "Dijital QR menü", value: feat("menu") },
  {
    label: "Menü görüntülenme",
    value: (plan) => {
      const limit = entitlementsFor(plan).limits.menuViews;
      return limit === null ? "Sınırsız" : formatCount(limit);
    },
  },
  {
    label: "Kullanım süresi",
    value: (plan) => {
      const months = entitlementsFor(plan).limits.durationMonths;
      return months === null ? "Sınırsız" : `${months} ay`;
    },
  },
  { label: "Temel analizler", value: feat("basic_analytics") },
  { label: "Gelişmiş analizler", value: feat("advanced_analytics") },
  { label: "Otomatik içgörüler & performans skoru", value: feat("insights") },
  { label: "Kampanyalar", value: feat("campaigns") },
  { label: "buyur markasını kaldırma", value: feat("branding_removal") },
  { label: "Otomatik web sitesi (menü verisinden · animasyon · slider · galeri)", value: feat("website") },
  {
    label: "Yapay zekâ ile fiziksel menü aktarımı",
    value: (plan) => {
      const { features, limits } = entitlementsFor(plan);
      if (!features.ai_menu_import) return false;
      return limits.aiScansPerMonth === null ? "Sınırsız" : `Ayda ${limits.aiScansPerMonth} tarama`;
    },
  },
  { label: "Yapay zekâ ile çoklu dil tamamlama", value: feat("ai_translation") },
  { label: "Gelişmiş raporlar", value: feat("advanced_reports") },
  { label: "PDF ve CSV dışa aktarma", value: feat("report_export") },
];

/** Landing sayfası ve panelin plan sayfası aynı tablodan beslenir. Değerler
 *  her çağrıda canlı katalogdan okunur — panelde admin'in değiştirdiği rakam
 *  ile fiyat sayfasında görünen rakam ayrışamaz. */
export function featureMatrix(): FeatureMatrixRow[] {
  return MATRIX_ROWS.map((row) => ({
    label: row.label,
    values: Object.fromEntries(PLAN_ORDER.map((plan) => [plan, row.value(plan)])) as Record<Plan, boolean | string>,
  }));
}
