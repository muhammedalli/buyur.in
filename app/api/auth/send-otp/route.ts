import { NextResponse, type NextRequest } from "next/server";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { findBusinessByEmail } from "@/lib/business-auth";
import { isEmailConfigured, sendOtpEmail } from "@/lib/email";
import {
  OTP_TTL_MINUTES,
  canResendOtp,
  generateOtpCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/otp";
import { clearOtpRecords, createOtpRecord, findOtpRecord } from "@/lib/otp-store";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

// Kayıt akışının ilk adımı: adrese 6 haneli doğrulama kodu gönderir.
// Kod burada üretilir ve yalnızca özeti saklanır; yanıt hiçbir koşulda kodu
// taşımaz — yoksa doğrulama tiyatrodan ibaret olur.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aynı IP'den saatte gönderilebilecek kod sayısı. Gerçek bir kullanıcı bir
 *  kayıt için 1-2 kod ister; üstü deneme/spam demektir. */
const withinRateLimit = createRateLimiter(10, 3_600_000);

export async function POST(req: NextRequest) {
  if (!hasServiceCredentials() || !isEmailConfigured()) {
    return NextResponse.json({ error: "E-posta servisi yapılandırılmamış. Yöneticinize başvurun." }, { status: 503 });
  }

  let body: { name?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi gir." }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";

  if (!withinRateLimit(clientIp(req))) {
    return NextResponse.json({ error: "Çok fazla kod istendi. Biraz sonra tekrar dene." }, { status: 429 });
  }

  try {
    const pb = await getServicePB();

    // Zaten kayıtlı adrese kod göndermeyiz: kullanıcı kayıt yerine giriş yapmalı.
    if (await findBusinessByEmail(pb, email)) {
      return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene." }, { status: 409 });
    }

    const existing = await findOtpRecord(pb, email);
    if (existing && !canResendOtp(existing.created)) {
      return NextResponse.json({ error: "Yeni kod istemek için biraz bekle." }, { status: 429 });
    }

    const code = generateOtpCode();
    await clearOtpRecords(pb, email);
    const record = await createOtpRecord(pb, email, code);

    try {
      await sendOtpEmail(email, name, code, OTP_TTL_MINUTES);
    } catch (err) {
      // Mail gitmediyse ortada kullanıcının bilmediği bir kod kalmasın.
      await clearOtpRecords(pb, email).catch(() => undefined);
      console.error("[send-otp] mail gönderilemedi", record.id, err);
      return NextResponse.json({ error: "Doğrulama e-postası gönderilemedi, tekrar dene." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
  } catch (err) {
    console.error("[send-otp] hata", err);
    return NextResponse.json({ error: "Doğrulama kodu gönderilemedi, tekrar dene." }, { status: 500 });
  }
}
