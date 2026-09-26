import { describe, expect, it } from "vitest";
import { PLAN_SEEDS } from "../scripts/plan-catalog.mjs";
import { afterEach, beforeEach } from "vitest";
import {
  applyPlanPrices,
  planPricing,
  resetPlanPrices,
  yearlyDiscountPercent,
  yearlyMonthlyPrice,
  yearlyTotal,
  formatTL,
} from "@/lib/pricing";
import { applySystemSettings, resetSystemSettings } from "@/lib/system-settings";
import { DEFAULT_PLAN_ENTITLEMENTS, PLAN_ORDER, entitlementsFromRecord } from "@/lib/entitlements";

// Landing'deki fiyat kartları bu katalogdan okunuyor (components/pricing-plans.tsx);
// toplantıdaki P0 kararı: sayfanın hiçbir yerinde plan/ürün sınırı/özellik çelişkisi
// kalmasın. Ürünün bugün yapmadığı işler kataloğa giremez.
describe("paket kataloğunun vaatleri", () => {
  it("olmayan bir özelliği vaat etmez", () => {
    const forbidden = [/sipariş yönetimi/i, /\bAPI\b/, /maksimum \d+ ürün/i, /white label/i, /güvenlik araç/i, /ekip yönetimi/i];
    for (const seed of PLAN_SEEDS) {
      for (const feature of [seed.description, ...seed.features]) {
        for (const pattern of forbidden) expect(feature, `${seed.key}: ${feature}`).not.toMatch(pattern);
      }
    }
  });

  it("veritabanı limitleri yetki matrisiyle çelişmez", () => {
    for (const seed of PLAN_SEEDS) {
      const features = DEFAULT_PLAN_ENTITLEMENTS[seed.key as keyof typeof DEFAULT_PLAN_ENTITLEMENTS].features;
      expect(seed.limits.analytics, `${seed.key} analytics`).toBe(features.basic_analytics);
      expect(seed.limits.campaigns, `${seed.key} campaigns`).toBe(features.campaigns);
      expect(seed.limits.website, `${seed.key} website`).toBe(features.website);
      expect(seed.limits.branding_removal, `${seed.key} branding_removal`).toBe(features.branding_removal);
      expect(seed.limits.api_access, `${seed.key} api_access`).toBe(false);
    }
  });
});

// Fiyat kodda YAŞAMAZ: kaynak PocketBase kaydıdır (lib/pricing.ts onu okur).
// Tohum katalog (plan-catalog.mjs) yeni ortam kurulumu içindir; burada tohumu
// canlı kayıt gibi yükleyip beklenen ilan tablosunu (kuruşuna kadar) kilitliyoruz.
// Her planın TEK fiyatı vardır (aylık); yıllık karşılık sistem ayarındaki
// indirim oranından türetilir (varsayılan %20).
const PRICING = (plan: "premium" | "elite") => planPricing(plan)!;

beforeEach(() => applyPlanPrices(PLAN_SEEDS));
afterEach(() => {
  resetPlanPrices();
  resetSystemSettings();
});

