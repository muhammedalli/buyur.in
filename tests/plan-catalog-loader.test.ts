import { afterEach, describe, expect, it, vi } from "vitest";
import { entitlementsFor, resetPlanCatalog } from "@/lib/entitlements";
import { planPricing } from "@/lib/pricing";
import { PLAN_CATALOG_TTL_MS, ensurePlanCatalog, resetPlanCatalogCache } from "@/lib/plan-catalog-loader";
import { systemSetting } from "@/lib/system-settings";

/** Koleksiyona göre yanıt veren sahte istemci: planlar ve sistem ayarları
 *  aynı turda, ayrı koleksiyonlardan okunur. */
function fakeClient(impl: () => Promise<unknown[]>, settingsImpl: () => Promise<unknown[]> = async () => []) {
  const getFullList = vi.fn(impl);
  const getSettings = vi.fn(settingsImpl);
  const client = {
    collection: (name: string) => ({ getFullList: name === "buyur_settings" ? getSettings : getFullList }),
  } as never;
  return { client, getFullList, getSettings };
}

afterEach(() => {
  resetPlanCatalog();
  resetPlanCatalogCache();
});

describe("ensurePlanCatalog", () => {
  it("kayıtları okuyup canlı kataloğa uygular", async () => {
    const { client } = fakeClient(async () => [{ key: "freemium", trial_months: 1, limits: { menu_views: 9000 } }]);
    await ensurePlanCatalog(client, 1_000);
    expect(entitlementsFor("freemium").limits.menuViews).toBe(9_000);
  });

  it("TTL içinde yeniden okumaz (menü açılışına ek tur binmesin)", async () => {
    const { client, getFullList, getSettings } = fakeClient(async () => [{ key: "freemium", limits: {} }]);
    await ensurePlanCatalog(client, 1_000);
    await ensurePlanCatalog(client, 1_000 + PLAN_CATALOG_TTL_MS - 1);
    expect(getFullList).toHaveBeenCalledTimes(1);
    expect(getSettings).toHaveBeenCalledTimes(1);

    await ensurePlanCatalog(client, 1_000 + PLAN_CATALOG_TTL_MS + 1);
    expect(getFullList).toHaveBeenCalledTimes(2);
  });

  it("aynı anda gelen istekler tek okumayı paylaşır", async () => {
    const { client, getFullList, getSettings } = fakeClient(async () => [{ key: "freemium", limits: {} }]);
    await Promise.all([ensurePlanCatalog(client, 5_000), ensurePlanCatalog(client, 5_000), ensurePlanCatalog(client, 5_000)]);
    expect(getFullList).toHaveBeenCalledTimes(1);
    expect(getSettings).toHaveBeenCalledTimes(1);
  });

  it("okuma hatasında sessizce yedeğe düşer ve bir sonraki istekte yeniden dener", async () => {
    let fail = true;
    const { client, getFullList } = fakeClient(async () => {
      if (fail) throw new Error("503");
      return [{ key: "freemium", limits: { menu_views: 1234 } }];
    });

    await expect(ensurePlanCatalog(client, 10_000)).resolves.toBeUndefined();
    expect(entitlementsFor("freemium").limits.menuViews).toBe(5_000); // yedek

    fail = false;
    await ensurePlanCatalog(client, 10_001); // hata zaman damgası bırakmadı
    expect(getFullList).toHaveBeenCalledTimes(2);
    expect(entitlementsFor("freemium").limits.menuViews).toBe(1_234);
  });

  it("boş liste yedeği ezmez", async () => {
    const { client } = fakeClient(async () => []);
    await ensurePlanCatalog(client, 20_000);
    expect(entitlementsFor("premium").limits.aiScansPerMonth).toBe(5);
  });

  it("fiyatları da yükler; okuma hatasında son bilinen fiyat korunur", async () => {
    let fail = false;
    const { client } = fakeClient(async () => {
      if (fail) throw new Error("503");
      // Eski yıllık fiyat alanı okunmaz: yıllık karşılık indirimden (%20) gelir.
      return [{ key: "premium", price_monthly: 300, price_yearly_monthly: 1, limits: {} }];
    });

    await ensurePlanCatalog(client, 30_000);
    expect(planPricing("premium")).toEqual({ monthly: 300, yearlyMonthly: 240 });

    fail = true;
    await ensurePlanCatalog(client, 30_000 + PLAN_CATALOG_TTL_MS + 1);
    expect(planPricing("premium")).toEqual({ monthly: 300, yearlyMonthly: 240 });
  });

  it("sistem ayarlarını aynı turda yükler: yıllık fiyat canlı indirimle hesaplanır", async () => {
    const { client } = fakeClient(
      async () => [{ key: "premium", price_monthly: 300, limits: {} }],
      async () => [{ key: "yearly_discount_percent", value: 10 }]
    );
    await ensurePlanCatalog(client, 40_000);
    expect(systemSetting("yearly_discount_percent")).toBe(10);
    expect(planPricing("premium")).toEqual({ monthly: 300, yearlyMonthly: 270 });
  });

  it("ayarlar okunamazsa plan kataloğu yine yüklenir; ayar son bilinen değerde kalır", async () => {
    let settingsFail = false;
    const { client, getFullList } = fakeClient(
      async () => [{ key: "premium", price_monthly: 300, limits: {} }],
      async () => {
        if (settingsFail) throw new Error("404");
        return [{ key: "yearly_discount_percent", value: 30 }];
      }
    );
    await ensurePlanCatalog(client, 50_000);
    expect(systemSetting("yearly_discount_percent")).toBe(30);

    settingsFail = true;
    await ensurePlanCatalog(client, 50_000 + PLAN_CATALOG_TTL_MS + 1);
    expect(getFullList).toHaveBeenCalledTimes(2);
    expect(systemSetting("yearly_discount_percent")).toBe(30);
    expect(planPricing("premium")?.yearlyMonthly).toBe(210);
  });

  it("ayar koleksiyonu hiç yoksa (göç öncesi) yedek indirim geçerlidir", async () => {
    const { client } = fakeClient(
      async () => [{ key: "elite", price_monthly: 749, limits: {} }],
      async () => {
        throw new Error("404");
      }
    );
    await ensurePlanCatalog(client, 60_000);
    expect(systemSetting("yearly_discount_percent")).toBe(20);
    expect(planPricing("elite")?.yearlyMonthly).toBe(599.2);
  });
});
