import { describe, expect, it } from "vitest";
import { FUNNEL_STEPS, FunnelTracker, buildFunnel } from "@/lib/analytics/funnel";
import type { AnalyticsEventType } from "@/lib/analytics/events";

// Müşteri yolculuğu hunisinin sözleşmesi. Panelde "Sepete eklendi 1 oturum,
// %0 geçiş, %100 kayıp" ve ham anahtar etiketleri ("product_detail",
// "cart_view") görünüyordu; bu testler aynı hatanın geri gelmesini engeller.

function track(events: [AnalyticsEventType, string][]) {
  const tracker = new FunnelTracker();
  for (const [type, session] of events) tracker.observe(type, session);
  return tracker.counts();
}

describe("FunnelTracker", () => {
  it("üründen doğrudan sepete ekleyen oturum, ürünü görmüş sayılır", () => {
    // Öne çıkanlardan detaya gidip ekleme: product_view event'i hiç yok.
    const counts = track([
      ["page_view", "s1"],
      ["product_detail_view", "s1"],
      ["add_to_cart", "s1"],
    ]);
    expect(counts).toEqual({ menu_open: 1, product_view: 1, add_to_cart: 1, cart_view: 0 });
  });

  it("sepete eklemeden açılan sepet (önceki ziyaretten kalan) sayılmaz", () => {
    const counts = track([
      ["page_view", "s1"],
      ["cart_view", "s1"],
    ]);
    expect(counts.cart_view).toBe(0);
  });

  it("sepet görüntüleme ancak eklemeden sonra gelirse sayılır", () => {
    const before = track([
      ["page_view", "s1"],
      ["cart_view", "s1"],
      ["add_to_cart", "s1"],
    ]);
    expect(before.cart_view).toBe(0);

    const after = track([
      ["page_view", "s1"],
      ["add_to_cart", "s1"],
      ["cart_view", "s1"],
    ]);
    expect(after.cart_view).toBe(1);
  });

  it("her adım bir öncekinin alt kümesidir", () => {
    const counts = track([
      ["page_view", "a"],
      ["page_view", "b"],
      ["product_view", "b"],
      ["add_to_cart", "c"], // page_view'ı kaçmış olsa bile menüyü açmış sayılır
      ["cart_view", "c"],
    ]);
    const values = FUNNEL_STEPS.map((step) => counts[step.key]);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeLessThanOrEqual(values[index - 1]!);
    }
  });

  it("oturumsuz event huniye girmez", () => {
    expect(track([["page_view", ""]]).menu_open).toBe(0);
  });
});

describe("buildFunnel", () => {
  it("etiketler veriden değil tanımdan gelir — satırı olmayan adım da Türkçe görünür", () => {
    const steps = buildFunnel({ menu_open: 3 });
    expect(steps.map((step) => step.label)).toEqual(FUNNEL_STEPS.map((step) => step.label));
    expect(steps.every((step) => !step.label.includes("_"))).toBe(true);
  });

  it("önceki adım boşsa geçiş ve kayıp hesaplanmaz", () => {
    const steps = buildFunnel({ menu_open: 1, product_view: 0, add_to_cart: 0 });
    expect(steps[2]!.conversion).toBeNull();
    expect(steps[2]!.dropoff).toBeNull();
  });

  it("eski (bağımsız sayılmış) satırlarda bile huni genişlemez: geçiş en fazla %100", () => {
    // Ekran görüntüsündeki durum: ara adım 0, sonraki adım 1.
    const steps = buildFunnel({ menu_open: 1, product_view: 0, add_to_cart: 1, cart_view: 0 });
    expect(steps.map((step) => step.sessions)).toEqual([1, 0, 0, 0]);
    for (const step of steps) {
      if (step.conversion !== null) expect(step.conversion).toBeLessThanOrEqual(1);
      if (step.dropoff !== null) expect(step.dropoff).toBeGreaterThanOrEqual(0);
    }
  });

  it("geçiş oranı bir önceki adıma göre hesaplanır", () => {
    const steps = buildFunnel({ menu_open: 10, product_view: 8, add_to_cart: 2, cart_view: 1 });
    expect(steps[0]!.conversion).toBeNull();
    expect(steps[1]!.conversion).toBeCloseTo(0.8);
    expect(steps[2]!.conversion).toBeCloseTo(0.25);
    expect(steps[3]!.dropoff).toBeCloseTo(0.5);
  });
});