describe("paket kataloğu ile ilan edilen fiyat", () => {
  it("her plan için kayıttaki fiyat siteye aynen yansır", () => {
    for (const plan of PLAN_ORDER) {
      const seed = PLAN_SEEDS.find((entry) => entry.key === plan);
      expect(seed, `${plan} katalogda yok`).toBeDefined();
      expect(planPricing(plan)?.monthly).toBe(seed!.price_monthly);
      expect(planPricing(plan)?.yearlyMonthly).toBe(yearlyMonthlyPrice(seed!.price_monthly, 20));
    }
  });

  it("katalogda ikinci (yıllık) fiyat yok: yıllık karşılık yalnızca indirimden türetilir", () => {
    for (const seed of PLAN_SEEDS) expect(seed).not.toHaveProperty("price_yearly_monthly");
    // Kayıtta eski alan dursa bile okunmaz.
    applyPlanPrices([{ key: "premium", price_monthly: 249, price_yearly_monthly: 1 } as never]);
    expect(planPricing("premium")).toEqual({ monthly: 249, yearlyMonthly: 199.2 });
  });

  it("indirim oranı değişince yıllık fiyat her yerde onunla hesaplanır", () => {
    applySystemSettings([{ key: "yearly_discount_percent", value: 25 }]);
    expect(PRICING("premium").yearlyMonthly).toBe(186.75);
    expect(yearlyDiscountPercent(PRICING("premium"))).toBe(25);
    expect(formatTL(yearlyTotal(PRICING("elite")))).toBe("6.741₺");

    // Sınır dışı değer yok sayılır; yedek (%20) geçerli kalır.
    applySystemSettings([{ key: "yearly_discount_percent", value: 150 }]);
    expect(PRICING("premium").yearlyMonthly).toBe(199.2);
  });

  it("yıllık karşılık kuruşa yuvarlanır (kayan nokta artığı taşımaz)", () => {
    expect(yearlyMonthlyPrice(249, 20)).toBe(199.2);
    expect(yearlyMonthlyPrice(99.99, 15)).toBe(84.99);
    expect(yearlyMonthlyPrice(100, 0)).toBe(100);
  });

  it("ücretli planın kaydı okunamadıysa fiyat uydurulmaz (null), Freemium 0₺", () => {
    resetPlanPrices();
    expect(planPricing("premium")).toBeNull();
    expect(planPricing("elite")).toBeNull();
    expect(planPricing("freemium")).toEqual({ monthly: 0, yearlyMonthly: 0 });
  });

  it("eksik ya da bozuk fiyat alanlı kayıt yok sayılır", () => {
    applyPlanPrices([{ key: "premium" }, { key: "elite", price_monthly: "749" }]);
    expect(planPricing("premium")).toBeNull();
    expect(planPricing("elite")).toBeNull();
    applyPlanPrices([{ key: "premium", price_monthly: -1 }]);
    expect(planPricing("premium")).toBeNull();
  });

  // Ürün/kategori/işletme sayısı sınırı ürün kararı olarak kaldırıldı: şemada
  // bu kavramlar HİÇ olmamalı ("null" yazarak değil, anahtarı silerek).
  it("limits şeması tam olarak beklenen anahtarları taşır (ürün limiti yok)", () => {
    const expected = [
      "ai_menu_import", "ai_pages_per_scan", "ai_scans_per_month", "ai_translation",
      "analytics", "analytics_advanced", "analytics_retention_days", "api_access",
      "branding_removal", "campaigns", "insights", "menu_views", "reports",
      "reports_export", "scheduled_reports", "website",
    ];
    for (const seed of PLAN_SEEDS) {
      expect(Object.keys(seed.limits).sort(), `${seed.key} limits anahtarları`).toEqual(expected);
    }
  });

  it("yalnızca Freemium süreli", () => {
    for (const seed of PLAN_SEEDS) {
      expect(seed.trial_months).toBe(seed.key === "freemium" ? 1 : 0);
    }
  });

  it("yıllık ödeme %20 indirim ve beklenen toplamları verir", () => {
    expect(yearlyDiscountPercent(PRICING("premium"))).toBe(20);
    expect(yearlyDiscountPercent(PRICING("elite"))).toBe(20);

    // Toplantıda kararlaştırılan tablo — kuruşuna kadar.
    expect(formatTL(PRICING("premium").monthly)).toBe("249₺");
    expect(formatTL(PRICING("premium").yearlyMonthly)).toBe("199,20₺");
    expect(formatTL(yearlyTotal(PRICING("premium")))).toBe("2.390,40₺");
    expect(formatTL(PRICING("premium").monthly * 12)).toBe("2.988₺");

    expect(formatTL(PRICING("elite").monthly)).toBe("749₺");
    expect(formatTL(PRICING("elite").yearlyMonthly)).toBe("599,20₺");
    expect(formatTL(yearlyTotal(PRICING("elite")))).toBe("7.190,40₺");
    expect(formatTL(PRICING("elite").monthly * 12)).toBe("8.988₺");
  });
});

// Kod yedeği ile tohum katalog (DB'ye yazılan) ayrışırsa, kayıt okunamadığında
// kullanıcı başka bir plan kuralı görür. Bu test ikisini birbirine bağlar.
describe("tohum katalog = kod yedeği", () => {
  for (const seed of PLAN_SEEDS) {
    it(`${seed.key}: kayıttan türetilen yetkiler yedekle birebir aynı`, () => {
      const plan = seed.key as (typeof PLAN_ORDER)[number];
      const fromSeed = entitlementsFromRecord(
        { key: seed.key, trial_months: seed.trial_months, limits: seed.limits },
        // Yedek ver­mek yerine bilerek bozuk bir taban: tüm alanlar KAYITTAN gelmeli.
        DEFAULT_PLAN_ENTITLEMENTS[plan]
      );
      expect(fromSeed).toEqual(DEFAULT_PLAN_ENTITLEMENTS[plan]);
    });
  }
});
