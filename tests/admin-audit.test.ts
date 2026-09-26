import { describe, expect, it } from "vitest";
import type PocketBase from "pocketbase";
import {
  ADMIN_LOG_COLLECTION,
  auditFailureMessage,
  recordAdminAction,
  runAuditedCreate,
  runAuditedDelete,
  runAuditedUpdate,
} from "@/lib/admin-audit";

// Denetim kaydının sözleşmesi: kaydı yazılamayan admin değişikliği geri alınır,
// tekrar deneme aynı kaydı iki kez yazmaz.

type Row = Record<string, unknown> & { id: string };

interface FakeOptions {
  /** Denetim kaydı create çağrılarının sırayla vereceği hatalar. */
  logErrors?: unknown[];
  /** Kayıt yazıldı ama yanıt kayboldu (create çağrısı hata verir ama satır eklenir). */
  logLostResponse?: boolean;
  updateErrors?: unknown[];
  /** Kayıt dışı tabloların create çağrılarının sırayla vereceği hatalar. */
  createErrors?: unknown[];
}

function fakePB(rows: Record<string, Row[]>, options: FakeOptions = {}) {
  const calls: string[] = [];
  const logErrors = [...(options.logErrors ?? [])];
  const updateErrors = [...(options.updateErrors ?? [])];
  const createErrors = [...(options.createErrors ?? [])];
  let lostOnce = options.logLostResponse ?? false;
  let nextId = 1;

  const pb = {
    filter: (expr: string, params: Record<string, unknown>) =>
      expr.replace(/\{:(\w+)\}/g, (_, key) => JSON.stringify(params[key])),
    collection(name: string) {
      rows[name] ??= [];
      const table = rows[name];
      return {
        async getOne(id: string) {
          calls.push(`${name}.getOne`);
          const row = table.find((r) => r.id === id);
          if (!row) throw Object.assign(new Error("yok"), { status: 404 });
          return { ...row };
        },
        async update(id: string, patch: Record<string, unknown>) {
          calls.push(`${name}.update`);
          const error = updateErrors.shift();
          if (error) throw error;
          const row = table.find((r) => r.id === id)!;
          Object.assign(row, patch);
          return { ...row };
        },
        async create(data: Record<string, unknown>) {
          calls.push(`${name}.create`);
          if (name === ADMIN_LOG_COLLECTION) {
            if (table.some((r) => r.op_id === data.op_id)) throw Object.assign(new Error("tekil"), { status: 400 });
            const error = logErrors.shift();
            if (error) throw error;
          } else {
            const error = createErrors.shift();
            if (error) throw error;
          }
          const row = { id: `r${nextId++}`, created: "2026-09-25 10:00:00.000Z", ...data };
          table.push(row);
          if (lostOnce && name === ADMIN_LOG_COLLECTION) {
            lostOnce = false;
            throw Object.assign(new Error("503"), { status: 503 });
          }
          return row;
        },
        async delete(id: string) {
          calls.push(`${name}.delete`);
          const index = table.findIndex((r) => r.id === id);
          if (index < 0) throw Object.assign(new Error("yok"), { status: 404 });
          table.splice(index, 1);
          // Ürün silinince seçenekleri de gider (PocketBase cascade).
          if (name === "buyur_products") {
            const options = rows.buyur_product_options ?? [];
            rows.buyur_product_options = options.filter((o) => o.product !== id);
          }
          return true;
        },
        async getFullList(opts: { filter: string }) {
          calls.push(`${name}.getFullList`);
          const [field, raw] = opts.filter.split(" = ");
          const value = JSON.parse(raw);
          return (rows[name] ?? []).filter((r) => r[field.trim()] === value).map((r) => ({ ...r }));
        },
        async getFirstListItem(filter: string) {
          calls.push(`${name}.getFirstListItem`);
          const opId = JSON.parse(filter.split("=")[1].trim());
          const row = table.find((r) => r.op_id === opId);
          if (!row) throw Object.assign(new Error("yok"), { status: 404 });
          return row;
        },
      };
    },
  };
  return { pb: pb as unknown as PocketBase, rows, calls };
}

const noWait = { sleep: async () => undefined, jitter: () => 0 };
const admin = { id: "adm1", email: "ali@buyur.in" };
const unavailable = Object.assign(new Error("503"), { status: 503 });

