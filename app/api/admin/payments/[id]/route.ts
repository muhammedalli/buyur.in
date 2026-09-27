import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedDelete, runAuditedUpdate } from "@/lib/admin-audit";
import { reasonError } from "@/lib/admin-business-actions";
import { PAYMENTS_COLLECTION, PAYMENT_TYPE_LABELS, formatAmount, toPaymentRecord, validatePaymentInput } from "@/lib/payments";
import { auditRequestContext } from "@/lib/system-audit";
import type { Payment } from "@/lib/types";

// Ödeme kaydını düzenler (PATCH) ya da siler (DELETE) — yalnızca super_admin.
// Her iki işlem de denetim kaydına önce/sonra ile düşer; kayıt yazılamazsa
// değişiklik geri alınır (lib/admin-audit.ts). Silme gerekçe ister: para kaydı
// silmek, sonradan "neden" sorusunun cevabını gerektirir.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[a-z0-9]{15}$/;

async function readJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function loadPayment(pb: import("pocketbase").default, id: string): Promise<Payment | null | "error"> {
  try {
    return await pb.collection(PAYMENTS_COLLECTION).getOne<Payment>(id, { requestKey: null });
  } catch (err) {
    return (err as { status?: number })?.status === 404 ? null : "error";
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdminRequest(req, { action: "payments.edit" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

  const body = await readJson(req);
  if (body === null) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const input = validatePaymentInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const current = await loadPayment(pb, id);
  if (current === "error") return NextResponse.json({ error: "Kayıt okunamadı, tekrar dene." }, { status: 503 });
  if (!current) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

  const request = auditRequestContext(req);
  const result = await runAuditedUpdate(pb, {
    admin,
    action: "payment.update",
    businessId: input.data.business,
    ip: request.ip,
    meta: {
      ...request.meta,
      label: `${PAYMENT_TYPE_LABELS[input.data.type]} · ${formatAmount(input.data.amount)}`,
      ...(current.business !== input.data.business ? { previous_business: current.business } : {}),
    },
    collection: PAYMENTS_COLLECTION,
    id,
    patch: toPaymentRecord(input.data),
  });
  if (!result.ok) {
    console.error("[admin-payments] ödeme güncellenemedi", id, result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdminRequest(req, { action: "payments.edit" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

  const body = (await readJson(req)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const reasonProblem = reasonError(reason);
  if (reasonProblem) return NextResponse.json({ error: reasonProblem }, { status: 400 });

  const current = await loadPayment(pb, id);
  if (current === "error") return NextResponse.json({ error: "Kayıt okunamadı, tekrar dene." }, { status: 503 });
  if (!current) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

  const request = auditRequestContext(req);
  const result = await runAuditedDelete<Payment & Record<string, unknown>>(pb, {
    admin,
    action: "payment.delete",
    businessId: current.business,
    reason,
    ip: request.ip,
    meta: { ...request.meta, label: `${PAYMENT_TYPE_LABELS[current.type]} · ${formatAmount(current.amount)}` },
    collection: PAYMENTS_COLLECTION,
    id,
  });
  if (!result.ok) {
    console.error("[admin-payments] ödeme silinemedi", id, result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
