import { describe, expect, it } from "vitest";
import { isDrinkCategory, upsellSuggestions } from "@/lib/upsell";
import type { Category, Product } from "@/lib/types";

function category(id: string, name: string, translations: Category["translations"] = {}): Category {
  return { id, business: "b", name, description: "", image: "", order: 0, is_active: true, translations, created: "", updated: "" };
}

function product(id: string, categoryId: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    business: "b",
    category: categoryId,
    name: id,
    description: "",
    price: 100,
    image: "",
    image_url: "",
    prep_time_min: 0,
    prep_time_max: 0,
    calories: 0,
    allergens: [],
    badges: [],
    is_available: true,
    order: 0,
    discount_percent: 0,
    campaign_label: "",
    created: "",
    updated: "",
    ...overrides,
  };
}

describe("içecek kategorisi tanıma", () => {
  it("ad ya da çeviri üzerinden tanır", () => {
    expect(isDrinkCategory(category("c1", "Soğuk İçecekler"))).toBe(true);
    expect(isDrinkCategory(category("c2", "Kahveler"))).toBe(true);
    expect(isDrinkCategory(category("c3", "Hot Drinks"))).toBe(true);
    expect(isDrinkCategory(category("c4", "Sıcaklar", { en: { name: "Coffee & Tea" } }))).toBe(true);
  });

  it("yemek kategorilerini içecek sanmaz", () => {
    expect(isDrinkCategory(category("c1", "Kahvaltı"))).toBe(false);
    expect(isDrinkCategory(category("c2", "Soğuk Başlangıçlar"))).toBe(false);
    expect(isDrinkCategory(category("c3", "Ana Yemekler"))).toBe(false);
  });
});

describe("yanına içecek önerisi", () => {
  const categories = [category("food", "Burgerler"), category("drinks", "İçecekler")];
  const burger = product("burger", "food");
  const cola = product("cola", "drinks");
  const ayran = product("ayran", "drinks", { badges: ["populer"] });
  const soldOut = product("limonata", "drinks", { is_available: false });

  it("yemek eklenince içecekleri önerir; öne çıkarılan önce gelir", () => {
    const result = upsellSuggestions({
      added: burger,
      categories,
      products: [burger, cola, ayran, soldOut],
      cartProductIds: ["burger"],
    });
    expect(result.map((item) => item.id)).toEqual(["ayran", "cola"]);
  });

  it("içecek eklendiyse ya da sepette içecek varsa önermez", () => {
    expect(upsellSuggestions({ added: cola, categories, products: [burger, cola], cartProductIds: ["cola"] })).toEqual([]);
    expect(
      upsellSuggestions({ added: burger, categories, products: [burger, cola], cartProductIds: ["burger", "cola"] })
    ).toEqual([]);
  });

  it("menüde içecek kategorisi yoksa önermez", () => {
    expect(
      upsellSuggestions({ added: burger, categories: [categories[0]!], products: [burger], cartProductIds: [] })
    ).toEqual([]);
  });
});
