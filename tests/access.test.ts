import { beforeEach, describe, expect, it, vi } from "vitest";

// Kiracı (tenant) izolasyonu ve plan yetkisi — bu dosyadaki testler güvenlik
// testidir: B işletmesinin verisini A kullanıcısı olarak istemek MUTLAKA
// başarısız olmalı.

// Oturum = işletme hesabı: token'ın sahibi olan kayıt işletmenin kendisidir.
const CURRENT_USER = "user_a_00000001";
const OTHER_BUSINESS = "biz_b_000000001";

let authShouldFail = false;
/** Oturumdaki hesap. Boş dizi = kurulumu (ad/slug) tamamlanmamış hesap. */
let ownedBusinesses: { id: string; name: string; plan: string; menu_views?: number }[] = [];

vi.mock("pocketbase", () => {
  class FakePocketBase {
    authStore = { save: () => undefined, isValid: true, token: "t", record: null };
    filter(expression: string, params?: Record<string, unknown>) {
      return `${expression}::${JSON.stringify(params ?? {})}`;
    }
    collection() {
      return {
        authRefresh: async () => {
          if (authShouldFail) throw new Error("invalid token");
          const account = ownedBusinesses[0];
          return {
            record: account
              ? { slug: "alpha", email: "a@example.com", ...account }
              : { id: CURRENT_USER, email: "a@example.com", slug: "" },
          };
        },
      };
    }
  }
  return { default: FakePocketBase };
});

vi.mock("@/lib/pocketbase-server", () => ({
  hasServiceCredentials: () => true,
  getServicePB: async () => ({
    filter: (expression: string, params?: Record<string, unknown>) =>
      `${expression}::${JSON.stringify(params ?? {})}`,
    collection: (name: string) => ({
      getFullList: async () => {
        if (name === "buyur_businesses") return ownedBusinesses;
        return [];
      },
      getFirstListItem: async () => {
        if (name === "buyur_plans") return { key: ownedBusinesses[0]?.plan ?? "freemium", limits: {} };
        throw new Error("not found");
      },
    }),
  }),
}));

const { AccessError, clearAnalyticsContextCache, resolveAnalyticsContext } = await import("@/lib/analytics/access");

function request(token = "test-token"): Request {
  return new Request("https://buyur.in/api/analytics/overview", {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  // Bağlam önbelleği süreç ömrü boyunca yaşıyor; testler birbirinin durumunu
  // görmesin diye her senaryodan önce temizliyoruz.
  clearAnalyticsContextCache();
  authShouldFail = false;
  ownedBusinesses = [{ id: "biz_a_000000001", name: "Alpha Cafe", plan: "premium" }];
});

describe("kimlik doğrulama", () => {
  it("token yoksa 401", async () => {
    const anonymous = new Request("https://buyur.in/api/analytics/overview");
    await expect(resolveAnalyticsContext(anonymous)).rejects.toMatchObject({ status: 401 });
  });

  it("geçersiz token 401", async () => {
    authShouldFail = true;
    await expect(resolveAnalyticsContext(request())).rejects.toBeInstanceOf(AccessError);
    await expect(resolveAnalyticsContext(request())).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
  });
});

describe("kiracı izolasyonu", () => {
  it("sahibi olduğu işletmeyi token'dan çözer", async () => {
    const context = await resolveAnalyticsContext(request());
    expect(context.business.id).toBe("biz_a_000000001");
  });

  it("BAŞKASININ işletme kimliğini isterse 403 — istemciden gelen id'ye asla güvenilmez", async () => {
    await expect(resolveAnalyticsContext(request(), OTHER_BUSINESS)).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("kurulumu tamamlanmamış hesap (slug yok) veri alamaz", async () => {
    ownedBusinesses = [];
    await expect(resolveAnalyticsContext(request())).rejects.toMatchObject({ status: 404, code: "no_business" });
  });

});

describe("plan yetkileri", () => {
  it("Premium sahibinde gelişmiş analiz açık, rapor kapalı", async () => {
    const context = await resolveAnalyticsContext(request());
    expect(context.permissions.has("analytics.view")).toBe(true);
    expect(context.permissions.has("analytics.advanced")).toBe(true);
    expect(context.permissions.has("reports.view")).toBe(false);
    expect(context.permissions.has("reports.export")).toBe(false);
  });

  it("Elite'te rapor ve dışa aktarma açılır", async () => {
    ownedBusinesses = [{ id: "biz_a_000000001", name: "Alpha Cafe", plan: "elite" }];
    const context = await resolveAnalyticsContext(request());
    expect(context.permissions.has("reports.view")).toBe(true);
    expect(context.permissions.has("reports.export")).toBe(true);
  });

  it("Freemium'da gelişmiş analiz plan seviyesinde kapalı", async () => {
    ownedBusinesses = [{ id: "biz_a_000000001", name: "Alpha Cafe", plan: "freemium" }];
    const context = await resolveAnalyticsContext(request());
    expect(context.permissions.has("analytics.view")).toBe(true);
    expect(context.permissions.has("analytics.advanced")).toBe(false);
  });

});

describe("Freemium limiti yetkiyi kapatır", () => {
  it("görüntülenme limiti dolan Freemium işletmede temel analiz de kilitlenir", async () => {
    ownedBusinesses = [
      { id: "biz_a_000000001", name: "Alpha Cafe", plan: "freemium", menu_views: 5_000 },
    ];
    const context = await resolveAnalyticsContext(request());
    expect(context.permissions.has("analytics.view")).toBe(false);
  });

  it("ücretli planda yüksek görüntülenme yetkiyi etkilemez", async () => {
    ownedBusinesses = [
      { id: "biz_a_000000001", name: "Alpha Cafe", plan: "premium", menu_views: 500_000 },
    ];
    const context = await resolveAnalyticsContext(request());
    expect(context.permissions.has("analytics.advanced")).toBe(true);
  });
});

describe("bağlam önbelleği", () => {
  it("aynı token'da kimlik doğrulamayı tekrarlamaz", async () => {
    let authCalls = 0;
    const countingRequest = () => {
      authCalls += 1;
      return request();
    };

    const first = await resolveAnalyticsContext(countingRequest());
    const second = await resolveAnalyticsContext(countingRequest());

    // Aynı nesne dönüyorsa ikinci istek ağa çıkmamış demektir.
    expect(second).toBe(first);
    expect(authCalls).toBe(2); // istek nesnesi iki kez üretildi, çözümleme bir kez
  });

  it("FARKLI token aynı önbelleği kullanamaz (yetki sızıntısı olmaz)", async () => {
    const first = await resolveAnalyticsContext(request("token-a"));
    expect(first.business.id).toBe("biz_a_000000001");

    // Başka bir kullanıcı, başka bir işletme: önceki bağlamı görmemeli.
    ownedBusinesses = [{ id: "biz_c_000000001", name: "Gamma", plan: "premium" }];
    const other = await resolveAnalyticsContext(request("token-b"));
    expect(other.business.id).toBe("biz_c_000000001");
  });

  it("önbellek temizlenince yeni plan hemen yansır", async () => {
    const before = await resolveAnalyticsContext(request());
    expect(before.permissions.has("reports.view")).toBe(false);

    ownedBusinesses = [{ id: "biz_a_000000001", name: "Alpha Cafe", plan: "elite" }];
    clearAnalyticsContextCache();

    const after = await resolveAnalyticsContext(request());
    expect(after.permissions.has("reports.view")).toBe(true);
  });
});
