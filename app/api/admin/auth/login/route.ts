import { NextResponse, type NextRequest } from "next/server";
import { createServerPB } from "@/lib/pocketbase";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { ADMIN_COLLECTION, adminCookieOptions, isServiceAccountEmail } from "@/lib/admin-auth";
import { ADMIN_PENDING_COOKIE_NAME, ADMIN_PENDING_COOKIE_PATH } from "@/lib/admin-cookie";
import { isAdminRole } from "@/lib/admin-roles";
import { ADMIN_PENDING_TTL_MS, isSameOrigin, readSessionSecret, sealAdminCookie } from "@/lib/admin-session";
import { isEmailConfigured, sendAdminLoginCodeEmail } from "@/lib/email";
import { OTP_TTL_MINUTES, canResendOtp, generateOtpCode, isValidEmail, normalizeEmail } from "@/lib/otp";
import { clearOtpRecords, createOtpRecord, findOtpRecord } from "@/lib/otp-store";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import type { Admin } from "@/lib/types";

// Admin girişinin ilk adımı: şifreyi doğrular, e-postaya giriş kodu gönderir.
// Şifre tek başına oturum açmaz — admin hesabı bütün işletmelerin anahtarı,
// sızan bir şifre yetmemeli. Token bu adımda tarayıcıya verilmez; şifreli
// "kod bekleniyor" çerezine konur ve yalnızca doğrulama ucu açabilir.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aynı IP'den 15 dakikada en fazla 10 şifre denemesi. */
const withinRateLimit = createRateLimiter(10, 15 * 60_000);

const INVALID_CREDENTIALS = "E-posta veya şifre hatalı.";

export async function POST(req: NextRequest) {
  const secret = readSessionSecret();
  if (!secret || !hasServiceCredentials()) {
    return NextResponse.json({ error: "Yönetim girişi yapılandırılmamış." }, { status: 503 });
  }
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!isValidEmail(body.email) || !password) {
    return NextResponse.json({ error: "E-posta ve şifreni gir." }, { status: 400 });
  }
  const email = normalizeEmail(body.email);

  if (!withinRateLimit(clientIp(req))) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene." }, { status: 429 });
  }

  // Servis hesabının şifresi sunucu ortamında durur; o şifreyle panele
  // girilebilseydi ortam değişkenlerini gören herkes yönetici olurdu.
  if (isServiceAccountEmail(email)) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  // Kod e-postayla gider. Üretimde e-posta servisi yoksa kimse giremez (kod
  // adımı atlanamaz); yalnızca geliştirmede kod sunucu günlüğüne düşer.
  const emailConfigured = isEmailConfigured();
  if (!emailConfigured && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "E-posta servisi yapılandırılmamış." }, { status: 503 });
  }

  let token: string;
  let admin: Admin;
  try {
    const auth = await createServerPB()
      .collection(ADMIN_COLLECTION)
      .authWithPassword<Admin>(email, password, { requestKey: null });
    token = auth.token;
    admin = auth.record;
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }
    console.error("[admin-login] PocketBase'e ulaşılamadı", err);
    return NextResponse.json({ error: "Şu anda giriş yapılamıyor. Biraz sonra tekrar dene." }, { status: 503 });
  }
  if (!isAdminRole(admin.role)) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  try {
    const service = await getServicePB();
    const existing = await findOtpRecord(service, email, "admin_login");
    if (existing && !canResendOtp(existing.created)) {
      return NextResponse.json({ error: "Yeni kod istemek için biraz bekle." }, { status: 429 });
    }

    const code = generateOtpCode();
    await clearOtpRecords(service, email, "admin_login");
    await createOtpRecord(service, email, code, "admin_login");

    if (emailConfigured) {
      try {
        await sendAdminLoginCodeEmail(email, admin.name ?? "", code, OTP_TTL_MINUTES);
      } catch (err) {
        await clearOtpRecords(service, email, "admin_login").catch(() => undefined);
        console.error("[admin-login] kod e-postası gönderilemedi", err);
        return NextResponse.json({ error: "Giriş kodu gönderilemedi, tekrar dene." }, { status: 502 });
      }
    } else {
      console.warn(`[admin-login] e-posta servisi yok; geliştirme giriş kodu (${email}): ${code}`);
    }
  } catch (err) {
    console.error("[admin-login] giriş kodu oluşturulamadı", err);
    return NextResponse.json({ error: "Giriş kodu oluşturulamadı, tekrar dene." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
  res.cookies.set(
    ADMIN_PENDING_COOKIE_NAME,
    sealAdminCookie("pending", { token, email, exp: Date.now() + ADMIN_PENDING_TTL_MS }, secret),
    adminCookieOptions(ADMIN_PENDING_TTL_MS, ADMIN_PENDING_COOKIE_PATH)
  );
  return res;
}
