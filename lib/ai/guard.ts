// AI uçlarının ortak kapısı. Sıra değişmez: kimlik → oturum → sahiplik →
// yetki. Her AI route'u bu kapıdan geçer; kontrolü tek tek kopyalamak
// birinde atlanmasına yol açar.
//
// Yalnızca sunucuda çalışır — OPENAI_API_KEY buradan okunur ve hiçbir zaman
// istemciye dönmez.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerPB } from "@/lib/pocketbase";
import { isFeatureAvailable, type Feature } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { authenticateBusiness } from "@/lib/business-auth";
import type { Business } from "@/lib/types";

/** Menü görseli/PDF'i okuyabilen model. Ortamdan değiştirilebilir. */
export const MENU_MODEL = process.env.OPENAI_MENU_MODEL ?? "gpt-4.1-mini";

export interface GuardSuccess {
  ok: true;
  business: Business;
  userId: string;
  pb: ReturnType<typeof createServerPB>;
}

export interface GuardFailure {
  ok: false;
  response: NextResponse;
}

function fail(error: string, status: number): GuardFailure {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/** Kimlik, sahiplik ve plan yetkisini sırayla doğrular.
 *  `feature` verilirse o yetenek kapalıysa 403 döner. */
export async function guardAiRequest(
  authHeader: string | null,
  businessId: unknown,
  feature?: Feature
): Promise<GuardSuccess | GuardFailure> {
  if (!authHeader) return fail("Giriş yapmalısınız.", 401);

  // Oturumun sahibi işletme kaydının kendisidir; ayrı sahiplik sorgusu yok.
  const [session] = await Promise.all([authenticateBusiness(authHeader), ensurePlanCatalog(createServerPB())]);
  if (!session) return fail("Oturum geçersiz.", 401);

  if (typeof businessId !== "string" || businessId.trim() === "") {
    return fail("Geçersiz istek.", 400);
  }
  if (businessId !== session.business.id) {
    return fail("Bu işletmeye erişiminiz yok.", 403);
  }
  const { business, pb } = session;
  const userId = business.id;

  if (feature && !isFeatureAvailable(business, feature)) {
    return fail("Bu özellik mevcut planınızda kullanılamıyor.", 403);
  }

  return { ok: true, business, userId, pb };
}

/** OpenAI istemcisi. Anahtar tanımlı değilse kurulum hatasını açıkça söyler. */
export function openaiClient(): OpenAI | GuardFailure {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail("Yapay zekâ servisi yapılandırılmamış. Yöneticinize başvurun.", 503);
  }
  return new OpenAI({ apiKey });
}

export function isGuardFailure(value: unknown): value is GuardFailure {
  return typeof value === "object" && value !== null && (value as GuardFailure).ok === false;
}
