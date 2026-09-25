import { NextResponse, type NextRequest } from "next/server";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import {
  OTP_MAX_ATTEMPTS,
  hashOtpCode,
  isOtpExpired,
  isValidEmail,
  isValidOtpCode,
  matchesOtpHash,
  normalizeEmail,
} from "@/lib/otp";
import { bumpOtpAttempts, clearOtpRecords, findOtpRecord } from "@/lib/otp-store";
import { checkSignupPhone } from "@/lib/phone";
import { newPasswordError } from "@/lib/password";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { initialPlanFields } from "@/lib/plan-period";

// Kayıt akışının ikinci adımı: kodu doğrular ve işletme hesabını açar.
// 1 işletme hesabı = 1 buyur_businesses kaydı = 1 kimlik: giriş bilgileri,
// işletme adı ve telefon aynı kayda yazılır. Hesap oluşturma bilinçli olarak
// sunucuda: createRule yalnızca servis hesabına açık olduğu için doğrulama
// adımı atlanamaz. Menü adresi (slug) kurulum ekranında seçilene kadar kayıt
// yayında değildir.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasServiceCredentials()) {
    return NextResponse.json({ error: "Kayıt servisi yapılandırılmamış. Yöneticinize başvurun." }, { status: 503 });
  }

  let body: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    passwordConfirm?: unknown;
    code?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : password;
  const passwordError = newPasswordError(password, passwordConfirm);

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "İşletme adını gir." }, { status: 400 });
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi gir." }, { status: 400 });
  }
  // Telefon doğrulanıp tek biçime getirilir ve işletme kaydına yazılır.
  const phone = checkSignupPhone(body.phone);
  if (!phone.ok) {
    return NextResponse.json({ error: phone.error }, { status: 400 });
  }
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (!isValidOtpCode(body.code)) {
    return NextResponse.json({ error: "Doğrulama kodu 6 haneli olmalı." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const code = body.code.trim();

  try {
    const pb = await getServicePB();

    const record = await findOtpRecord(pb, email);
    if (!record) {
      return NextResponse.json({ error: "Doğrulama kodu bulunamadı, yeni bir kod iste." }, { status: 400 });
    }
    if (isOtpExpired(record.expires_at)) {
      await clearOtpRecords(pb, email);
      return NextResponse.json({ error: "Kodun süresi doldu, yeni bir kod iste." }, { status: 400 });
    }
    if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await clearOtpRecords(pb, email);
      return NextResponse.json({ error: "Çok fazla hatalı deneme. Yeni bir kod iste." }, { status: 429 });
    }
    if (!matchesOtpHash(record.code_hash, hashOtpCode(email, code))) {
      await bumpOtpAttempts(pb, record);
      return NextResponse.json({ error: "Kod hatalı, tekrar dene." }, { status: 400 });
    }

    const defaultPlan = await pb
      .collection("buyur_plans")
      .getFirstListItem<{ key: string; trial_months?: number }>("is_default = true", { requestKey: null })
      .catch(() => null);

    try {
      await pb.collection(BUSINESS_COLLECTION).create(
        {
          email,
          password,
          passwordConfirm: password,
          emailVisibility: false,
          name,
          slug: "",
          phone: phone.value,
          is_active: false,
          ...initialPlanFields(defaultPlan),
        },
        { requestKey: null }
      );
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      if (data?.email) {
        await clearOtpRecords(pb, email);
        return NextResponse.json({ error: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene." }, { status: 409 });
      }
      throw err;
    }

    // Not: PocketBase'in `verified` bayrağı bilerek işaretlenmiyor. Alan yalnızca
    // superuser'a açık, servis hesabı 400 alıyor; üstelik uygulamada hiçbir yer
    // okumuyor — adresin kanıtı zaten OTP'nin kendisi.
    await clearOtpRecords(pb, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register] hata", err);
    return NextResponse.json({ error: "Kayıt oluşturulamadı, tekrar dene." }, { status: 500 });
  }
}
