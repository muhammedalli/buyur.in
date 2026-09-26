import { describe, expect, it } from "vitest";
import { buildContentChange, nameTaken, type ContentContext } from "@/lib/admin-content";
import { canPerform } from "@/lib/admin-roles";

// Yönetimden menü içeriği (kategori/ürün) düzenlemenin sözleşmesi.
describe("admin menü içeriği", () => {
  const ctx: ContentContext = {
    businessId: "b1",
    categories: [
      { id: "c1", name: "Sıcak İçecekler", order: 1, is_active: true, description: "" },
      { id: "c2", name: "Tatlılar", order: 2, is_active: true, description: "" },
      { id: "c3", name: "Boş", order: 3, is_active: true, description: "" },
    ],
    products: [
      { id: "p1", name: "Türk Kahvesi", category: "c1", order: 1, price: 80, is_available: true, discount_percent: 0, campaign_label: "", description: "" },
      { id: "p2", name: "Baklava", category: "c2", order: 4, price: 150, is_available: true, discount_percent: 0, campaign_label: "", description: "" },
    ],
  };

  it("yalnızca süper yönetici düzenler; destek görür", () => {
    expect(canPerform("super_admin", "business.content")).toBe(true);
    expect(canPerform("support", "business.content")).toBe(false);
  });

  it("ad işletme genelinde tektir (büyük/küçük harf ve Türkçe karakter katlanır)", () => {
    expect(nameTaken(ctx.products, "TURK KAHVESI")).toBe(true);
    expect(nameTaken(ctx.products, "Türk Kahvesi", "p1")).toBe(false);
    expect(buildContentChange("product", "create", { fields: { name: "türk kahvesi", price: 10, category: "c1" } }, ctx)).toMatchObject({ ok: false });
    expect(buildContentChange("category", "update", { id: "c2", fields: { name: "sicak icecekler" } }, ctx)).toMatchObject({ ok: false });
  });

  it("ürün ekleme: işletmeye bağlanır, kategorinin sonuna eklenir, varsayılan satışta", () => {
    expect(buildContentChange("product", "create", { fields: { name: "Sütlaç", price: "90,5", category: "c2" } }, ctx)).toEqual({
      ok: true,
      action: "product.create",
      data: { name: "Sütlaç", price: 90.5, category: "c2", is_available: true, business: "b1", order: 5 },
    });
  });

  it("başka işletmenin kategorisine ürün konamaz; kayıt bulunamazsa 404", () => {
    expect(buildContentChange("product", "create", { fields: { name: "X", price: 1, category: "baska" } }, ctx)).toMatchObject({ ok: false });
    expect(buildContentChange("product", "update", { id: "baska", fields: { price: 1 } }, ctx)).toMatchObject({ ok: false, status: 404 });
  });

  it("fiyat değişikliği ayrı eylem adıyla kaydedilir; yalnızca değişen alanlar yazılır", () => {
    expect(buildContentChange("product", "update", { id: "p1", fields: { price: 95, name: "Türk Kahvesi" } }, ctx)).toEqual({
      ok: true,
      action: "product.price_change",
      data: { price: 95 },
    });
    expect(buildContentChange("product", "update", { id: "p1", fields: { is_available: false } }, ctx)).toEqual({
      ok: true,
      action: "product.update",
      data: { is_available: false },
    });
    expect(buildContentChange("product", "update", { id: "p1", fields: { price: 80 } }, ctx)).toEqual({ ok: false, error: "Değişiklik yok." });
  });

  it("geçersiz değerler reddedilir", () => {
    for (const fields of [{ price: -1 }, { price: "abc" }, { discount_percent: 101 }, { discount_percent: 2.5 }, { name: "" }, { name: "x".repeat(151) }]) {
      expect(buildContentChange("product", "update", { id: "p1", fields }, ctx), JSON.stringify(fields)).toMatchObject({ ok: false });
    }
  });

  it("içinde ürün olan kategori silinmez (ürünler cascade ile giderdi)", () => {
    expect(buildContentChange("category", "delete", { id: "c1" }, ctx)).toMatchObject({ ok: false, status: 409 });
    expect(buildContentChange("category", "delete", { id: "c3" }, ctx)).toEqual({ ok: true, action: "category.delete", data: {} });
    expect(buildContentChange("product", "delete", { id: "p1" }, ctx)).toEqual({ ok: true, action: "product.delete", data: {} });
  });
});
