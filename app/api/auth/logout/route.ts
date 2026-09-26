import { NextResponse, type NextRequest } from "next/server";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { authenticateBusiness } from "@/lib/business-auth";
import { auditRequestContext, recordSystemAudit } from "@/lib/system-audit";

// İşletme panelinden çıkışın denetim kaydı. Oturum token'dır ve tarayıcıda
// silinir; PocketBase çıkışı görmez. Panel çıkışta bu ucu çağırır, kayıt
// "kim ne zaman çıktı" sorusunu cevaplar. En iyi çabayla: ne olursa olsun
// 200 döner, çıkış bu uca bağlı değildir.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await authenticateBusiness(req.headers.get("authorization"));
  if (session) {
    await recordSystemAudit({
      actor: { type: "business", id: session.business.id, email: session.business.email ?? "" },
      action: "business.logout",
      targetCollection: BUSINESS_COLLECTION,
      targetId: session.business.id,
      ...auditRequestContext(req),
    });
  }
  return NextResponse.json({ ok: true });
}
