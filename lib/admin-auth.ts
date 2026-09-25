// Yönetim paneli kimlik doğrulaması: sayfalarda `requireAdmin()`, /api/admin
// uçlarında `authenticateAdminRequest()`. Middleware yalnızca çerezin var olup
// olmadığına bakar; asıl kontrol buradadır.
//
// Oturum = şifreli çerezdeki admin PocketBase token'ı (bkz. lib/admin-session.ts).
// Dönen `pb` istemcisi o admin'in kendi yetkisiyle konuşur ve yalnızca sunucuda
// yaşar. Servis hesabı (getServicePB) burada kullanılmaz: o hesap `support`
// rolündedir, diğer admin kayıtlarını okuyamaz ve buyur_plans'a yazamaz;
// ayrıca kimin yaptığı bilinmeyen yazımlar üretirdi.

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import type PocketBase from "pocketbase";
import { createServerPB } from "@/lib/pocketbase";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-cookie";
import { canPerform, isAdminRole, type AdminAction } from "@/lib/admin-roles";
import { ADMIN_SESSION_TTL_MS, isSameOrigin, openAdminCookie, readSessionSecret } from "@/lib/admin-session";
import type { Admin } from "@/lib/types";

export const ADMIN_COLLECTION = "buyur_admins";

export interface AdminSession {
  /** Admin'in kendi token'ıyla konuşan, istek başına taze istemci. */
  pb: PocketBase;
  admin: Admin;
}

/** Kimlik doğrulanamadı değil, doğrulama yapılamadı: PocketBase'e ulaşılamıyor.
 *  Oturumu düşürüp giriş ekranına atmak yanıltıcı olurdu (giriş de çalışmaz). */
export class AdminAuthUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Yönetim paneline şu anda ulaşılamıyor.");
    this.name = "AdminAuthUnavailableError";
    this.cause = cause;
  }
}

/** Servis hesabı da buyur_admins'te durur ama bir insan değildir: panele
 *  giremez, admin listelerinde görünmez. */
export function isServiceAccountEmail(email: string | null | undefined): boolean {
  const service = process.env.PB_SERVICE_EMAIL?.trim().toLowerCase();
  return Boolean(service && email && email.trim().toLowerCase() === service);
}

/** PocketBase'in "token geçersiz / hesap yok" yanıtları. Bunların dışındaki
 *  hatalar altyapı arızasıdır. */
function isAuthRejection(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 400 || status === 401 || status === 403 || status === 404;
}

async function resolveSession(cookieValue: string | undefined): Promise<AdminSession | null> {
  const secret = readSessionSecret();
  if (!secret || !cookieValue) return null;
  const payload = openAdminCookie("session", cookieValue, secret);
  if (!payload) return null;

  const pb = createServerPB();
  pb.authStore.save(payload.token, null);
  try {
    const auth = await pb.collection(ADMIN_COLLECTION).authRefresh<Admin>({ requestKey: null });
    const admin = auth.record;
    if (!isAdminRole(admin.role) || isServiceAccountEmail(admin.email)) return null;
    return { pb, admin };
  } catch (err) {
    if (isAuthRejection(err)) return null;
    throw new AdminAuthUnavailableError(err);
  }
}

// Aynı istekte layout ve sayfa ayrı ayrı sorduğunda PocketBase'e tek tur gitsin.
const sessionFromCookies = cache(async (): Promise<AdminSession | null> => {
  const store = await cookies();
  return resolveSession(store.get(ADMIN_COOKIE_NAME)?.value);
});

/** Oturum varsa döner, yoksa null. Giriş ekranı gibi herkese açık yerler için. */
export async function getAdminSession(): Promise<AdminSession | null> {
  return sessionFromCookies();
}

/** Admin sayfalarının kapısı. Oturum yoksa giriş ekranına, işlem için yetki
 *  yoksa genel bakışa (açıklamasıyla) yönlendirir. */
export async function requireAdmin(options: { action?: AdminAction } = {}): Promise<AdminSession> {
  const session = await sessionFromCookies();
  if (!session) redirect("/admin/login");
  if (options.action && !canPerform(session.admin.role, options.action)) redirect("/admin?yetkisiz=1");
  return session;
}

export type AdminRequestResult =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

/** /api/admin uçlarının kapısı: 403 (başka site) → 401 (oturum yok) →
 *  403 (rol yetmiyor) → 503 (PocketBase'e ulaşılamıyor). */
export async function authenticateAdminRequest(
  req: NextRequest,
  options: { action?: AdminAction } = {}
): Promise<AdminRequestResult> {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return { ok: false, response: NextResponse.json({ error: "Geçersiz istek." }, { status: 403 }) };
  }
  let session: AdminSession | null;
  try {
    session = await resolveSession(req.cookies.get(ADMIN_COOKIE_NAME)?.value);
  } catch (err) {
    console.error("[admin-auth] oturum doğrulanamadı", err);
    return {
      ok: false,
      response: NextResponse.json({ error: "Yönetim paneline şu anda ulaşılamıyor." }, { status: 503 }),
    };
  }
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 }) };
  }
  if (options.action && !canPerform(session.admin.role, options.action)) {
    return { ok: false, response: NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 }) };
  }
  return { ok: true, session };
}

/** Admin çerezlerinin ortak ayarları. SameSite=Lax: e-postadaki bir
 *  bağlantıdan panele gelen admin oturumunu kaybetmesin; başka siteden gelen
 *  POST'lara çerez yine gitmez, ayrıca Origin kontrolü var. */
export function adminCookieOptions(maxAgeMs: number = ADMIN_SESSION_TTL_MS, path = "/") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
  };
}
