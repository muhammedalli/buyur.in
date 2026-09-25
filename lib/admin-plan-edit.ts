// Yönetim panelinde plan (buyur_plans) düzenlemenin SAF kuralları: formun
// değerleri, doğrulama, kayda yazılacak alanlar, değişikliğin etkisi ve canlı
// kaydın koddaki yedekten kayması. Sözleşmesi tests/admin-plan-edit.test.ts.
//
// `limits` ham JSON olarak düzenlenmez: özellik anahtarları FEATURE_LIMIT_KEYS
// eşlemesinden üretilir, sayısal kotalar tek tek alanlardır. Formun bilmediği
// anahtarlar (api_access, scheduled_reports…) olduğu gibi korunur.

import {
  DEFAULT_PLAN_ENTITLEMENTS,
  FEATURE_LIMIT_KEYS,
  entitlementsFromRecord,
  normalizePlan,
  type Feature,
} from "@/lib/entitlements";
import { formatTL } from "@/lib/pricing";
import type { PlanRecord } from "@/lib/types";

export type EditableFeature = Exclude<Feature, "menu">;

export const EDITABLE_FEATURES = Object.keys(FEATURE_LIMIT_KEYS) as EditableFeature[];

/** Formdaki etiketler — pazarlama tablosundaki (featureMatrix) adlarla aynı dil. */
export const FEATURE_LABELS: Record<EditableFeature, string> = {
  basic_analytics: "Temel analizler",
  advanced_analytics: "Gelişmiş analizler",
  insights: "Otomatik içgörüler ve performans skoru",
  campaigns: "Kampanyalar",
  branding_removal: "buyur markasını kaldırma",
  website: "Otomatik web sitesi",
  advanced_reports: "Gelişmiş raporlar",
  report_export: "PDF ve CSV dışa aktarma",
  ai_menu_import: "Yapay zekâ ile menü aktarımı",
  ai_translation: "Yapay zekâ ile çoklu dil",
};

export interface PlanFormValues {
  name: string;
  description: string;
  price_monthly: number;
  price_yearly_monthly: number;
  /** 0 = süresiz. */
  trial_months: number;
  is_active: boolean;
  features: Record<EditableFeature, boolean>;
  /** null = sınırsız. */
  menu_views: number | null;
  ai_scans_per_month: number | null;
  ai_pages_per_scan: number;
  analytics_retention_days: number;
  /** Fiyat kartındaki madde listesi (buyur_plans.features). */
  bullets: string[];
}

export type PlanRecordInput = Pick<
  PlanRecord,
  "key" | "name" | "description" | "price_monthly" | "price_yearly_monthly" | "trial_months" | "is_active" | "is_default" | "features" | "limits"
>;

export const PLAN_LIMITS = {
  nameMax: 60,
  descriptionMax: 300,
  priceMax: 100_000,
  trialMonthsMax: 24,
  bulletsMax: 12,
  bulletMax: 120,
  pagesPerScan: [1, 20] as const,
  retentionDays: [7, 3650] as const,
  menuViewsMax: 10_000_000,
  aiScansMax: 1000,
};

function rawLimits(record: Pick<PlanRecordInput, "limits">): Record<string, unknown> {
  return record.limits && typeof record.limits === "object" ? { ...(record.limits as unknown as Record<string, unknown>) } : {};
}

/** Kaydın forma dökülmüş hâli. Eksik alan, kodun yetkiyi okurken kullandığı
 *  değerle doldurulur: form "şu an geçerli olanı" göstermeli. */
export function planFormValues(record: PlanRecordInput): PlanFormValues {
  const plan = normalizePlan(record.key);
  const effective = entitlementsFromRecord(record, DEFAULT_PLAN_ENTITLEMENTS[plan]);
  return {
    name: record.name ?? "",
    description: record.description ?? "",
    price_monthly: Number(record.price_monthly) || 0,
    price_yearly_monthly: Number(record.price_yearly_monthly) || 0,
    trial_months: Number(record.trial_months) || 0,
    is_active: Boolean(record.is_active),
    features: Object.fromEntries(EDITABLE_FEATURES.map((f) => [f, effective.features[f]])) as Record<EditableFeature, boolean>,
    menu_views: effective.limits.menuViews,
    ai_scans_per_month: effective.limits.aiScansPerMonth,
    ai_pages_per_scan: effective.limits.aiPagesPerScan,
    analytics_retention_days: effective.limits.retentionDays,
    bullets: Array.isArray(record.features) ? record.features.filter((b): b is string => typeof b === "string") : [],
  };
}

