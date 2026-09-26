import { describe, expect, it } from "vitest";
import { PLAN_SEEDS } from "../scripts/plan-catalog.mjs";
import { auditChangeLines } from "@/lib/audit-log";
import {
  EDITABLE_FEATURES,
  buildPlanPatch,
  planChangeImpact,
  planDrift,
  planFormValues,
  type PlanRecordInput,
} from "@/lib/admin-plan-edit";
import { FEATURE_LIMIT_KEYS } from "@/lib/entitlements";

// Yönetim panelinden plan düzenlemenin sözleşmesi. Tohum kataloğu canlı
// kayıtlarla aynıdır (tests/plan-catalog.test.ts), bu yüzden örnek olarak o kullanılır.
const seed = (key: string) => structuredClone(PLAN_SEEDS.find((p: { key: string }) => p.key === key)) as unknown as PlanRecordInput;

describe("admin plan düzenleme", () => {
  it("form her düzenlenebilir özelliği FEATURE_LIMIT_KEYS'ten üretir", () => {
    expect(EDITABLE_FEATURES.sort()).toEqual(Object.keys(FEATURE_LIMIT_KEYS).sort());
    const values = planFormValues(seed("premium"));
    expect(values.features.campaigns).toBe(true);
    expect(values.features.website).toBe(false);
    expect(values.menu_views).toBeNull();
    expect(values.bullets.length).toBeGreaterThan(0);
  });

  it("değişmeyen form kaydedilmez", () => {
    const record = seed("elite");
    expect(buildPlanPatch(record, planFormValues(record))).toEqual({ ok: false, error: "Kaydedilecek bir değişiklik yok." });
  });

  it("yalnızca değişen alanlar yazılır; formun bilmediği limit anahtarları korunur", () => {
    const record = seed("premium");
    const values = { ...planFormValues(record), price_monthly: 299, features: { ...planFormValues(record).features, website: true } };
    const result = buildPlanPatch(record, values);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.patch).sort()).toEqual(["limits", "price_monthly"]);
    const limits = result.patch.limits as Record<string, unknown>;
    expect(limits.website).toBe(true);
    expect(limits.api_access).toBe(false);
    expect(limits.scheduled_reports).toBe(false);
  });

  it("geçersiz değerleri reddeder", () => {
    const record = seed("premium");
    const base = planFormValues(record);
    const bad = [
      { ...base, name: " " },
      { ...base, price_monthly: -1 },
      { ...base, price_monthly: Number.NaN },
      { ...base, trial_months: 1.5 },
      { ...base, trial_months: 30 },
      { ...base, menu_views: 0 },
      { ...base, ai_scans_per_month: -2 },
      { ...base, ai_pages_per_scan: 0 },
      { ...base, analytics_retention_days: 3 },
      { ...base, bullets: Array.from({ length: 13 }, (_, i) => `madde ${i}`) },
    ];
    for (const values of bad) expect(buildPlanPatch(record, values).ok).toBe(false);
  });

  it("varsayılan plan pasif yapılamaz", () => {
    const record = seed("freemium");
    expect(record.is_default).toBe(true);
    const result = buildPlanPatch(record, { ...planFormValues(record), is_active: false });
    expect(result.ok).toBe(false);
  });

  it("etki özeti kapanan özelliği en üstte söyler", () => {
    const record = seed("elite");
    const before = planFormValues(record);
    const after = { ...before, features: { ...before.features, website: false }, ai_scans_per_month: null };
    const lines = planChangeImpact(before, after, 20);
    expect(lines[0]).toBe("Kapanacak: Otomatik web sitesi");
    expect(lines).toContain("Aylık AI tarama: 10 → sınırsız");
  });

  it("planın tek fiyatı var: yıllık karşılık indirimden türetilir, kayda ayrıca yazılmaz", () => {
    const record = seed("premium");
    const before = planFormValues(record);
    expect(before).not.toHaveProperty("price_yearly_monthly");
    const after = { ...before, price_monthly: 299 };

    const result = buildPlanPatch(record, after);
    expect(result.ok && Object.keys(result.patch)).toEqual(["price_monthly"]);

    expect(planChangeImpact(before, after, 20)).toContain(
      "Aylık fiyat: 249₺ → 299₺ (yıllık ödemede ayda 199,20₺ → 239,20₺)"
    );
    // Oran sistem ayarıdır; önizleme verilen oranla hesaplanır.
    expect(planChangeImpact(before, after, 25)).toContain(
      "Aylık fiyat: 249₺ → 299₺ (yıllık ödemede ayda 186,75₺ → 224,25₺)"
    );
  });

  it("canlı kayıt yedekle aynıysa kayma yok; farklıysa söylenir", () => {
    expect(planDrift(seed("premium"))).toEqual([]);
    const record = seed("premium");
    (record.limits as unknown as Record<string, unknown>).website = true;
    expect(planDrift(record)).toEqual(["Otomatik web sitesi: canlıda açık, yedekte kapalı"]);
  });

  it("denetim kaydı iç içe limitleri anahtar anahtar gösterir", () => {
    const lines = auditChangeLines({
      before: { price_monthly: 249, limits: { menu_views: null, website: false, campaigns: true } },
      after: { price_monthly: 299, limits: { menu_views: 6000, website: true, campaigns: true } },
    });
    expect(lines).toEqual(["price_monthly: 249 → 299", "limits.menu_views: boş → 6000", "limits.website: hayır → evet"]);
  });
});
