import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { canPerform, type AdminAction } from "@/lib/admin-roles";
import { PAYMENTS_COLLECTION, summarizePayments } from "@/lib/payments";
import { AUDIT_LOG_COLLECTION } from "@/lib/audit-log";
import type { Payment } from "@/lib/types";

// /api/admin/payments uçları uçtan uca: yönetici oturumu ve PocketBase
// sahtedir (bellek içi), aradaki her şey — yetki matrisi, girdi doğrulama,
// runAudited* akışı, denetim kaydı ve kayıt yazılamazsa geri alma — gerçektir.

const BUSINESS = "aaaaaaaaaaaaaaa";

type Row = Record<string, unknown> & { id: string };

const state = vi.hoisted(() => ({
  role: "super_admin" as string | null,
  failAuditWrites: false,
  store: new Map<string, Map<string, Record<string, unknown> & { id: string }>>(),
  seq: 0,
}));

function table(name: string) {
  let rows = state.store.get(name);
  if (!rows) state.store.set(name, (rows = new Map()));
  return rows;
}

function notFound() {
  return Object.assign(new Error("Kayıt bulunamadı"), { status: 404 });
}

// PocketBase istemcisinin rotaların kullandığı kadarı.
const fakePb = {
  authStore: { record: { id: "admin000000000a" } },
  filter: (expr: string, params: Record<string, unknown>) => ({ expr, params }),
  collection(name: string) {
    return {
      async create(data: Record<string, unknown>) {
        if (name === AUDIT_LOG_COLLECTION && state.failAuditWrites) {
          throw Object.assign(new Error("audit down"), { status: 400 });
        }
        state.seq += 1;
        // PocketBase verilen kimliği korur (silinen kayıt geri yaratılırken kullanılır).
        const id = typeof data.id === "string" && data.id ? data.id : `r${String(state.seq).padStart(14, "0")}`;
        const now = new Date(Date.UTC(2026, 8, 27, 9, 0, state.seq)).toISOString().replace("T", " ");
        const row: Row = { ...data, id, created: now, updated: now };
        table(name).set(id, row);
        return { ...row };
      },
      async getOne(id: string) {
        const row = table(name).get(id);
        if (!row) throw notFound();
        return { ...row };
      },
      async update(id: string, patch: Record<string, unknown>) {
        const row = table(name).get(id);
        if (!row) throw notFound();
        const next = { ...row, ...patch };
        table(name).set(id, next);
        return { ...next };
      },
      async delete(id: string) {
        if (!table(name).delete(id)) throw notFound();
        return true;
      },
      async getFirstListItem(filter: { params: Record<string, unknown> }) {
        const row = [...table(name).values()].find((r) => r.op_id === filter.params.opId);
        if (!row) throw notFound();
        return { ...row };
      },
      async getFullList() {
        return [...table(name).values()].map((r) => ({ ...r }));
      },
    };
  },
};

vi.mock("@/lib/admin-auth", () => ({
  authenticateAdminRequest: vi.fn(async (_req: unknown, options: { action?: AdminAction } = {}) => {
    if (!state.role) return { ok: false, response: NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 }) };
    if (options.action && !canPerform(state.role, options.action)) {
      return { ok: false, response: NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 }) };
    }
    return {
      ok: true,
      session: { pb: fakePb, admin: { id: "admin000000000a", email: "super@local.test", role: state.role, name: "Test" } },
    };
  }),
}));

vi.mock("@/lib/system-audit", () => ({ auditRequestContext: () => ({ ip: "127.0.0.1", meta: { source: "test" } }) }));

const collectionRoute = await import("@/app/api/admin/payments/route");
const itemRoute = await import("@/app/api/admin/payments/[id]/route");

function request(method: string, body?: unknown, path = "/api/admin/payments") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const create = (body: unknown) => collectionRoute.POST(request("POST", body));
const update = (id: string, body: unknown) => itemRoute.PATCH(request("PATCH", body, `/api/admin/payments/${id}`), { params: Promise.resolve({ id }) });
const remove = (id: string, body: unknown) => itemRoute.DELETE(request("DELETE", body, `/api/admin/payments/${id}`), { params: Promise.resolve({ id }) });

const payments = () => [...table(PAYMENTS_COLLECTION).values()] as unknown as Payment[];
const logs = () => [...table(AUDIT_LOG_COLLECTION).values()];

const valid = { business: BUSINESS, type: "incoming", amount: "1.250,50", date: "2026-09-27", method: "bank_transfer", status: "completed", note: "EFT" };

beforeEach(() => {
  state.role = "super_admin";
  state.failAuditWrites = false;
  state.store.clear();
  state.seq = 0;
});

describe("yetki", () => {
  it("oturum yoksa 401, hiçbir şey yazılmaz", async () => {
    state.role = null;
    expect((await create(valid)).status).toBe(401);
    expect(payments()).toHaveLength(0);
  });

  it("destek rolü ödeme ekleyemez, düzenleyemez, silemez (403)", async () => {
    const id = (await (await create(valid)).json()).id as string;
    state.role = "support";
    expect((await create(valid)).status).toBe(403);
    expect((await update(id, { ...valid, amount: "1" })).status).toBe(403);
    expect((await remove(id, { reason: "Deneme kaydı" })).status).toBe(403);
    expect(payments()).toHaveLength(1);
    expect(payments()[0].amount).toBe(125050);
  });
});

