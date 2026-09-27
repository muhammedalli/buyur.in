import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedCreate } from "@/lib/admin-audit";
import { PAYMENTS_COLLECTION, PAYMENT_TYPE_LABELS, formatAmount, toPaymentRecord, validatePaymentInput } from "@/lib/payments";
import { auditRequestContext } from "@/lib/system-audit";
import type { Payment } from "@/lib/types";

// Yeni ödeme kaydı (yalnızca super_admin: payments.edit). Sıra: 401/403
// (oturum, rol) → 400 (girdi) → iş. Yazma yöneticinin kendi token'ıyla yapılır
// (PocketBase kuralı da super_admin ister); kayıt denetim kaydına düşer,
// denetim kaydı yazılamazsa oluşturulan kayıt geri silinir. Oluşturma tekrar
// denenmez (çift kayıt olmasın): hata yöneticiye döner.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req, { action: "payments.edit" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const input = validatePaymentInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const request = auditRequestContext(req);
  const result = await runAuditedCreate<Payment & Record<string, unknown>>(pb, {
    admin,
    action: "payment.create",
    businessId: input.data.business,
    ip: request.ip,
    meta: { ...request.meta, label: `${PAYMENT_TYPE_LABELS[input.data.type]} · ${formatAmount(input.data.amount)}` },
    collection: PAYMENTS_COLLECTION,
    data: toPaymentRecord(input.data),
  });
  if (!result.ok) {
    console.error("[admin-payments] ödeme eklenemedi", result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, id: result.record.id });
}