describe("admin denetim kaydı", () => {
  it("değişikliği yazar ve önce/sonra değerleriyle kaydeder", async () => {
    const { pb, rows } = fakePB({ buyur_businesses: [{ id: "b1", plan: "freemium", name: "Kafe" }] });
    const result = await runAuditedUpdate(
      pb,
      { admin, action: "business.plan_assign", collection: "buyur_businesses", id: "b1", patch: { plan: "premium" }, reason: "ödeme alındı" },
      noWait
    );
    expect(result.ok).toBe(true);
    expect(rows.buyur_businesses[0].plan).toBe("premium");
    const log = rows[ADMIN_LOG_COLLECTION][0];
    expect(log).toMatchObject({
      admin: "adm1",
      admin_email: "ali@buyur.in",
      action: "business.plan_assign",
      target_collection: "buyur_businesses",
      target_id: "b1",
      before: { plan: "freemium" },
      after: { plan: "premium" },
      reason: "ödeme alındı",
    });
    // Değişmeyen alanlar kayda girmez.
    expect(log.before).not.toHaveProperty("name");
  });

  it("kayıt yazılamazsa değişikliği geri alır", async () => {
    const { pb, rows } = fakePB(
      { buyur_businesses: [{ id: "b1", plan: "freemium", plan_expires_at: "" }] },
      { logErrors: [unavailable, unavailable, unavailable, unavailable] }
    );
    const result = await runAuditedUpdate(
      pb,
      { admin, action: "business.plan_assign", collection: "buyur_businesses", id: "b1", patch: { plan: "elite", plan_expires_at: "2027-01-01" } },
      noWait
    );
    expect(result).toMatchObject({ ok: false, reason: "log_failed" });
    expect(rows.buyur_businesses[0]).toMatchObject({ plan: "freemium", plan_expires_at: "" });
    expect(rows[ADMIN_LOG_COLLECTION]).toHaveLength(0);
  });

  it("geri alma da başarısızsa bunu ayrıca söyler", async () => {
    const { pb } = fakePB(
      { buyur_businesses: [{ id: "b1", plan: "freemium" }] },
      {
        logErrors: [{ status: 400 }],
        // İlk update (değişiklik) geçer, geri alma denemeleri düşer.
        updateErrors: [undefined, unavailable, unavailable, unavailable, unavailable],
      }
    );
    const result = await runAuditedUpdate(
      pb,
      { admin, action: "business.plan_assign", collection: "buyur_businesses", id: "b1", patch: { plan: "elite" } },
      noWait
    );
    expect(result).toMatchObject({ ok: false, reason: "rollback_failed" });
    if (!result.ok) expect(auditFailureMessage(result.reason)).toContain("Teknik ekibe");
  });

  it("değişiklik yazılamazsa kayıt yazmaz", async () => {
    const { pb, rows } = fakePB(
      { buyur_businesses: [{ id: "b1", plan: "freemium" }] },
      { updateErrors: [{ status: 400 }] }
    );
    const result = await runAuditedUpdate(
      pb,
      { admin, action: "business.plan_assign", collection: "buyur_businesses", id: "b1", patch: { plan: "elite" } },
      noWait
    );
    expect(result).toMatchObject({ ok: false, reason: "write_failed" });
    expect(rows[ADMIN_LOG_COLLECTION] ?? []).toHaveLength(0);
  });

  it("yanıtı kaybolan kaydı ikinci kez yazmaz", async () => {
    const { pb, rows } = fakePB({}, { logLostResponse: true });
    const log = await recordAdminAction(pb, { admin, action: "admin.login" }, noWait);
    expect(log.action).toBe("admin.login");
    expect(rows[ADMIN_LOG_COLLECTION]).toHaveLength(1);
  });

  it("her kayıt kendi işlem kimliğini taşır", async () => {
    const { pb, rows } = fakePB({});
    await recordAdminAction(pb, { admin, action: "admin.login" }, noWait);
    await recordAdminAction(pb, { admin, action: "admin.logout" }, noWait);
    const ids = rows[ADMIN_LOG_COLLECTION].map((r) => r.op_id);
    expect(new Set(ids).size).toBe(2);
  });

  it("aktör, işletme ve istek bağlamını yazar; işletmenin kendisi hedefse işletme odur", async () => {
    const { pb, rows } = fakePB({ buyur_businesses: [{ id: "b1", plan: "freemium" }] });
    await runAuditedUpdate(
      pb,
      { admin, action: "business.plan_assign", collection: "buyur_businesses", id: "b1", patch: { plan: "premium" }, meta: { user_agent: "test" } },
      noWait
    );
    expect(rows[ADMIN_LOG_COLLECTION][0]).toMatchObject({
      admin: "adm1",
      actor_type: "admin",
      actor_id: "adm1",
      actor_email: "ali@buyur.in",
      business_id: "b1",
      meta: { user_agent: "test" },
    });
  });

  it("oluşturma: kayıt yazılamazsa oluşturulan kaydı siler; şifre kayda girmez", async () => {
    const { pb, rows } = fakePB({}, { logErrors: [unavailable, unavailable, unavailable, unavailable] });
    const result = await runAuditedCreate(
      pb,
      { admin, action: "admin.create", collection: "buyur_admins", data: { email: "yeni@buyur.in", role: "support", password: "gizli-sifre" } },
      noWait
    );
    expect(result).toMatchObject({ ok: false, reason: "log_failed" });
    expect(rows.buyur_admins).toHaveLength(0);

    const ok = fakePB({});
    const created = await runAuditedCreate(
      ok.pb,
      { admin, action: "admin.create", collection: "buyur_admins", data: { email: "yeni@buyur.in", role: "support", password: "gizli-sifre", passwordConfirm: "gizli-sifre" } },
      noWait
    );
    expect(created.ok).toBe(true);
    const log = ok.rows[ADMIN_LOG_COLLECTION][0];
    expect(log.before).toBeNull();
    expect(log.after).toEqual({ email: "yeni@buyur.in", role: "support" });
    expect(JSON.stringify(log)).not.toContain("gizli-sifre");
  });

  it("oluşturma tekrar denenmez: yanıtı kaybolan create çift kayıt üretmesin", async () => {
    const { pb, rows } = fakePB({}, { createErrors: [unavailable] });
    const result = await runAuditedCreate(pb, { admin, action: "category.create", collection: "buyur_categories", data: { name: "Tatlılar" } }, noWait);
    expect(result).toMatchObject({ ok: false, reason: "write_failed" });
    expect(rows.buyur_categories ?? []).toHaveLength(0);
  });

  it("silme: silinmeden önceki anlık görüntü kayda girer, bağlı kayıtlar sayılır", async () => {
    const { pb, rows } = fakePB({
      buyur_products: [{ id: "p1", business: "b1", name: "Kahve", price: 80, collectionId: "x", created: "c", updated: "u" }],
      buyur_product_options: [{ id: "o1", product: "p1", name: "Orta" }],
    });
    const result = await runAuditedDelete(
      pb,
      { admin, action: "product.delete", collection: "buyur_products", id: "p1", businessId: "b1", dependents: [{ collection: "buyur_product_options", field: "product" }] },
      noWait
    );
    expect(result.ok).toBe(true);
    expect(rows.buyur_products).toHaveLength(0);
    const log = rows[ADMIN_LOG_COLLECTION][0];
    expect(log).toMatchObject({ action: "product.delete", business_id: "b1", after: null, before: { id: "p1", name: "Kahve", price: 80 } });
    expect(log.before).not.toHaveProperty("collectionId");
    expect(log.meta).toMatchObject({ cascaded: { buyur_product_options: 1 } });
  });

  it("silme: kayıt yazılamazsa kayıt ve bağlıları AYNI kimlikle geri gelir", async () => {
    const { pb, rows } = fakePB(
      {
        buyur_products: [{ id: "p1", business: "b1", name: "Kahve", price: 80 }],
        buyur_product_options: [{ id: "o1", product: "p1", name: "Orta" }],
      },
      { logErrors: [unavailable, unavailable, unavailable, unavailable] }
    );
    const result = await runAuditedDelete(
      pb,
      { admin, action: "product.delete", collection: "buyur_products", id: "p1", dependents: [{ collection: "buyur_product_options", field: "product" }] },
      noWait
    );
    expect(result).toMatchObject({ ok: false, reason: "log_failed" });
    expect(rows.buyur_products.map((r) => r.id)).toEqual(["p1"]);
    expect(rows.buyur_product_options.map((r) => r.id)).toEqual(["o1"]);
  });
});
