import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COLLECTION, authenticateAdminRequest, isServiceAccountEmail } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedUpdate } from "@/lib/admin-audit";
import { ADMIN_ACCOUNT_ACTIONS, buildAdminAccountPatch, isAdminAccountActionKind } from "@/lib/admin-users";
import { reasonError } from "@/lib/admin-business-actions";
import { auditRequestContext } from "@/lib/system-audit";
import type { Admin } from "@/lib/types";

// Bir yönetici hesabına işlem uygular: rol değiştirme, erişimi kapatma/açma
// (yalnızca super_admin). Sıra: 401/403 → 400 → 404 → 403 (kendine) → iş.
// Kurallar lib/admin-users.ts'te; PocketBase kuralları aynı kilitleri ikinci
// kez uygular. Erişimi kapatılan yöneticinin açık oturumu bir sonraki
// istekte düşer (authRule + hook'un token yenilemesi).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdminRequest(req, { action: "admins.manage" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { id } = await params;

  let body: { action?: unknown; role?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!isAdminAccountActionKind(body.action)) return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonProblem = reasonError(reason);
  if (reasonProblem) return NextResponse.json({ error: reasonProblem }, { status: 400 });

  let target: Admin;
  try {
    target = await pb.collection(ADMIN_COLLECTION).getOne<Admin>(id, { requestKey: null });
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return NextResponse.json({ error: "Yönetici bulunamadı." }, { status: 404 });
    console.error("[admin-admins] hesap okunamadı", id, err);
    return NextResponse.json({ error: "Hesap okunamadı, tekrar dene." }, { status: 503 });
  }
  // Servis hesabı panelde yoktur; kimliği tahmin edilse de "yok" görünür.
  if (isServiceAccountEmail(target.email) || (target.role as string) === "service") {
    return NextResponse.json({ error: "Yönetici bulunamadı." }, { status: 404 });
  }

  const patch = buildAdminAccountPatch(body.action, { role: body.role }, target, admin);
  if (!patch.ok) return NextResponse.json({ error: patch.error }, { status: patch.status ?? 400 });

  const context = auditRequestContext(req);
  const result = await runAuditedUpdate<Admin & Record<string, unknown>>(pb, {
    admin,
    action: ADMIN_ACCOUNT_ACTIONS[body.action].logAction,
    collection: ADMIN_COLLECTION,
    id,
    patch: patch.patch,
    reason,
    ...context,
    meta: { ...context.meta, label: target.name || target.email, email: target.email },
  });
  if (!result.ok) {
    console.error("[admin-admins] işlem uygulanamadı", body.action, id, result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
