// Şifre sıfırlama bağlantısını üretip gönderen ortak akış. Hem "şifremi
// unuttum" ekranı (app/api/auth/forgot-password) hem yönetim paneli (destek
// ekibinin "sıfırlama e-postası gönder" işlemi) aynı yolu kullanır: bağlantı
// yalnızca hesap sahibinin e-postasına gider, admin şifreyi kendisi görmez
// ya da koymaz.

import type PocketBase from "pocketbase";
import { PASSWORD_RESET_SITE_URL, sendPasswordResetEmail } from "@/lib/email";
import { canResendOtp } from "@/lib/otp";
import { clearOtpRecords, createResetRecord, findOtpRecord } from "@/lib/otp-store";
import { RESET_TTL_MINUTES, generateResetToken, hashResetToken, resetExpiresAt, resetUrl } from "@/lib/password-reset";

export type ResetMailResult = "sent" | "throttled";

/** Servis hesabıyla çağrılır (buyur_otps yalnızca ona açık). Son bir dakikada
 *  gönderilmişse yenisini göndermez ("throttled"). E-posta gönderilemezse
 *  bekleyen bağlantıyı siler ve hatayı fırlatır: geride kimsenin bilmediği
 *  geçerli bir bağlantı kalmasın. */
export async function sendPasswordResetLink(
  service: PocketBase,
  account: { email: string; name?: string }
): Promise<ResetMailResult> {
  const pending = await findOtpRecord(service, account.email, "password_reset");
  if (pending && !canResendOtp(pending.created)) return "throttled";

  const token = generateResetToken();
  await clearOtpRecords(service, account.email, "password_reset");
  await createResetRecord(service, account.email, hashResetToken(token), resetExpiresAt());

  try {
    await sendPasswordResetEmail(account.email, account.name ?? "", resetUrl(PASSWORD_RESET_SITE_URL, token), RESET_TTL_MINUTES);
  } catch (err) {
    await clearOtpRecords(service, account.email, "password_reset").catch(() => undefined);
    throw err;
  }
  return "sent";
}
