import { describe, expect, it } from "vitest";
import { buildDailyRows, type StatRow } from "@/lib/analytics/rollup";
import type { MenuEvent, MenuSession } from "@/lib/types";

// Agregasyonun doğruluğu: panelin gördüğü her sayı bu fonksiyondan çıkıyor.

const TZ = "Europe/Istanbul";

function session(overrides: Partial<MenuSession> = {}): MenuSession {
  return {
    id: `s${Math.random().toString(36).slice(2, 8)}`,
    business: "biz",
    key: "sess-1",
    visitor: "vis-1",
    started_at: "2026-08-15T09:00:00.000Z",
    last_seen_at: "2026-08-15T09:03:00.000Z",
    duration_sec: 180,
    events_count: 6,
    page_views: 3,
    product_views: 2,
    cart_adds: 1,
    source: "qr",
    medium: "",
    campaign: "",
    referrer_host: "",
    device: "mobile",
    country: "TR",
    city: "İstanbul",
    locale: "tr",
    entry_path: "/",
    exit_path: "/menu",
    is_returning: false,
    created: "2026-08-15T09:00:00.000Z",
    updated: "2026-08-15T09:03:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<MenuEvent> = {}): MenuEvent {
  return {
    id: `e${Math.random().toString(36).slice(2, 8)}`,
    business: "biz",
    type: "page_view",
    target: "menu",
    label: "Menü",
    session: "sess-1",
    visitor: "vis-1",
    source: "qr",
    medium: "",
    campaign: "",
    referrer_host: "",
    device: "mobile",
    country: "TR",
    city: "İstanbul",
    locale: "tr",
    occurred_at: "2026-08-15T09:00:00.000Z",
    created: "2026-08-15T09:00:00.000Z",
    updated: "2026-08-15T09:00:00.000Z",
    ...overrides,
  };
}

function find(rows: StatRow[], dimension: string, key: string): StatRow | undefined {
  return rows.find((row) => row.dimension === dimension && row.key === key);
}

describe("günlük agregasyon", () => {
  it("oturum ve tekil ziyaretçileri doğru sayar (aynı ziyaretçi iki oturum = 1 ziyaretçi)", () => {
    const rows = buildDailyRows(
      [],
      [
        session({ key: "a", visitor: "v1" }),
        session({ key: "b", visitor: "v1", is_returning: true }),
        session({ key: "c", visitor: "v2" }),
      ],
      TZ
    );

    const total = find(rows, "total", "")!;
    expect(total.metrics.sessions).toBe(3);
    expect(total.metrics.visitors).toBe(2);
    expect(total.metrics.new_sessions).toBe(2);
    expect(total.metrics.returning_sessions).toBe(1);
  });

  it("bounce yalnızca tek sayfalı, etkileşimsiz oturumlarda sayılır", () => {
    const rows = buildDailyRows(
      [],
      [
        session({ key: "a", page_views: 1, product_views: 0, cart_adds: 0 }),
        session({ key: "b", page_views: 4, product_views: 2, cart_adds: 0 }),
        session({ key: "c", page_views: 1, product_views: 0, cart_adds: 1 }),
      ],
      TZ
    );

    expect(find(rows, "total", "")!.metrics.bounced_sessions).toBe(1);
  });

  it("event tiplerini toplam metriklere eşler", () => {
    const rows = buildDailyRows(
      [
        event({ type: "page_view" }),
        event({ type: "page_view", target: "product" }),
        event({ type: "product_view", product: "p1", label: "Köfte" }),
        event({ type: "product_detail_view", product: "p1", label: "Köfte" }),
        event({ type: "add_to_cart", product: "p1", label: "Köfte" }),
        event({ type: "qr_scan", target: "masa-01" }),
      ],
      [session()],
      TZ
    );

    const total = find(rows, "total", "")!;
    expect(total.metrics.page_views).toBe(2);
    expect(total.metrics.product_views).toBe(1);
    expect(total.metrics.product_detail_views).toBe(1);
    expect(total.metrics.cart_adds).toBe(1);
    expect(total.metrics.qr_scans).toBe(1);
    expect(total.metrics.events).toBe(6);
  });

  it("ürün kırılımında metrikler ve tekil oturum sayısı ayrışır", () => {
    const rows = buildDailyRows(
      [
        event({ type: "product_view", product: "p1", label: "Köfte", session: "s1" }),
        event({ type: "product_view", product: "p1", label: "Köfte", session: "s2" }),
        event({ type: "product_detail_view", product: "p1", label: "Köfte", session: "s2" }),
        event({ type: "add_to_cart", product: "p1", label: "Köfte", session: "s2" }),
        event({ type: "product_view", product: "p2", label: "Risotto", session: "s1" }),
      ],
      [session({ key: "s1" }), session({ key: "s2", visitor: "v2" })],
      TZ
    );

    const product = find(rows, "product", "p1")!;
    expect(product.label).toBe("Köfte");
    expect(product.metrics.views).toBe(2);
    expect(product.metrics.detail_views).toBe(1);
    expect(product.metrics.cart_adds).toBe(1);
    expect(product.metrics.sessions).toBe(2);

    expect(find(rows, "product", "p2")!.metrics.views).toBe(1);
  });

  it("funnel adımları oturum bazında tekilleştirilir", () => {
    const rows = buildDailyRows(
      [
        event({ type: "page_view", session: "s1" }),
        event({ type: "page_view", session: "s1" }), // aynı oturum tekrar saymaz
        event({ type: "page_view", session: "s2" }),
        event({ type: "category_view", category: "c1", session: "s1" }),
        event({ type: "product_view", product: "p1", session: "s1" }),
        event({ type: "add_to_cart", product: "p1", session: "s1" }),
      ],
      [session({ key: "s1" }), session({ key: "s2" })],
      TZ
    );

    expect(find(rows, "funnel", "menu_open")!.metrics.sessions).toBe(2);
    expect(find(rows, "funnel", "product_view")!.metrics.sessions).toBe(1);
    expect(find(rows, "funnel", "add_to_cart")!.metrics.sessions).toBe(1);
    // Kategori yan daldır, huni adımı değildir (bkz. lib/analytics/funnel.ts).
    expect(find(rows, "funnel", "category_view")).toBeUndefined();
    expect(find(rows, "funnel", "cart_view")).toBeUndefined(); // sıfır metrikli satır yazılmaz
  });

  it("saat kırılımı işletme saat dilimine göre üretilir", () => {
    // 22:30 UTC → İstanbul'da 01:30
    const rows = buildDailyRows([event({ type: "page_view", occurred_at: "2026-08-14T22:30:00.000Z" })], [], TZ);
    const hourRow = find(rows, "hour", "page_views")!;
    expect(hourRow.metrics["1"]).toBe(1);
    expect(hourRow.metrics["22"]).toBeUndefined();
  });

  it("kaynak ve cihaz kırılımı oturumdan, etkileşim sayıları event'ten gelir", () => {
    const rows = buildDailyRows(
      [
        event({ type: "page_view", source: "instagram", device: "desktop" }),
        event({ type: "add_to_cart", product: "p1", source: "instagram", device: "desktop" }),
      ],
      [session({ source: "instagram", device: "desktop", duration_sec: 120 })],
      TZ
    );

    const source = find(rows, "source", "instagram")!;
    expect(source.metrics.sessions).toBe(1);
    expect(source.metrics.page_views).toBe(1);
    expect(source.metrics.cart_adds).toBe(1);
    expect(source.metrics.duration_sum).toBe(120);

    expect(find(rows, "device", "desktop")!.metrics.sessions).toBe(1);
  });

  it("kategori geçişlerini oturum içinde sırayla yakalar", () => {
    const rows = buildDailyRows(
      [
        event({
          type: "category_view",
          category: "c1",
          label: "Ana Yemekler",
          session: "s1",
          occurred_at: "2026-08-15T09:00:00.000Z",
        }),
        event({
          type: "category_view",
          category: "c2",
          label: "Tatlılar",
          session: "s1",
          occurred_at: "2026-08-15T09:01:00.000Z",
        }),
      ],
      [session({ key: "s1" })],
      TZ
    );

    const transition = find(rows, "navigation", "c1>c2")!;
    expect(transition.metrics.transitions).toBe(1);
    expect(transition.label).toBe("Ana Yemekler → Tatlılar");
  });

  it("arama metriklerinde sonuçsuz aramalar ayrı sayılır", () => {
    const rows = buildDailyRows(
      [
        event({ type: "search", target: "burger", label: "burger", meta: { results: 3, no_result: false } }),
        event({ type: "search", target: "burger", label: "burger", meta: { results: 3, no_result: false } }),
        event({ type: "search", target: "lahmacun", label: "lahmacun", meta: { results: 0, no_result: true } }),
      ],
      [],
      TZ
    );

    expect(find(rows, "search", "burger")!.metrics.searches).toBe(2);
    expect(find(rows, "search", "burger")!.metrics.result_sum).toBe(6);
    expect(find(rows, "search", "lahmacun")!.metrics.no_results).toBe(1);
  });

  it("boşluk içeren anahtarlar (şehir adı) satırları karıştırmaz", () => {
    const rows = buildDailyRows(
      [],
      [
        session({ key: "a", city: "New York", visitor: "v1" }),
        session({ key: "b", city: "New Jersey", visitor: "v2" }),
      ],
      TZ
    );

    expect(find(rows, "city", "New York")!.metrics.sessions).toBe(1);
    expect(find(rows, "city", "New Jersey")!.metrics.sessions).toBe(1);
  });

  it("veri yoksa hiç satır üretmez (uydurma sıfır satırı yazmayız)", () => {
    expect(buildDailyRows([], [], TZ)).toEqual([]);
  });
});

describe("göç öncesi kayıtlarla geriye dönük uyum", () => {
  // Faz 1 öncesi event'lerde ilişki alanı yoktu; ürün/kategori kimliği target'ta.
  it("ilişki boşsa target'taki kimliği ürün olarak kabul eder", () => {
    const rows = buildDailyRows(
      [
        event({ type: "product_view", product: "", target: "abc123def456789", label: "Eski Ürün" }),
        event({ type: "add_to_cart", product: "", target: "abc123def456789", label: "Eski Ürün" }),
      ],
      [],
      TZ
    );

    const product = find(rows, "product", "abc123def456789")!;
    expect(product.metrics.views).toBe(1);
    expect(product.metrics.cart_adds).toBe(1);
    expect(product.label).toBe("Eski Ürün");
  });

  it("target kimlik biçiminde değilse ürün satırı üretmez (sayfa adı ürün sanılmaz)", () => {
    const rows = buildDailyRows([event({ type: "page_view", target: "menu", label: "Menü" })], [], TZ);
    expect(rows.some((row) => row.dimension === "product")).toBe(false);
  });
});
