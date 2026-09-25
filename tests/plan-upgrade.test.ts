import { afterEach, describe, expect, it } from "vitest";
import {
  PLAN_LABELS_DATIVE,
  PLAN_ORDER,
  applyPlanRecords,
  resetPlanCatalog,
  upgradePlans,
  upgradeTargetFor,
} from "@/lib/entitlements";
import { showsPlatformSignature } from "@/lib/branding";
import type { Business, Plan } from "@/lib/types";

// "Hangi plana yükselt" kararının sözleşmesi. Elite işletmeye "Premium'a
// yükselt" gösterilmesi bu kararın ekranlarda elle yazılmasından doğuyordu;
// artık kilit kartları, kullanım kartı ve kota mesajı buradan okur.

afterEach(() => resetPlanCatalog());

const biz = (plan: Plan, overrides: Partial<Business> = {}) =>
  ({ plan, plan_expires_at: "", menu_views: 0, ...overrides }) as Business;

describe("upgradePlans", () => {
  it("Freemium → Premium ve Elite, Premium → yalnızca Elite, Elite → hiçbiri", () => {
    expect(upgradePlans("freemium")).toEqual(["premium", "elite"]);
    expect(upgradePlans("premium")).toEqual(["elite"]);
    expect(upgradePlans("elite")).toEqual([]);
  });

  it("tanınmayan plan Freemium sayılır (yükseltme seçenekleri kaybolmaz)", () => {
    expect(upgradePlans("bilinmeyen" as Plan)).toEqual(["premium", "elite"]);
  });
});

describe("upgradeTargetFor", () => {
  it("Elite işletmeye hiçbir özellik için yükseltme önerilmez", () => {
    for (const feature of ["advanced_analytics", "website", "advanced_reports", "campaigns", "insights"] as const) {
      expect(upgradeTargetFor(biz("elite"), feature)).toBeNull();
    }
    expect(upgradeTargetFor(biz("elite"))).toBeNull();
  });

  it("Premium'da kilitli bir Elite özelliği için Elite önerilir, asla Premium değil", () => {
    expect(upgradeTargetFor(biz("premium"), "website")).toBe("elite");
    expect(upgradeTargetFor(biz("premium"), "advanced_reports")).toBe("elite");
  });

  it("Freemium'a özelliğin açıldığı en düşük plan önerilir", () => {
    expect(upgradeTargetFor(biz("freemium"), "advanced_analytics")).toBe("premium");
    expect(upgradeTargetFor(biz("freemium"), "website")).toBe("elite");
  });

  it("özellik planda var ama limit dolduysa bir üst plan önerilir", () => {
    expect(upgradeTargetFor(biz("freemium"), "basic_analytics")).toBe("premium");
  });

  it("öneri canlı katalogdan okunur: admin bir özelliği Premium'a açarsa öneri de değişir", () => {
    applyPlanRecords([
      { key: "freemium", limits: {} },
      { key: "premium", limits: { website: true } },
      { key: "elite", limits: {} },
    ]);
    expect(upgradeTargetFor(biz("freemium"), "website")).toBe("premium");
    expect(upgradeTargetFor(biz("premium"), "website")).toBe("elite"); // Premium'da açık; öneri üst plan
  });
});

describe("Türkçe ek uyumu", () => {
  it("her plan için yönelme eki tanımlı", () => {
    for (const plan of PLAN_ORDER) expect(PLAN_LABELS_DATIVE[plan]).toMatch(/'(a|e)$/);
    expect(PLAN_LABELS_DATIVE.elite).toBe("Elite'e");
  });
});

describe("platform imzası (markasız menü)", () => {
  it("markayı kaldırma hakkı olan planlarda imza gösterilmez", () => {
    expect(showsPlatformSignature(biz("freemium", { plan_expires_at: "2999-01-01T00:00:00Z" }))).toBe(true);
    expect(showsPlatformSignature(biz("premium"))).toBe(false);
    expect(showsPlatformSignature(biz("elite"))).toBe(false);
  });
});
