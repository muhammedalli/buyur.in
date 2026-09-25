import { NextResponse, type NextRequest } from "next/server";
import { createServerPB } from "@/lib/pocketbase";
import { ADMIN_COLLECTION, adminCookieOptions, authenticateAdminRequest } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-cookie";
import { ADMIN_SESSION_TTL_MS, readSessionSecret, sealAdminCookie } from "@/lib/admin-session";
import { newPasswordError } from "@/lib/password";
import { clientIp } from "@/lib/rate-limit";
import type { Admin } from "@/lib/types";

// Yöneticinin kendi şifresini değiştirmesi. İlk hesap scripts/create-admin.mjs
// ile geçici bir şifreyle açılır; bu uç o şifrenin hemen değiştirilebilmesi içindir.
// PocketBase şifre değişince eski token'ları geçersiz kılar (diğer cihazlardaki
// oturumlar da düşer); bu cihazdaki oturum yeni şifreyle yenilenir.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req);
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;

  const secret = readSessionSecret();
  if (!secret) return NextResponse.json({ error: "Yönetim girişi yapılandırılmamış." }, { status: 503 });

  let body: { oldPassword?: unknown; password?: unknown; passwordConfirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
  if (!oldPassword) return NextResponse.json({ error: "Mevcut şifreni gir." }, { status: 400 });
  const passwordError = newPasswordError(body.password, body.passwordConfirm);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  const password = body.password as string;
  if (password === oldPassword) {
    return NextResponse.json({ error: "Yeni şifre mevcut şifreyle aynı olamaz." }, { status: 400 });
  }

  try {
    await pb
      .collection(ADMIN_COLLECTION)
      .update(admin.id, { oldPassword, password, passwordConfirm: password }, { requestKey: null });
  } catch (err) {
    const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
    if (data?.oldPassword) return NextResponse.json({ error: "Mevcut şifre hatalı." }, { status: 400 });
    if (data?.password) return NextResponse.json({ error: "Bu şifre kabul edilmedi, başka bir şifre dene." }, { status: 400 });
    console.error("[admin-password] şifre değiştirilemedi", admin.id, err);
    return NextResponse.json({ error: "Şifre değiştirilemedi, tekrar dene." }, { status: 500 });
  }

  // Eski token artık geçersiz: aynı cihazda oturum yeni şifreyle yenilenir.
  const fresh = createServerPB();
  let refreshed: { token: string; record: Admin };
  try {
    refreshed = await fresh.collection(ADMIN_COLLECTION).authWithPassword<Admin>(admin.email, password, { requestKey: null });
  } catch (err) {
    console.error("[admin-password] yeni şifreyle oturum açılamadı", admin.id, err);
    const res = NextResponse.json({ ok: true, signedOut: true });
    res.cookies.set(ADMIN_COOKIE_NAME, "", adminCookieOptions(0));
    return res;
  }

  await recordAdminAction(fresh, {
    admin,
    action: "admin.password_change",
    targetCollection: ADMIN_COLLECTION,
    targetId: admin.id,
    ip: clientIp(req),
  }).catch((err) => console.error("[admin-password] kayıt yazılamadı", admin.id, err));

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    ADMIN_COOKIE_NAME,
    sealAdminCookie("session", { token: refreshed.token, email: admin.email, exp: Date.now() + ADMIN_SESSION_TTL_MS }, secret),
    adminCookieOptions(ADMIN_SESSION_TTL_MS)
  );
  return res;
}
