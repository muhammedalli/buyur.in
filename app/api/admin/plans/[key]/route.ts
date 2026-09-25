import { NextResponse, type NextRequest } from "next/server";
import { getServicePB } from "@/lib/pocketbase-server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureMessage, runAuditedUpdate } from "@/lib/admin-audit";
import { reasonError } from "@/lib/admin-business-actions";
import { buildPlanPatch, type PlanFormValues } from "@/lib/admin-plan-edit";
import { PLAN_ORDER } from "@/lib/entitlements";
import { ensurePlanCatalog, resetPlanCatalogCache } from "@/lib/plan-catalog-loader";
import { clientIp } from "@/lib/rate-limit";
import type { PlanRecord } from "@/lib/types";

// Plan kaydını (buyur_plans) düzenler — yalnızca super_admin. Yazma admin'in
// kendi token'ıyla yapılır; PocketBase kuralı da yalnızca super_admin'e açık
// (ikinci kilit). Değişiklik denetim kaydıyla yazılır, kayıt yazılamazsa geri alınır.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS = "buyur_plans";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authenticateAdminRequest(req, { action: "plans.edit" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { key } = await params;

  let body: { values?: PlanFormValues; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const error = reasonError(reason);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!body.values || typeof body.values !== "object") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!(PLAN_ORDER as string[]).includes(key)) {
    return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });
  }

  let record: PlanRecord;
  try {
    record = await pb.collection(PLANS).getFirstListItem<PlanRecord>(pb.filter("key = {:key}", { key }), { requestKey: null });
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });
    console.error("[admin-plans] plan okunamadı", key, err);
    return NextResponse.json({ error: "Plan okunamadı, tekrar dene." }, { status: 503 });
  }

  const patch = buildPlanPatch(record, body.values);
  if (!patch.ok) return NextResponse.json({ error: patch.error }, { status: 400 });

  const result = await runAuditedUpdate<PlanRecord & Record<string, unknown>>(pb, {
    admin,
    action: "plans.edit",
    collection: PLANS,
    id: record.id,
    patch: patch.patch,
    reason,
    ip: clientIp(req),
  });
  if (!result.ok) {
    console.error("[admin-plans] plan kaydedilemedi", key, result.reason, result.error);
    return NextResponse.json({ error: auditFailureMessage(result.reason) }, { status: 500 });
  }

  // Bu sunucuda hemen geçerli olsun; diğer örnekler 60 sn önbellekle yakalar.
  resetPlanCatalogCache();
  await ensurePlanCatalog(await getServicePB()).catch((err) => console.error("[admin-plans] katalog yenilenemedi", err));
  return NextResponse.json({ ok: true });
}
