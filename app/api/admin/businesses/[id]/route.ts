import { NextResponse, type NextRequest } from "next/server";
import { getServicePB } from "@/lib/pocketbase-server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureMessage, recordAdminAction, runAuditedUpdate } from "@/lib/admin-audit";
import {
  BUSINESS_ACTIONS,
  NOTE_MAX,
  buildBusinessPatch,
  isBusinessActionKind,
  reasonError,
  type ActionInput,
} from "@/lib/admin-business-actions";
import { ADMIN_NOTE_COLLECTION } from "@/lib/admin-businesses";
import { canPerform } from "@/lib/admin-roles";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { isEmailConfigured } from "@/lib/email";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { sendPasswordResetLink } from "@/lib/password-reset-mail";
import { clientIp } from "@/lib/rate-limit";
import type { Business } from "@/lib/types";

// Yönetim panelinden bir işletmeye işlem uygular. Sıra: 401 (oturum) → 400
// (girdi) → 403 (rol) → 404 (işletme) → 409 (çakışma) → iş.
//
// Yazma admin'in KENDİ token'ıyla yapılır (session.pb): PocketBase kuralları
// rolü ikinci kez uygular (destek plan yazamaz) ve kayıt kimin yaptığını taşır.
// Her değişiklik runAuditedUpdate ile yazılır; denetim kaydı yazılamazsa geri
// alınır (lib/admin-audit.ts). Kurallar: lib/admin-business-actions.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdminRequest(req);
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { id } = await params;

  let body: ActionInput & { action?: unknown; reason?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!isBusinessActionKind(body.action)) {
    return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
  }
  const kind = body.action;
  const meta = BUSINESS_ACTIONS[kind];

  // Not, gerekçenin kendisidir; diğer her işlem gerekçe ister.
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (kind !== "note") {
    const error = reasonError(reason);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  if (!canPerform(admin.role, meta.permission)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const service = await getServicePB();
  let business: Business;
  try {
    business = await service.collection(BUSINESS_COLLECTION).getOne<Business>(id, { requestKey: null });
  } catch (err) {
    if ((err as { status?: number })?.status === 404) {
      return NextResponse.json({ error: "İşletme bulunamadı." }, { status: 404 });
    }
    console.error("[admin-business] işletme okunamadı", id, err);
    return NextResponse.json({ error: "İşletme okunamadı, tekrar dene." }, { status: 503 });
  }
  const ip = clientIp(req);

  if (kind === "note") {
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return NextResponse.json({ error: "Not boş olamaz." }, { status: 400 });
    if (text.length > NOTE_MAX) return NextResponse.json({ error: `Not en fazla ${NOTE_MAX} karakter olabilir.` }, { status: 400 });
    // Not kaydı yazarını ve zamanını taşır, yalnızca eklenir: ayrı bir denetim
    // kaydına gerek yok, kendisi iz.
    try {
      const note = await pb
        .collection(ADMIN_NOTE_COLLECTION)
        .create({ business: id, admin: admin.id, admin_email: admin.email, body: text }, { requestKey: null });
      return NextResponse.json({ ok: true, note });
    } catch (err) {
      console.error("[admin-business] not yazılamadı", id, err);
      return NextResponse.json({ error: "Not kaydedilemedi, tekrar dene." }, { status: 500 });
    }
  }

  if (kind === "password_reset") {
    if (!business.email) return NextResponse.json({ error: "Bu hesabın e-postası yok." }, { status: 409 });
    if (!isEmailConfigured()) return NextResponse.json({ error: "E-posta servisi yapılandırılmamış." }, { status: 503 });
    let result;
    try {
      result = await sendPasswordResetLink(service, { email: business.email, name: business.name });
    } catch (err) {
      console.error("[admin-business] sıfırlama e-postası gönderilemedi", id, err);
      return NextResponse.json({ error: "E-posta gönderilemedi, biraz sonra tekrar dene." }, { status: 502 });
    }
    if (result === "throttled") {
      return NextResponse.json({ error: "Az önce bir bağlantı gönderildi. Bir dakika sonra tekrar dene." }, { status: 429 });
    }
    // E-posta gitti, geri alınamaz; kayıt yazılamazsa bunu açıkça söyleriz.
    const logged = await recordAdminAction(pb, {
      admin,
      action: meta.logAction,
      targetCollection: BUSINESS_COLLECTION,
      targetId: id,
      reason,
      ip,
    }).then(
      () => true,
      (err) => {
        console.error("[admin-business] sıfırlama kaydı yazılamadı", id, err);
        return false;
      }
    );
    return NextResponse.json({
      ok: true,
      message: logged
        ? `Sıfırlama bağlantısı ${business.email} adresine gönderildi.`
        : `Bağlantı gönderildi ama denetim kaydı yazılamadı. Teknik ekibe haber ver.`,
    });
  }

  // Süreli plan kararı canlı plan kataloğundan okunur.
  await ensurePlanCatalog(service);
  const patchResult = buildBusinessPatch(kind, body, business);
  if (!patchResult.ok) return NextResponse.json({ error: patchResult.error }, { status: 400 });

  if (kind === "slug_change") {
    const slug = patchResult.patch.slug as string;
    const taken = await service
      .collection(BUSINESS_COLLECTION)
      .getList(1, 1, { filter: service.filter("slug = {:slug} && id != {:id}", { slug, id }), fields: "id", requestKey: null })
      .then((r) => r.totalItems > 0);
    if (taken) return NextResponse.json({ error: "Bu menü adresi başka bir işletmede kullanılıyor." }, { status: 409 });
  }

  const result = await runAuditedUpdate<Business & Record<string, unknown>>(pb, {
    admin,
    action: meta.logAction,
    collection: BUSINESS_COLLECTION,
    id,
    patch: patchResult.patch,
    reason,
    ip,
  });
  if (!result.ok) {
    console.error("[admin-business] işlem uygulanamadı", kind, id, result.reason, result.error);
    const status = result.reason === "write_failed" && (result.error as { status?: number })?.status === 404 ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Bu işlem için yetkiniz yok." : auditFailureMessage(result.reason) }, { status });
  }
  return NextResponse.json({ ok: true });
}
