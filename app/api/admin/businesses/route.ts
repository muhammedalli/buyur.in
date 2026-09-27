import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedCreate } from "@/lib/admin-audit";
import { buildNewBusiness, loginEmailAlias } from "@/lib/admin-onboarding";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { entitlementsFor } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { auditRequestContext } from "@/lib/system-audit";

// Yönetim panelinden yeni işletme hesabı açar (e-posta kodu yok). Sıra:
// 401/403 (oturum, rol) → 400 (girdi) → 409 (adres dolu) → iş.
//
// E-posta başka bir hesapta kayıtlıysa reddedilmez: giriş e-postası artı
// adresli takma ada döner (sahip+isletme@…, lib/admin-onboarding.ts →
// loginEmailAlias) ve ekrana hangi adresle giriş yapılacağı yazılır.
//
// Hesap super_admin'in KENDİ token'ıyla açılır: buyur_businesses.createRule
// yalnızca güvenilir yönetim hesaplarına açıktır (scripts/business-schema.mjs)
// ve kayıt kimin açtığını taşır. runAuditedCreate denetim kaydı yazılamazsa
// hesabı siler. Kurallar: lib/admin-onboarding.ts. İşletmeye e-posta
// gönderilmez; giriş bilgilerini yönetici kendisi iletir.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req, { action: "business.create" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const service = await getServicePB();
  await ensurePlanCatalog(service);
  const built = buildNewBusiness(body, (plan) => entitlementsFor(plan).limits.durationMonths);
  if (!built.ok) return NextResponse.json({ error: built.error, field: built.field }, { status: 400 });

  // Adres çakışmasını önceden söylemek PocketBase'in genel "geçersiz"
  // yanıtından daha anlaşılır; asıl güvence benzersiz indekstir. E-posta
  // önceden aranmaz: PocketBase gizli e-postaya filtreyi yalnızca superuser'a
  // açar, çakışma oluşturma yanıtındaki `data.email` ile yakalanır.
  const slugTaken = await service
    .collection(BUSINESS_COLLECTION)
    .getFirstListItem(service.filter("slug = {:slug}", { slug: built.slug }), { fields: "id", requestKey: null })
    .then(() => true)
    .catch(() => false);
  if (slugTaken) return NextResponse.json({ error: "Bu menü adresi kullanılıyor, başka bir adres seçin.", field: "slug" }, { status: 409 });

  const context = auditRequestContext(req);
  const create = (email: string) =>
    runAuditedCreate<{ id: string; slug: string; email: string }>(pb, {
      admin,
      action: "business.create",
      collection: BUSINESS_COLLECTION,
      data: { ...built.data, email },
      reason: email === built.email ? "Yönetim panelinden yeni işletme açıldı." : `Yönetim panelinden yeni işletme açıldı (${built.email} kayıtlı olduğu için giriş takma adla).`,
      ip: context.ip,
      meta: context.meta,
    });

  // Kayıtlı e-posta PocketBase'de "validation_not_unique" döner; o zaman
  // takma adla tekrar denenir (takma ad da doluysa sayı eklenir).
  let loginEmail = built.email;
  let result = await create(loginEmail);
  for (let attempt = 1; !result.ok && attempt <= 5 && isDuplicateEmail(result.error); attempt++) {
    loginEmail = loginEmailAlias(built.email, built.slug, attempt);
    result = await create(loginEmail);
  }
  if (!result.ok) {
    const data = pbErrorData(result.error);
    if (data?.slug) return NextResponse.json({ error: "Bu menü adresi kullanılıyor, başka bir adres seçin.", field: "slug" }, { status: 409 });
    if (data?.email) return NextResponse.json({ error: "Bu e-posta ile hesap açılamadı; başka bir e-posta deneyin.", field: "email" }, { status: 409 });
    console.error("[admin/businesses] hesap açılamadı", result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({
    ok: true,
    id: result.record.id,
    slug: result.record.slug,
    loginEmail,
    aliased: loginEmail !== built.email,
  });
}

function pbErrorData(error: unknown): Record<string, { code?: string } | undefined> | undefined {
  return (error as { response?: { data?: Record<string, { code?: string }> } })?.response?.data;
}

function isDuplicateEmail(error: unknown): boolean {
  return pbErrorData(error)?.email?.code === "validation_not_unique";
}
