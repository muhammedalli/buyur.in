import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COLLECTION, authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedCreate } from "@/lib/admin-audit";
import { generateTemporaryPassword, parseNewAdmin } from "@/lib/admin-users";
import { auditRequestContext } from "@/lib/system-audit";
import type { Admin } from "@/lib/types";

// Yeni yönetici hesabı açar (yalnızca super_admin, admins.manage). Şifre
// sunucuda üretilir ve YALNIZCA bu yanıtta bir kez döner; denetim kaydına ve
// sunucu günlüğüne yazılmaz. Yeni yönetici ilk girişte e-posta koduyla da
// doğrulanır ve şifresini "Hesabım"dan değiştirir.
//
// PocketBase kuralı (scripts/admin-schema.mjs) servis rolünde hesap açmayı
// ayrıca reddeder.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req, { action: "admins.manage" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;

  let body: { email?: unknown; name?: unknown; role?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = parseNewAdmin(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const password = generateTemporaryPassword();
  const context = auditRequestContext(req);
  const result = await runAuditedCreate<Admin & Record<string, unknown>>(pb, {
    admin,
    action: "admin.create",
    collection: ADMIN_COLLECTION,
    data: { ...parsed.value, password, passwordConfirm: password, emailVisibility: false },
    reason,
    ...context,
    meta: { ...context.meta, label: parsed.value.name },
  });
  if (!result.ok) {
    const data = (result.error as { response?: { data?: Record<string, unknown> } })?.response?.data;
    if (data?.email) return NextResponse.json({ error: "Bu e-postayla bir yönetici hesabı zaten var." }, { status: 409 });
    console.error("[admin-admins] hesap açılamadı", result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, id: result.record.id, email: parsed.value.email, password });
}