const isWhole = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const isPrice = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= PLAN_LIMITS.priceMax;

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type PlanPatchResult = { ok: true; patch: Record<string, unknown> } | { ok: false; error: string };

/** Formdan kayda yazılacak alanlar. Yalnızca değişen üst düzey alanlar döner:
 *  denetim kaydı neyin değiştiğini göstersin. */
export function buildPlanPatch(record: PlanRecordInput, input: PlanFormValues): PlanPatchResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > PLAN_LIMITS.nameMax) return { ok: false, error: `Plan adı 1–${PLAN_LIMITS.nameMax} karakter olmalı.` };
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > PLAN_LIMITS.descriptionMax) {
    return { ok: false, error: `Açıklama en fazla ${PLAN_LIMITS.descriptionMax} karakter olabilir.` };
  }
  if (!isPrice(input.price_monthly) || !isPrice(input.price_yearly_monthly)) {
    return { ok: false, error: "Fiyatlar 0 ya da pozitif bir sayı olmalı." };
  }
  if (input.price_yearly_monthly > input.price_monthly) {
    return { ok: false, error: "Yıllık ödemedeki aylık fiyat, aylık fiyattan yüksek olamaz." };
  }
  if (!isWhole(input.trial_months, 0, PLAN_LIMITS.trialMonthsMax)) {
    return { ok: false, error: `Süre 0–${PLAN_LIMITS.trialMonthsMax} ay arasında tam sayı olmalı (0 = süresiz).` };
  }
  // Kayıt ekranı varsayılan planı açar; pasif bir varsayılan, yeni işletmeleri
  // fiyat sayfasında görünmeyen bir plana düşürürdü.
  if (!input.is_active && record.is_default) {
    return { ok: false, error: "Varsayılan plan pasif yapılamaz; yeni kayıtlar bu planla açılıyor." };
  }
  if (input.menu_views !== null && !isWhole(input.menu_views, 1, PLAN_LIMITS.menuViewsMax)) {
    return { ok: false, error: "Görüntülenme limiti pozitif bir tam sayı olmalı (ya da sınırsız)." };
  }
  if (input.ai_scans_per_month !== null && !isWhole(input.ai_scans_per_month, 0, PLAN_LIMITS.aiScansMax)) {
    return { ok: false, error: "Aylık AI tarama hakkı 0 ya da pozitif bir tam sayı olmalı (ya da sınırsız)." };
  }
  if (!isWhole(input.ai_pages_per_scan, ...PLAN_LIMITS.pagesPerScan)) {
    return { ok: false, error: `Tarama başına sayfa ${PLAN_LIMITS.pagesPerScan.join("–")} arasında olmalı.` };
  }
  if (!isWhole(input.analytics_retention_days, ...PLAN_LIMITS.retentionDays)) {
    return { ok: false, error: `Veri saklama süresi ${PLAN_LIMITS.retentionDays.join("–")} gün arasında olmalı.` };
  }
  const bullets = (Array.isArray(input.bullets) ? input.bullets : [])
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean);
  if (bullets.length > PLAN_LIMITS.bulletsMax) return { ok: false, error: `En fazla ${PLAN_LIMITS.bulletsMax} madde yazılabilir.` };
  if (bullets.some((b) => b.length > PLAN_LIMITS.bulletMax)) {
    return { ok: false, error: `Her madde en fazla ${PLAN_LIMITS.bulletMax} karakter olabilir.` };
  }

  const limits = rawLimits(record);
  for (const feature of EDITABLE_FEATURES) limits[FEATURE_LIMIT_KEYS[feature]] = Boolean(input.features?.[feature]);
  limits.menu_views = input.menu_views;
  limits.ai_scans_per_month = input.ai_scans_per_month;
  limits.ai_pages_per_scan = input.ai_pages_per_scan;
  limits.analytics_retention_days = input.analytics_retention_days;

  const next: Record<string, unknown> = {
    name,
    description,
    price_monthly: input.price_monthly,
    price_yearly_monthly: input.price_yearly_monthly,
    trial_months: input.trial_months,
    is_active: input.is_active,
    features: bullets,
    limits,
  };
  const current: Record<string, unknown> = {
    name: record.name ?? "",
    description: record.description ?? "",
    price_monthly: record.price_monthly ?? 0,
    price_yearly_monthly: record.price_yearly_monthly ?? 0,
    trial_months: record.trial_months ?? 0,
    is_active: Boolean(record.is_active),
    features: Array.isArray(record.features) ? record.features : [],
    limits: rawLimits(record),
  };
  const patch = Object.fromEntries(Object.entries(next).filter(([key, value]) => !sameJson(value, current[key])));
  if (Object.keys(patch).length === 0) return { ok: false, error: "Kaydedilecek bir değişiklik yok." };
  return { ok: true, patch };
}

