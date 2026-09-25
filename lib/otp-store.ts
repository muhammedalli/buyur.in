// OTP kayıtlarının PocketBase tarafı. Koleksiyon yalnızca servis hesabına açık
// (buyur_admins) — kodların özeti bile tarayıcıya ulaşmamalı.

import type PocketBase from "pocketbase";
import { hashOtpCode, normalizeEmail, otpExpiresAt } from "@/lib/otp";

export const OTP_COLLECTION = "buyur_otps";

export interface OtpRecord {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  /** "password_reset" ya da boş (kayıt kodu). Eski kayıtlarda alan yoktur. */
  purpose?: string;
  created: string;
}

/** Kayıt kodu ile şifre sıfırlama kaydı aynı koleksiyonda durur ama birbirine
 *  dokunmaz: biri kayıt ucuna yanlış kod göndererek başkasının sıfırlama
 *  bağlantısını geçersiz kılamamalı. Ayrım bilerek filtrede değil burada
 *  yapılır — `purpose` alanı şemaya eklenmemiş bir kurulumda filtre 400 verir. */
export type OtpPurpose = "register" | "password_reset";

function purposeOf(record: OtpRecord): OtpPurpose {
  return record.purpose === "password_reset" ? "password_reset" : "register";
}

async function recordsFor(pb: PocketBase, email: string, purpose: OtpPurpose): Promise<OtpRecord[]> {
  const records = await pb.collection(OTP_COLLECTION).getFullList<OtpRecord>({
    filter: pb.filter("email = {:email}", { email: normalizeEmail(email) }),
    sort: "-created",
    requestKey: null,
  });
  return records.filter((record) => purposeOf(record) === purpose);
}

/** Bir adresin bekleyen kaydı (en yenisi). Yoksa null. */
export async function findOtpRecord(
  pb: PocketBase,
  email: string,
  purpose: OtpPurpose = "register"
): Promise<OtpRecord | null> {
  return (await recordsFor(pb, email, purpose))[0] ?? null;
}

/** Bir adrese ait aynı amaçlı tüm kayıtları siler. Yeni kod üretilmeden ve
 *  işlem tamamlandıktan sonra çağrılır: aynı anda iki geçerli kod dolaşmamalı. */
export async function clearOtpRecords(pb: PocketBase, email: string, purpose: OtpPurpose = "register"): Promise<void> {
  const records = await recordsFor(pb, email, purpose);
  await Promise.all(
    records.map((record) =>
      pb.collection(OTP_COLLECTION).delete(record.id, { requestKey: null }).catch(() => undefined)
    )
  );
}

export async function createOtpRecord(pb: PocketBase, email: string, code: string): Promise<OtpRecord> {
  return pb.collection(OTP_COLLECTION).create<OtpRecord>(
    {
      email: normalizeEmail(email),
      code_hash: hashOtpCode(email, code),
      expires_at: otpExpiresAt(),
      attempts: 0,
      purpose: "register",
    },
    { requestKey: null }
  );
}

/** Şifre sıfırlama kaydı. `purpose` alanı şemada yoksa PocketBase onu yok
 *  sayar; belirtecin kendisi yine güvenlidir (özet öneki, bkz.
 *  lib/password-reset.ts) ama kayıt kodlarıyla ayrım için
 *  scripts/setup-pocketbase.mjs'in çalıştırılmış olması gerekir. */
export async function createResetRecord(pb: PocketBase, email: string, tokenHash: string, expiresAt: string) {
  return pb.collection(OTP_COLLECTION).create<OtpRecord>(
    {
      email: normalizeEmail(email),
      code_hash: tokenHash,
      expires_at: expiresAt,
      attempts: 0,
      purpose: "password_reset",
    },
    { requestKey: null }
  );
}

/** Belirteç özetiyle eşleşen sıfırlama kaydı. Yoksa null. */
export async function findResetRecord(pb: PocketBase, tokenHash: string): Promise<OtpRecord | null> {
  try {
    const record = await pb
      .collection(OTP_COLLECTION)
      .getFirstListItem<OtpRecord>(pb.filter("code_hash = {:hash}", { hash: tokenHash }), { requestKey: null });
    // Alan şemada varsa ve kayıt başka amaçlıysa kabul edilmez.
    return record.purpose && record.purpose !== "password_reset" ? null : record;
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
}

export async function bumpOtpAttempts(pb: PocketBase, record: OtpRecord): Promise<void> {
  await pb
    .collection(OTP_COLLECTION)
    .update(record.id, { attempts: (record.attempts ?? 0) + 1 }, { requestKey: null })
    .catch(() => undefined);
}
