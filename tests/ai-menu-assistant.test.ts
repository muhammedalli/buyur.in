import { describe, expect, it } from "vitest";
import {
  adjustPrice,
  applyMenuOps,
  detectLinks,
  draftStats,
  mergeExtracted,
  normalizeDraft,
  normalizeOps,
  readJsonSource,
  stripLinks,
  type MenuDraft,
} from "@/lib/ai/menu-assistant";
import { normalizeScanResult } from "@/lib/ai/menu-scan";

// Yönetim panelindeki menü asistanının sözleşmesi: model yalnızca işlem
// söyler, fiyat hesabı ve taslak değişikliği burada deterministik yapılır.

function sample(): MenuDraft {
  return normalizeDraft({
    categories: [
      { name: "Kahvaltı", products: [{ name: "Menemen", price: 180 }, { name: "Sucuklu Yumurta", price: 205 }] },
      { name: "İçecekler", products: [{ name: "Çay", price: 25 }, { name: "Türk Kahvesi", price: 72.5 }] },
    ],
  });
}

describe("normalizeDraft", () => {
  it("kimlikleri sıradan verir, sınır dışı ve adsız kayıtları eler", () => {
    const draft = normalizeDraft({
      categories: [
        { id: "x", name: "  Tatlı  ", products: [{ name: "Künefe", price: "150,50 ₺" }, { name: "", price: 10 }] },
        { name: "", products: [{ name: "Yetim", price: 5 }] },
      ],
    });
    expect(draft.categories).toHaveLength(1);
    expect(draft.categories[0]).toMatchObject({ id: "c1", name: "Tatlı" });
    expect(draft.categories[0].products).toEqual([
      expect.objectContaining({ id: "p1", name: "Künefe", price: 150.5, uncertain: [] }),
    ]);
  });

  it("fiyatı olmayan ürünü işaretler; tanınmayan görsel adresini atar", () => {
    const draft = normalizeDraft({
      categories: [{ name: "A", products: [{ name: "B", price: null, image_url: "https://kotu.example.com/x.jpg" }] }],
    });
    const [product] = draft.categories[0].products;
    expect(product.price).toBeNull();
    expect(product.uncertain).toContain("price");
    expect(product.image_url).toBe("");
    expect(draftStats(draft).missingPrices).toBe(1);
  });
});

describe("fiyat işlemleri", () => {
  it("tam sayı fiyat tam sayı kalır, kuruşlu fiyat kuruşta yuvarlanır", () => {
    expect(adjustPrice(180, 10)).toBe(198);
    expect(adjustPrice(72.5, 10)).toBe(79.75);
    expect(adjustPrice(205, 10, 5)).toBe(225);
  });

  it("yüzde artışı yalnızca istenen kategoriye uygulanır; fiyatsız ürüne dokunmaz", () => {
    const draft = sample();
    const { draft: next, applied } = applyMenuOps(draft, [{ op: "adjust_prices", percent: 20, category: "İçecekler" }]);
    expect(applied).toBe(1);
    expect(next.categories[0].products.map((p) => p.price)).toEqual([180, 205]);
    expect(next.categories[1].products.map((p) => p.price)).toEqual([30, 87]);
  });

  it("uç yüzdeler ve bozuk işlemler süzülür", () => {
    expect(
      normalizeOps([
        { op: "adjust_prices", percent: 900 },
        { op: "adjust_prices", percent: -95 },
        { op: "set_price", product: "p1" },
        { op: "bilinmeyen" },
        { op: "adjust_prices", percent: "10" },
      ])
    ).toEqual([{ op: "adjust_prices", percent: 10 }]);
  });
});

describe("applyMenuOps", () => {
  it("kayda kimlikle ya da adla (Türkçe katlamalı) başvurulur", () => {
    const { draft } = applyMenuOps(sample(), [
      { op: "set_price", product: "turk kahvesi", price: 80 },
      { op: "rename_category", category: "c1", name: "Sabah" },
    ]);
    expect(draft.categories[0].name).toBe("Sabah");
    expect(draft.categories[1].products[1].price).toBe(80);
  });

  it("taşıma yeni kategori açar, boşalan kategori düşer ve kimlikler yeniden verilir", () => {
    const { draft } = applyMenuOps(sample(), [
      { op: "move_product", product: "p3", category: "Sıcak İçecekler" },
      { op: "move_product", product: "p4", category: "Sıcak İçecekler" },
    ]);
    expect(draft.categories.map((c) => c.name)).toEqual(["Kahvaltı", "Sıcak İçecekler"]);
    expect(draft.categories[1]).toMatchObject({ id: "c2" });
    expect(draft.categories[1].products.map((p) => p.id)).toEqual(["p3", "p4"]);
  });

  it("aynı adlı ürün eklenmez, bulunamayan kayıt açıklanır", () => {
    const { draft, skipped, applied } = applyMenuOps(sample(), [
      { op: "add_product", category: "c2", name: "ÇAY", price: 30 },
      { op: "delete_product", product: "p99" },
    ]);
    expect(applied).toBe(0);
    expect(skipped).toHaveLength(2);
    expect(draftStats(draft).products).toBe(4);
  });

  it("birleştirme ve sıra değiştirme", () => {
    const { draft } = applyMenuOps(sample(), [
      { op: "move_category", category: "c2", position: 1 },
      { op: "merge_categories", from: "Kahvaltı", into: "İçecekler" },
    ]);
    expect(draft.categories).toHaveLength(1);
    expect(draft.categories[0].name).toBe("İçecekler");
    expect(draft.categories[0].products).toHaveLength(4);
  });
});

describe("mergeExtracted", () => {
  it("aynı adlı kategori birleşir, taslaktaki ürün yeni gelenle ezilmez", () => {
    const scan = normalizeScanResult({
      categories: [{ name: "kahvalti", products: [{ name: "MENEMEN", price: 999 }, { name: "Omlet", price: 150 }] }],
    });
    const result = mergeExtracted(sample(), scan);
    expect(result.addedProducts).toBe(1);
    expect(result.duplicateProducts).toBe(1);
    expect(result.addedCategories).toBe(0);
    const breakfast = result.draft.categories[0];
    expect(breakfast.products.find((p) => p.name === "Menemen")?.price).toBe(180);
    expect(breakfast.products.map((p) => p.name)).toContain("Omlet");
  });
});

describe("kaynak tespiti", () => {
  it("bağlantıları sondaki noktalamadan temizler ve tekrarsız döner", () => {
    expect(detectLinks("Şuradan al: https://ornek.com/menu, bir de (https://ornek.com/menu).")).toEqual(["https://ornek.com/menu"]);
  });

  it("protokolsüz www. adresini bağlantı sayar; bağlantı ayıklanınca komut kalır", () => {
    expect(detectLinks("www.kafe.com/menu fiyatlara %10 ekle")).toEqual(["https://www.kafe.com/menu"]);
    expect(stripLinks("www.kafe.com/menu fiyatlara %10 ekle")).toBe("fiyatlara %10 ekle");
  });

  it("bizim biçimimizdeki JSON model çağrılmadan okunur", () => {
    const native = readJsonSource(JSON.stringify({ categories: [{ name: "A", products: [{ name: "B", price: 10 }] }] }));
    expect(native?.kind).toBe("native");
    const array = readJsonSource(JSON.stringify([{ name: "A", products: [{ name: "B", price: 10 }] }]));
    expect(array?.kind).toBe("native");
    expect(readJsonSource('{"items":[{"title":"Çay","cost":"25"}]}')?.kind).toBe("foreign");
    expect(readJsonSource("fiyatlara %10 ekle")).toBeNull();
  });
});
