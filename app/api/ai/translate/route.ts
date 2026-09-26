// AI ile çoklu dil içerik üretimi.
//
// Modele YALNIZCA metin gönderilir: fiyat, sayı, para birimi ve alerjen verisi
// bu uçtan geçmez, dolayısıyla model değiştiremez. Dönen çeviriler de
// lib/ai/translate.ts'teki süzgeçten geçer (istenmeyen dil, tanınmayan alan ve
// boş değer elenir) ve KAYDA YAZILMAZ — kullanıcı panelde onaylar.
//
// Süre: model çağrısı kendi zaman aşımıyla sınırlıdır ve fonksiyon süresinin
// içinde kalır. Aksi hâlde platform isteği yarıda keser, istemciye JSON
// olmayan bir hata sayfası döner ve kullanıcı "hiçbir şey olmadı" sanırdı.

import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest, openaiClient, isGuardFailure, MENU_MODEL, aiErrorResponse } from "@/lib/ai/guard";
import { aiTokenUsage, recordAiAction } from "@/lib/system-audit";
import {
  sanitizeEntries,
  resolveTargetLocales,
  normalizeTranslationResult,
  missingLocales,
  buildTranslationPrompt,
} from "@/lib/ai/translate";
import { activeLocales, localeLabels, mainLocale } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Model çağrısının üst sınırı; tek bir yeniden denemeyle fonksiyon süresine sığar. */
const OPENAI_TIMEOUT_MS = 25_000;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const guard = await guardAiRequest(req.headers.get("authorization"), body.businessId, "ai_translation");
  if (isGuardFailure(guard)) return guard.response;
  const { business } = guard;

  // Dil çözümü panelle aynı yardımcılardan: butonun gösterdiği hedef dillerle
  // sunucunun kabul ettikleri ayrışmasın.
  const main = mainLocale(business);
  const targetLocales = resolveTargetLocales(body.locales, main, activeLocales(business));
  if (targetLocales.length === 0) {
    return NextResponse.json(
      { error: "Çeviri için ana dil dışında en az bir menü dili açık olmalı (Ayarlar → Menü dilleri)." },
      { status: 400 }
    );
  }

  const entries = sanitizeEntries(body.entries);
  if (entries.length === 0) {
    return NextResponse.json({ error: "Çevrilecek metin yok. Önce ana dildeki alanları doldurun." }, { status: 400 });
  }

  const openai = openaiClient();
  if (isGuardFailure(openai)) return openai.response;

  try {
    const response = await openai.responses.create(
      {
        model: MENU_MODEL,
        input: [
          { role: "system", content: buildTranslationPrompt(targetLocales, localeLabels) },
          {
            role: "user",
            content: JSON.stringify({
              sourceLocale: main,
              items: entries.map((entry) => ({ id: entry.id, kind: entry.kind, fields: entry.fields })),
            }),
          },
        ],
        text: { format: { type: "json_object" } },
        max_output_tokens: 8000,
      },
      { timeout: OPENAI_TIMEOUT_MS, maxRetries: 1 }
    );

    if (response.status === "incomplete") {
      return NextResponse.json(
        { error: "Çeviri yarım kaldı; metin çok uzun olabilir. Daha kısa bir metinle tekrar deneyin.", retryable: false },
        { status: 502 }
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(response.output_text || "{}");
    } catch {
      // Model bir sonraki denemede büyük olasılıkla geçerli JSON döner.
      return NextResponse.json({ error: "Çeviri sonucu okunamadı. Tekrar deneyin.", retryable: true }, { status: 502 });
    }

    const allowedIds = new Set(entries.map((entry) => entry.id));
    const normalized = normalizeTranslationResult(raw, targetLocales, allowedIds);

    if (normalized.size === 0) {
      return NextResponse.json(
        { error: "Yapay zekâ bu metin için çeviri üretemedi. Metni kontrol edip tekrar deneyin." },
        { status: 422 }
      );
    }

    recordAiAction(req, business, "ai.translate", {
      model: MENU_MODEL,
      locales: targetLocales,
      items: normalized.size,
      ...aiTokenUsage(response),
    });
    return NextResponse.json({
      locales: targetLocales,
      missing: missingLocales(normalized, targetLocales),
      items: [...normalized.entries()].map(([id, translations]) => ({ id, translations })),
    });
  } catch (error) {
    console.error("Yapay zekâ çeviri hatası:", error);
    return aiErrorResponse(error, "Yapay zekâ çeviri yaparken beklenmeyen bir hata oluştu. Tekrar deneyin.");
  }
}
