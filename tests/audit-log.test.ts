import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  HIGHLIGHT_ACTIONS,
  auditActionLabel,
  auditActorEmail,
  auditActorType,
  auditBusinessId,
  auditChangeLines,
  auditChanges,
  auditLogHref,
  buildAuditFilter,
  parseAuditLogQuery,
  type AuditLogQuery,
} from "@/lib/audit-log";

// Merkezi denetim kaydının okuma sözleşmesi: eylem sözlüğü, önce/sonra
// gösterimi, eski (göç öncesi) kayıtların okunması ve ekran filtrelerinin
// parametreli PocketBase sorgusuna çevrilmesi.

// pb.filter'ın yerine: parametreyi belirgin biçimde yazar, enjeksiyon denemesi
// ham metin olarak görünür.
const filter = (expr: string, params: Record<string, unknown>) =>
  expr.replace(/\{:(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value instanceof Date ? `'${value.toISOString()}'` : JSON.stringify(value);
  });

const query = (patch: Partial<AuditLogQuery> = {}): AuditLogQuery => ({
  ...parseAuditLogQuery({}),
  businessIds: [],
  ...patch,
});

describe("denetim kaydı sözlüğü", () => {
  it("istenen işlem türlerinin hepsi Türkçe etiketlidir", () => {
    for (const action of [
      "business.register",
      "business.update",
      "business.delete",
      "business.login",
      "business.logout",
      "business.plan_assign",
      "category.create",
      "category.update",
      "category.delete",
      "product.create",
      "product.update",
      "product.delete",
      "product.price_change",
      "admin.role_change",
      "admin.login",
      "ai.menu_scan",
    ]) {
      expect(AUDIT_ACTION_LABELS[action], action).toBeTruthy();
    }
  });

  it("genel bakıştaki önemli işlemlerin ve sistem ayarı değişikliğinin etiketi var", () => {
    for (const action of [...HIGHLIGHT_ACTIONS, "settings.edit"]) expect(AUDIT_ACTION_LABELS[action], action).toBeTruthy();
  });

  it("bilinmeyen işlem ham adıyla görünür (kayıt okunur kalır)", () => {
    expect(auditActionLabel("yeni.islem")).toBe("yeni.islem");
  });

  it("göç öncesi kayıt yönetici kaydı olarak okunur, işletmesi hedeften bulunur", () => {
    const old = { admin: "a1", admin_email: "ali@buyur.in", actor_type: "" as const, actor_email: "", target_collection: "buyur_businesses", target_id: "b1" };
    expect(auditActorType(old)).toBe("admin");
    expect(auditActorEmail(old)).toBe("ali@buyur.in");
    expect(auditBusinessId({ ...old, business_id: "" })).toBe("b1");
    expect(auditBusinessId({ business_id: "b2", target_collection: "buyur_products", target_id: "p1" })).toBe("b2");
  });
});

describe("önce / sonra", () => {
  it("güncellemede yalnızca değişen alanlar, iç içe nesneler anahtar anahtar", () => {
    const changes = auditChanges({
      before: { price: 80, name: "Kahve", translations: { en: { name: "Coffee" }, ar: { name: "قهوة" } } },
      after: { price: 95, name: "Kahve", translations: { en: { name: "Turkish coffee" }, ar: { name: "قهوة" } } },
    });
    expect(changes).toEqual([
      { field: "price", before: 80, after: 95 },
      { field: "translations.en", before: { name: "Coffee" }, after: { name: "Turkish coffee" } },
    ]);
  });

  it("oluşturma ve silmede anlık görüntünün tamamı tek taraflı görünür", () => {
    expect(auditChanges({ before: null, after: { name: "Sütlaç", price: 90 } })).toHaveLength(2);
    expect(auditChangeLines({ before: { name: "Sütlaç" }, after: null })).toEqual(["name: Sütlaç → boş"]);
  });

  it("evet/hayır ve boş değerler okunur yazılır", () => {
    expect(auditChangeLines({ before: { is_available: true, campaign_label: "" }, after: { is_available: false, campaign_label: "Yeni" } })).toEqual([
      "is_available: evet → hayır",
      "campaign_label: boş → Yeni",
    ]);
  });
});

describe("kayıt ekranı filtreleri", () => {
  it("tanınmayan parametre boşa düşer; tarih ve kimlik biçimi doğrulanır", () => {
    const q = parseAuditLogQuery({
      baslangic: "2026-09-01",
      bitis: "dün",
      aktor: "hacker",
      islem: "product.price_change",
      kaynak: "buyur_products; drop",
      hedef: "ABC!",
      sayfa: "-3",
    });
    expect(q).toMatchObject({ from: "2026-09-01", to: "", actorType: "", action: "product.price_change", resource: "", target: "", page: 1 });
  });

  it("her değer parametreyle yazılır; tarih İstanbul günüyle", () => {
    const expr = buildAuditFilter(
      query({ q: '" || 1=1', from: "2026-09-01", to: "2026-09-02", actor: "ali@buyur.in", action: "product.delete", resource: "buyur_products" }),
      filter
    );
    // Enjeksiyon denemesi tırnaklı tek bir değer olarak kalır.
    expect(expr).toContain('action ~ "\\" || 1=1"');
    expect(expr).toContain("created >= '2026-08-31T21:00:00.000Z'");
    expect(expr).toContain("created <= '2026-09-02T20:59:59.999Z'");
    expect(expr).toContain('actor_email ~ "ali@buyur.in"');
    expect(expr).toContain('action = "product.delete"');
    expect(expr).toContain('target_collection = "buyur_products"');
  });

  it("işletme filtresi eski kayıtları da (hedef = işletme) bulur", () => {
    const expr = buildAuditFilter(query({ business: "kafe", businessIds: ["b1", "b2"] }), filter);
    expect(expr).toBe(
      '((business_id = "b1" || (target_collection = "buyur_businesses" && target_id = "b1")) || (business_id = "b2" || (target_collection = "buyur_businesses" && target_id = "b2")))'
    );
  });

  it("eşleşmeyen işletme adı hiçbir kayıt döndürmez (bütün kayıt değil)", () => {
    expect(buildAuditFilter(query({ business: "olmayan", businessIds: [] }), filter)).toBe('id = ""');
  });

  it("yönetici filtresi aktör türü boş eski kayıtları da kapsar", () => {
    expect(buildAuditFilter(query({ actorType: "admin" }), filter)).toBe('(actor_type = "admin" || actor_type = "")');
    expect(buildAuditFilter(query({ actorType: "business" }), filter)).toBe('actor_type = "business"');
  });

  it("filtre yoksa sorgu boştur; bağlantı filtreleri korur, sayfa 1'de yazılmaz", () => {
    expect(buildAuditFilter(query(), filter)).toBe("");
    const parsed = parseAuditLogQuery({ isletme: "kafe", aktor: "business", sayfa: "3" });
    expect(auditLogHref(parsed, { page: 1 })).toBe("/admin/logs?isletme=kafe&aktor=business");
    expect(auditLogHref(parsed)).toBe("/admin/logs?isletme=kafe&aktor=business&sayfa=3");
  });
});
