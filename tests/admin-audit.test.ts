import { describe, expect, it } from "vitest";
import type PocketBase from "pocketbase";
import { ADMIN_LOG_COLLECTION, auditFailureMessage, recordAdminAction, runAuditedUpdate } from "@/lib/admin-audit";

// Denetim kaydının sözleşmesi: kaydı yazılamayan admin değişikliği geri alınır,
// tekrar deneme aynı kaydı iki kez yazmaz.

type Row = Record<string, unknown> & { id: string };

interface FakeOptions {
  /** Denetim kaydı create çağrılarının sırayla vereceği hatalar. */
  logErrors?: unknown[];
  /** Kayıt yazıldı ama yanıt kayboldu (create çağrısı hata verir ama satır eklenir). */
  logLostResponse?: boolean;
  updateErrors?: unknown[];
}

function fakePB(rows: Record<string, Row[]>, options: FakeOptions = {}) {
  const calls: string[] = [];
  const logErrors = [...(options.logErrors ?? [])];
  const updateErrors = [...(options.updateErrors ?? [])];
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
          }
          const row = { id: `r${nextId++}`, created: "2026-09-25 10:00:00.000Z", ...data };
          table.push(row);
          if (lostOnce && name === ADMIN_LOG_COLLECTION) {
            lostOnce = false;
            throw Object.assign(new Error("503"), { status: 503 });
          }
          return row;
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
});
