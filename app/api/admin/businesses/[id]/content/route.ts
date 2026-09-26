import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedCreate, runAuditedDelete, runAuditedUpdate, type AuditedResult } from "@/lib/admin-audit";
import { reasonError } from "@/lib/admin-business-actions";
import {
  CONTENT_COLLECTIONS,
  buildContentChange,
  isContentOp,
  isContentResource,
  type ContentRow,
} from "@/lib/admin-content";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { isDeleted } from "@/lib/business-deletion";
import { getServicePB } from "@/lib/pocketbase-server";
import { auditRequestContext } from "@/lib/system-audit";
import type { Business } from "@/lib/types";

// Yönetim panelinden bir işletmenin kategori ve ürünlerini düzenler. Sıra:
// 401/403 (oturum, rol) → 400 (girdi) → 404 (işletme/kayıt) → 409 → iş.
//
// Okuma (işletme, mevcut adlar) servis hesabıyla, YAZMA yöneticinin kendi
// token'ıyla yapılır: PocketBase kuralları rolü ikinci kez uygular ve kayıt
// kimin yaptığını taşır. Her değişiklik runAudited* ile yazılır; denetim
// kaydı yazılamazsa geri alınır. Kurallar: lib/admin-content.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdminRequest(req, { action: "business.content" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { id: businessId } = await params;

  let body: { op?: unknown; resource?: unknown; id?: unknown; fields?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!isContentOp(body.op) || !isContentResource(body.resource)) {
    return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonProblem = reasonError(reason);
  if (reasonProblem) return NextResponse.json({ error: reasonProblem }, { status: 400 });

  const service = await getServicePB();
  const byBusiness = service.filter("business = {:id}", { id: businessId });
  let business: Business;
  let categories: ContentRow[];
  let products: ContentRow[];
  try {
    [business, categories, products] = await Promise.all([
      service.collection(BUSINESS_COLLECTION).getOne<Business>(businessId, { fields: "id,name,deleted_at", requestKey: null }),
      service.collection(CONTENT_COLLECTIONS.category).getFullList<ContentRow>({
        filter: byBusiness,
        fields: "id,name,description,order,is_active",
        requestKey: null,
      }),
      service.collection(CONTENT_COLLECTIONS.product).getFullList<ContentRow>({
        filter: byBusiness,
        fields: "id,name,description,category,order,price,is_available,discount_percent,campaign_label",
        batch: 1000,
        requestKey: null,
      }),
    ]);
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return NextResponse.json({ error: "İşletme bulunamadı." }, { status: 404 });
    console.error("[admin-content] işletme okunamadı", businessId, err);
    return NextResponse.json({ error: "İşletme okunamadı, tekrar dene." }, { status: 503 });
  }
  if (isDeleted(business)) {
    return NextResponse.json({ error: "İşletme silinmiş. Önce silmeyi geri alın." }, { status: 409 });
  }

  const change = buildContentChange(body.resource, body.op, { id: body.id, fields: body.fields }, { businessId, categories, products });
  if (!change.ok) return NextResponse.json({ error: change.error }, { status: change.status ?? 400 });

  const collection = CONTENT_COLLECTIONS[body.resource];
  const context = auditRequestContext(req);
  const rows = body.resource === "category" ? categories : products;
  const label = typeof change.data.name === "string" ? change.data.name : rows.find((row) => row.id === body.id)?.name ?? "";
  const common = {
    admin,
    action: change.action,
    businessId,
    reason,
    ...context,
    meta: { ...context.meta, label, business_name: business.name },
  };

  let result: AuditedResult<Record<string, unknown> & { id: string }>;
  if (body.op === "create") {
    result = await runAuditedCreate(pb, { ...common, collection, data: change.data });
  } else if (body.op === "update") {
    result = await runAuditedUpdate(pb, { ...common, collection, id: body.id as string, patch: change.data });
  } else {
    result = await runAuditedDelete(pb, {
      ...common,
      collection,
      id: body.id as string,
      // Ürün silinince seçenekleri de gider; kayıt yazılamazsa onlar da geri gelsin.
      dependents: body.resource === "product" ? [{ collection: "buyur_product_options", field: "product" }] : [],
    });
  }
  if (!result.ok) {
    console.error("[admin-content] işlem uygulanamadı", body.resource, body.op, businessId, result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, id: result.record.id });
}
