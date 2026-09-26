import { describe, expect, it } from "vitest";
import {
  BUSINESS_PAGE_SIZE,
  businessListHref,
  businessStatus,
  parseBusinessListQuery,
  queryBusinesses,
  type AdminBusinessRow,
} from "@/lib/admin-business-list";

// Yönetim panelindeki işletme listesinin sözleşmesi.
function row(patch: Partial<AdminBusinessRow>): AdminBusinessRow {
  return {
    id: "id",
    name: "",
    slug: "",
    email: "",
    plan: "freemium",
    is_active: false,
    suspended_at: "",
    plan_expires_at: "",
    menu_views: 0,
    created: "2026-09-01 10:00:00.000Z",
    updated: "2026-09-01 10:00:00.000Z",
    ...patch,
  };
}

describe("admin işletme listesi", () => {
  const rows = [
    row({ id: "a", name: "Çınar Kafe", slug: "cinar", email: "sahip@cinar.com", plan: "premium", is_active: true, created: "2026-09-10 10:00:00.000Z", plan_expires_at: "2026-12-01 00:00:00.000Z" }),
    row({ id: "b", name: "", slug: "", email: "yeni@ornek.com", created: "2026-09-20 10:00:00.000Z" }),
    row({ id: "c", name: "Deniz Balık", slug: "deniz", email: "info@deniz.com", is_active: true, suspended_at: "2026-09-21 10:00:00.000Z", plan_expires_at: "2026-10-01 00:00:00.000Z" }),
    row({ id: "d", name: "Ada Pide", slug: "ada", email: "ada@pide.com", is_active: false, created: "2026-08-01 10:00:00.000Z" }),
  ];

  it("durum: askı her şeyin önüne geçer, slug yoksa kurulum bekliyor", () => {
    expect(rows.map(businessStatus)).toEqual(["live", "setup", "suspended", "offline"]);
  });

  it("silinen hesap askıdan önce gelir ve yalnızca 'Silindi' filtresinde listelenir", () => {
    const at = "2026-09-22 10:00:00.000Z";
    const all = [...rows, row({ id: "z", name: "Silinen", slug: "silinen", deleted_at: at, suspended_at: at })];
    expect(businessStatus(all[4])).toBe("deleted");
    const base = parseBusinessListQuery({});
    expect(queryBusinesses(all, base).items.map((r) => r.id)).not.toContain("z");
    expect(queryBusinesses(all, { ...base, status: "suspended" }).items.map((r) => r.id)).toEqual(["c"]);
    expect(queryBusinesses(all, parseBusinessListQuery({ durum: "deleted" })).items.map((r) => r.id)).toEqual(["z"]);
  });

  it("ad, slug ve e-postada Türkçe büyük/küçük harf duyarsız arar", () => {
    const find = (q: string) => queryBusinesses(rows, { ...parseBusinessListQuery({}), q }).items.map((r) => r.id);
    expect(find("ÇINAR")).toEqual(["a"]);
    expect(find("deniz.com")).toEqual(["c"]);
    expect(find("ada")).toEqual(["d"]);
    expect(find("yok-boyle")).toEqual([]);
  });

  it("plan ve durum filtresi ile sıralama", () => {
    const base = parseBusinessListQuery({});
    expect(queryBusinesses(rows, { ...base, plan: "premium" }).items.map((r) => r.id)).toEqual(["a"]);
    expect(queryBusinesses(rows, { ...base, status: "suspended" }).items.map((r) => r.id)).toEqual(["c"]);
    // Varsayılan: en yeni kayıt başta.
    expect(queryBusinesses(rows, base).items.map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
    expect(queryBusinesses(rows, { ...base, sort: "expiring" }).items.map((r) => r.id).slice(0, 2)).toEqual(["c", "a"]);
    // Ada göre: Türkçe sıralama, adsız hesap sonda.
    expect(queryBusinesses(rows, { ...base, sort: "name" }).items.map((r) => r.id)).toEqual(["d", "a", "c", "b"]);
  });

  it("tanınmayan parametre varsayılana düşer, sayfa taşmaz", () => {
    expect(parseBusinessListQuery({ plan: "gold", durum: "x", sirala: "y", sayfa: "-2" })).toEqual({
      q: "",
      plan: "",
      status: "",
      sort: "newest",
      page: 1,
    });
    const many = Array.from({ length: BUSINESS_PAGE_SIZE + 3 }, (_, i) => row({ id: `r${i}` }));
    const result = queryBusinesses(many, { ...parseBusinessListQuery({}), page: 9 });
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(3);
    expect(result.totalPages).toBe(2);
  });

  it("bağlantılar varsayılanları taşımaz", () => {
    const query = parseBusinessListQuery({ q: "kafe", plan: "elite", sayfa: "2" });
    expect(businessListHref(query)).toBe("/admin/businesses?q=kafe&plan=elite&sayfa=2");
    expect(businessListHref(query, { page: 1, q: "" })).toBe("/admin/businesses?plan=elite");
    expect(businessListHref(parseBusinessListQuery({}))).toBe("/admin/businesses");
  });
});
