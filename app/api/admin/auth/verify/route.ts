import { NextResponse, type NextRequest } from "next/server";
import { createServerPB } from "@/lib/pocketbase";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { ADMIN_COLLECTION, adminCookieOptions, isServiceAccountEmail } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { ADMIN_COOKIE_NAME, ADMIN_PENDING_COOKIE_NAME, ADMIN_PENDING_COOKIE_PATH } from "@/lib/admin-cookie";
import { isAdminRole } from "@/lib/admin-roles";
import {
  ADMIN_SESSION_TTL_MS,
  isSameOrigin,
  openAdminCookie,
  readSessionSecret,
  sealAdminCookie,
} from "@/lib/admin-session";
import { OTP_MAX_ATTEMPTS, hashOtpCode, isOtpExpired, isValidOtpCode, matchesOtpHash } from "@/lib/otp";
import { bumpOtpAttempts, clearOtpRecords, findOtpRecord } from "@/lib/otp-store";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import type { Admin } from "@/lib/types";

// Admin girişinin ikinci adımı: e-posta kodunu doğrular ve oturumu açar.
// Kod, şifresi az önce doğrulanan hesaba bağlıdır: e-posta ara çerezden okunur,
// istekten değil — başkasının adresine gelen kodla giriş yapılamaz.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const withinRateLimit = createRateLimiter(20, 15 * 60_000);

/** İstemci bu yanıtta şifre adımına döner. */
function restart(message: string, status = 400) {
  const res = NextResponse.json({ error: message, restart: true }, { status });
  res.cookies.set(ADMIN_PENDING_COOKIE_NAME, "", adminCookieOptions(0, ADMIN_PENDING_COOKIE_PATH));
  return res;
}

export async function POST(req: NextRequest) {
  const secret = readSessionSecret();
  if (!secret || !hasServiceCredentials()) {
    return NextResponse.json({ error: "Yönetim girişi yapılandırılmamış." }, { status: 503 });
  }
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  }

  const pending = openAdminCookie("pending", req.cookies.get(ADMIN_PENDING_COOKIE_NAME)?.value, secret);
  if (!pending) return restart("Giriş süresi doldu. E-posta ve şifrenle yeniden başla.");

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!isValidOtpCode(body.code)) {
    return NextResponse.json({ error: "Kod 6 haneli olmalı." }, { status: 400 });
  }
  const code = body.code.trim();

  if (!withinRateLimit(clientIp(req))) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene." }, { status: 429 });
  }

  const email = pending.email;
  try {
    const service = await getServicePB();
    const record = await findOtpRecord(service, email, "admin_login");
    if (!record) return restart("Giriş kodu bulunamadı. Yeniden başla.");
    if (isOtpExpired(record.expires_at)) {
      await clearOtpRecords(service, email, "admin_login");
      return restart("Kodun süresi doldu. Yeniden başla.");
    }
    if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await clearOtpRecords(service, email, "admin_login");
      return restart("Çok fazla hatalı deneme. Yeniden başla.", 429);
    }
    if (!matchesOtpHash(record.code_hash, hashOtpCode(email, code))) {
      await bumpOtpAttempts(service, record);
      return NextResponse.json({ error: "Kod hatalı, tekrar dene." }, { status: 400 });
    }
    await clearOtpRecords(service, email, "admin_login");
  } catch (err) {
    console.error("[admin-verify] kod doğrulanamadı", err);
    return NextResponse.json({ error: "Kod doğrulanamadı, tekrar dene." }, { status: 500 });
  }

  // Kod doğru. Token hâlâ geçerli mi, hesap hâlâ admin mi? Kod beklenirken
  // şifre değişmiş ya da hesap silinmiş olabilir. Yenilenen token oturuma girer.
  const pb = createServerPB();
  pb.authStore.save(pending.token, null);
  let admin: Admin;
  try {
    const auth = await pb.collection(ADMIN_COLLECTION).authRefresh<Admin>({ requestKey: null });
    admin = auth.record;
  } catch {
    return restart("Oturum doğrulanamadı. Yeniden başla.");
  }
  if (!isAdminRole(admin.role) || isServiceAccountEmail(admin.email)) {
    return restart("Bu hesapla yönetim paneline girilemez.", 403);
  }

  // Giriş kaydı en iyi çabayla yazılır: kayıt koleksiyonundaki bir arıza
  // yöneticileri panelin dışında bırakmamalı (bkz. lib/admin-audit.ts).
  await recordAdminAction(pb, {
    admin,
    action: "admin.login",
    targetCollection: ADMIN_COLLECTION,
    targetId: admin.id,
    ip: clientIp(req),
  }).catch((err) => console.error("[admin-verify] giriş kaydı yazılamadı", admin.id, err));

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    ADMIN_COOKIE_NAME,
    sealAdminCookie("session", { token: pb.authStore.token, email: admin.email, exp: Date.now() + ADMIN_SESSION_TTL_MS }, secret),
    adminCookieOptions(ADMIN_SESSION_TTL_MS)
  );
  res.cookies.set(ADMIN_PENDING_COOKIE_NAME, "", adminCookieOptions(0, ADMIN_PENDING_COOKIE_PATH));
  return res;
}