const limitText = (value: number | null, unit = "") => (value === null ? "sınırsız" : `${value.toLocaleString("tr-TR")}${unit}`);

/** Değişikliğin işletmelere etkisi — onaydan önce gösterilir. Kapanan özellik
 *  en üstte: o plandaki işletmeler onu hemen kaybeder. */
export function planChangeImpact(before: PlanFormValues, after: PlanFormValues): string[] {
  const lines: string[] = [];
  for (const feature of EDITABLE_FEATURES) {
    if (before.features[feature] && !after.features[feature]) lines.push(`Kapanacak: ${FEATURE_LABELS[feature]}`);
  }
  for (const feature of EDITABLE_FEATURES) {
    if (!before.features[feature] && after.features[feature]) lines.push(`Açılacak: ${FEATURE_LABELS[feature]}`);
  }
  if (before.menu_views !== after.menu_views) {
    lines.push(`Görüntülenme limiti: ${limitText(before.menu_views)} → ${limitText(after.menu_views)}`);
  }
  if (before.ai_scans_per_month !== after.ai_scans_per_month) {
    lines.push(`Aylık AI tarama: ${limitText(before.ai_scans_per_month)} → ${limitText(after.ai_scans_per_month)}`);
  }
  if (before.ai_pages_per_scan !== after.ai_pages_per_scan) {
    lines.push(`Tarama başına sayfa: ${before.ai_pages_per_scan} → ${after.ai_pages_per_scan}`);
  }
  if (before.analytics_retention_days !== after.analytics_retention_days) {
    lines.push(`Veri saklama: ${before.analytics_retention_days} → ${after.analytics_retention_days} gün`);
  }
  if (before.trial_months !== after.trial_months) {
    const show = (m: number) => (m === 0 ? "süresiz" : `${m} ay`);
    lines.push(`Süre: ${show(before.trial_months)} → ${show(after.trial_months)} (mevcut işletmelerin bitiş tarihi değişmez)`);
  }
  if (before.price_monthly !== after.price_monthly || before.price_yearly_monthly !== after.price_yearly_monthly) {
    lines.push(
      `Fiyat (aylık / yıllıkta aylık): ${formatTL(before.price_monthly)} / ${formatTL(before.price_yearly_monthly)} → ${formatTL(after.price_monthly)} / ${formatTL(after.price_yearly_monthly)}`
    );
  }
  if (before.is_active !== after.is_active) {
    lines.push(after.is_active ? "Plan fiyat sayfasında görünür olacak." : "Plan fiyat sayfasından kalkacak; mevcut işletmeler planında kalır.");
  }
  return lines;
}

/** Canlı kaydın, PocketBase okunamadığında geçerli olacak koddaki yedekten
 *  (DEFAULT_PLAN_ENTITLEMENTS) farkları. Kayma hata değildir — plan panelden
 *  değişir — ama altyapı arızasında işletmelerin bu farkı kaybedeceği bilinmeli. */
export function planDrift(record: PlanRecordInput): string[] {
  const plan = normalizePlan(record.key);
  const fallback = DEFAULT_PLAN_ENTITLEMENTS[plan];
  const live = entitlementsFromRecord(record, fallback);
  const lines: string[] = [];
  const onOff = (value: boolean) => (value ? "açık" : "kapalı");
  for (const feature of EDITABLE_FEATURES) {
    if (live.features[feature] !== fallback.features[feature]) {
      lines.push(`${FEATURE_LABELS[feature]}: canlıda ${onOff(live.features[feature])}, yedekte ${onOff(fallback.features[feature])}`);
    }
  }
  const compare = (label: string, a: number | null, b: number | null) => {
    if (a !== b) lines.push(`${label}: canlıda ${limitText(a)}, yedekte ${limitText(b)}`);
  };
  compare("Süre (ay)", live.limits.durationMonths, fallback.limits.durationMonths);
  compare("Görüntülenme limiti", live.limits.menuViews, fallback.limits.menuViews);
  compare("Aylık AI tarama", live.limits.aiScansPerMonth, fallback.limits.aiScansPerMonth);
  compare("Tarama başına sayfa", live.limits.aiPagesPerScan, fallback.limits.aiPagesPerScan);
  compare("Veri saklama (gün)", live.limits.retentionDays, fallback.limits.retentionDays);
  return lines;
}
