import { NextResponse, type NextRequest } from "next/server";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { findBusinessByEmail } from "@/lib/business-auth";
import { isOtpExpired } from "@/lib/otp";
import { clearOtpRecords, findResetRecord, type OtpRecord } from "@/lib/otp-store";
import { hashResetToken, isValidResetToken } from "@/lib/password-reset";
import { newPasswordError } from "@/lib/password";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { auditRequestContext, recordSystemAudit } from "@/lib/system-audit";

// Şifremi unuttum — ikinci adım: bağlantıdaki belirteci doğrular ve yeni
// şifreyi yazar.
//
// Gövdede `password` yoksa yalnızca belirtecin geçerliliği döner: sayfa açılır
// açılmaz "bağlantı geçersiz" diyebilsin, kullanıcı boşuna şifre yazmasın.
// Şifre servis hesabıyla güncellenir (buyur_businesses manageRule); PocketBase
// şifre değişince hesabın tüm eski oturumlarını geçersiz kılar.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const withinRateLimit = createRateLimiter(30, 3_600_000);

const INVALID_LINK = "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı iste.";

export async function POST(req: NextRequest) {
  if (!hasServiceCredentials()) {
    return NextResponse.json({ error: "Şifre sıfırlama servisi yapılandırılmamış. Yöneticinize başvurun." }, { status: 503 });
  }

  let body: { token?: unknown; password?: unknown; passwordConfirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (!withinRateLimit(clientIp(req))) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Biraz sonra tekrar dene." }, { status: 429 });
  }

  if (!isValidResetToken(body.token)) {
    return NextResponse.json({ error: INVALID_LINK, code: "invalid_token" }, { status: 400 });
  }

  const checkOnly = body.password === undefined;
  if (!checkOnly) {
    const passwordError = newPasswordError(body.password, body.passwordConfirm);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  try {
    const pb = await getServicePB();

    const record: OtpRecord | null = await findResetRecord(pb, hashResetToken(body.token));
    if (!record) {
      return NextResponse.json({ error: INVALID_LINK, code: "invalid_token" }, { status: 400 });
    }
    if (isOtpExpired(record.expires_at)) {
      await clearOtpRecords(pb, record.email, "password_reset");
      return NextResponse.json({ error: INVALID_LINK, code: "invalid_token" }, { status: 400 });
    }

    const user = await findBusinessByEmail(pb, record.email);
    if (!user) {
      // Hesap bu arada silinmiş: bağlantının bir karşılığı kalmadı.
      await clearOtpRecords(pb, record.email, "password_reset");
      return NextResponse.json({ error: INVALID_LINK, code: "invalid_token" }, { status: 400 });
    }

    if (checkOnly) return NextResponse.json({ ok: true, valid: true });

    const password = body.password as string;
    await pb
      .collection(BUSINESS_COLLECTION)
      .update(user.id, { password, passwordConfirm: password }, { requestKey: null });

    // Tek kullanımlık: aynı bağlantıyla ikinci kez şifre değiştirilemez.
    await clearOtpRecords(pb, record.email, "password_reset");
    await recordSystemAudit({
      actor: { type: "business", id: user.id, email: record.email },
      action: "business.password_reset_done",
      targetCollection: BUSINESS_COLLECTION,
      targetId: user.id,
      ...auditRequestContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] hata", err);
    return NextResponse.json({ error: "Şifre güncellenemedi, tekrar dene." }, { status: 500 });
  }
}