describe("ekleme", () => {
  it("tutarı kuruşa, günü öğlen UTC'ye çevirip yazar ve denetim kaydına düşer", async () => {
    const res = await create(valid);
    expect(res.status).toBe(200);
    const [row] = payments();
    expect(row).toMatchObject({ business: BUSINESS, type: "incoming", amount: 125050, date: "2026-09-27 12:00:00.000Z", method: "bank_transfer", status: "completed", note: "EFT" });
    const [log] = logs();
    expect(log).toMatchObject({ action: "payment.create", target_collection: PAYMENTS_COLLECTION, target_id: row.id, business_id: BUSINESS, actor_type: "admin" });
    expect((log.after as Record<string, unknown>).amount).toBe(125050);
    expect((log.meta as Record<string, unknown>).label).toMatch(/^Alınan ödeme · 1\.250,50\s₺$/);
  });

  it("geçersiz girdiyi Türkçe hatayla reddeder, kayıt açmaz", async () => {
    for (const [patch, message] of [
      [{ amount: "0" }, "Geçerli bir tutar yazın (ör. 1.250,00)."],
      [{ amount: "12,345" }, "Geçerli bir tutar yazın (ör. 1.250,00)."],
      [{ business: "" }, "İşletme seçin."],
      [{ date: "2026-02-30" }, "Geçerli bir tarih seçin."],
      [{ type: "refund" }, "İşlem tipini seçin."],
      [{ status: "done" }, "Durumu seçin."],
      [{ method: "bitcoin" }, "Ödeme yöntemi geçersiz."],
    ] as const) {
      const res = await create({ ...valid, ...patch });
      expect(res.status, JSON.stringify(patch)).toBe(400);
      expect((await res.json()).error).toBe(message);
    }
    expect((await collectionRoute.POST(request("POST", "{bozuk"))).status).toBe(400);
    expect(payments()).toHaveLength(0);
    expect(logs()).toHaveLength(0);
  });

  it("denetim kaydı yazılamazsa oluşturulan ödeme geri silinir", async () => {
    state.failAuditWrites = true;
    const res = await create(valid);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
    expect(payments()).toHaveLength(0);
  });
});

describe("düzenleme ve silme", () => {
  it("düzenleme önce/sonra ile kaydedilir ve bakiye kayıtlardan yeniden hesaplanır", async () => {
    await create({ ...valid, type: "charge", amount: "749", method: "" });
    const paymentId = (await (await create({ ...valid, amount: "500" })).json()).id as string;
    expect(summarizePayments(payments()).balance).toBe(24900);

    const res = await update(paymentId, { ...valid, amount: "749" });
    expect(res.status).toBe(200);
    expect(summarizePayments(payments()).balance).toBe(0);
    const log = logs().find((l) => l.action === "payment.update")!;
    expect(log.before).toMatchObject({ amount: 50000 });
    expect(log.after).toMatchObject({ amount: 74900 });
  });

  it("denetim kaydı yazılamazsa düzenleme eski değerlere döner", async () => {
    const id = (await (await create(valid)).json()).id as string;
    state.failAuditWrites = true;
    expect((await update(id, { ...valid, amount: "1" })).status).toBe(500);
    expect(payments()[0].amount).toBe(125050);
  });

  it("bilinmeyen ya da biçimsiz kimlik 404", async () => {
    expect((await update("yokyokyokyokyok", valid)).status).toBe(404);
    expect((await update("../x", valid)).status).toBe(404);
    expect((await remove("yokyokyokyokyok", { reason: "Yanlış kayıt" })).status).toBe(404);
  });

  it("silme gerekçe ister; silinen kaydın tamamı gerekçeyle denetim kaydında kalır", async () => {
    const id = (await (await create(valid)).json()).id as string;
    expect((await remove(id, {})).status).toBe(400);
    expect((await remove(id, { reason: "kısa" })).status).toBe(400);
    expect(payments()).toHaveLength(1);

    expect((await remove(id, { reason: "Yanlış işletmeye girilmiş" })).status).toBe(200);
    expect(payments()).toHaveLength(0);
    const log = logs().find((l) => l.action === "payment.delete")!;
    expect(log).toMatchObject({ reason: "Yanlış işletmeye girilmiş", business_id: BUSINESS, after: null });
    expect(log.before).toMatchObject({ amount: 125050, type: "incoming" });
  });

  it("denetim kaydı yazılamazsa silinen ödeme aynı kimlikle geri gelir", async () => {
    const id = (await (await create(valid)).json()).id as string;
    state.failAuditWrites = true;
    expect((await remove(id, { reason: "Yanlış işletmeye girilmiş" })).status).toBe(500);
    expect(payments().map((p) => [p.id, p.amount])).toEqual([[id, 125050]]);
  });
});
