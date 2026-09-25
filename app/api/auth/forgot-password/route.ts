import { NextResponse, type NextRequest } from "next/server";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { findBusinessByEmail } from "@/lib/business-auth";
import { PASSWORD_RESET_SITE_URL, isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { canResendOtp, isValidEmail, normalizeEmail } from "@/lib/otp";
import { clearOtpRecords, createResetRecord, findOtpRecord } from "@/lib/otp-store";
import {
  RESET_TTL_MINUTES,
  generateResetToken,
  hashResetToken,
  resetExpiresAt,
  resetUrl,
} from "@/lib/password-reset";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

// Şifremi unuttum — birinci adım: kayıtlı adrese tek kullanımlık sıfırlama
// bağlantısı gönderir.
//
// Hesabın var olup olmadığı yanıttan anlaşılmaz: kayıtlı olsun olmasın aynı
// cevap döner. Aksi hâlde bu uç, hangi e-postaların buyur'da hesabı olduğunu
// sorgulamaya yarayan bir araca dönüşür.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aynı IP'den saatte en fazla bu kadar istek. */
const withinRateLimit = createRateLimiter(10, 3_600_000);

/** Her durumda dönen yanıt — hesap varlığını sızdırmaz. */
function accepted() {
  return NextResponse.json({ ok: true, ttlMinutes: RESET_TTL_MINUTES });
}

export async function POST(req: NextRequest) {
  if (!hasServiceCredentials() || !isEmailConfigured()) {
    return NextResponse.json({ error: "E-posta servisi yapılandırılmamış. Yöneticinize başvurun." }, { status: 503 });
  }

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi gir." }, { status: 400 });
  }
  const email = normalizeEmail(body.email);

  if (!withinRateLimit(clientIp(req))) {
    return NextResponse.json({ error: "Çok fazla istek gönderildi. Biraz sonra tekrar dene." }, { status: 429 });
  }

  try {
    const pb = await getServicePB();

    const user = await findBusinessByEmail(pb, email);
    if (!user) return accepted();

    // Art arda basılan "gönder" gelen kutusunu doldurmasın; yanıt yine aynı.
    const pending = await findOtpRecord(pb, email, "password_reset");
    if (pending && !canResendOtp(pending.created)) return accepted();

    const token = generateResetToken();
    await clearOtpRecords(pb, email, "password_reset");
    const record = await createResetRecord(pb, email, hashResetToken(token), resetExpiresAt());

    try {
      await sendPasswordResetEmail(email, user.name ?? "", resetUrl(PASSWORD_RESET_SITE_URL, token), RESET_TTL_MINUTES);
    } catch (err) {
      // Mail gitmediyse geride kullanıcının bilmediği geçerli bir bağlantı kalmasın.
      await clearOtpRecords(pb, email, "password_reset").catch(() => undefined);
      console.error("[forgot-password] mail gönderilemedi", record.id, err);
      return NextResponse.json({ error: "E-posta şu anda gönderilemiyor, biraz sonra tekrar dene." }, { status: 502 });
    }

    return accepted();
  } catch (err) {
    console.error("[forgot-password] hata", err);
    return NextResponse.json({ error: "İstek işlenemedi, tekrar dene." }, { status: 500 });
  }
}
