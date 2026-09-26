import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COLLECTION, adminCookieOptions, authenticateAdminRequest } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { auditRequestContext } from "@/lib/system-audit";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-cookie";

// Oturumu kapatır. Çerez her durumda silinir: oturum doğrulanamasa da
// (süresi dolmuş, PocketBase'e ulaşılamıyor) kullanıcı çıkış yapabilmeli.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req);
  if (!auth.ok && auth.response.status === 403) return auth.response;

  if (auth.ok) {
    const { pb, admin } = auth.session;
    await recordAdminAction(pb, {
      admin,
      action: "admin.logout",
      targetCollection: ADMIN_COLLECTION,
      targetId: admin.id,
      ...auditRequestContext(req),
    }).catch((err) => console.error("[admin-logout] çıkış kaydı yazılamadı", admin.id, err));
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", adminCookieOptions(0));
  return res;
}
