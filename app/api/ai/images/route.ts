// Ürün adına göre açık lisanslı görsel arama.
//
// Bu uç yalnızca ADAY döndürür; ürüne yazma kararı paneldedir.
//
// `best` OTOMATİK akış içindir ve yalnızca künye gerektirmeyen lisanslardan
// seçilir. `images` hepsini döndürür: kullanıcı atıf gerektiren bir görseli
// bilerek seçebilir, menüde künyesi otomatik gösterilir.
//
// Akışı asla bloklamaz: sonuç bulunamazsa boş liste ve `best: null` döner,
// panel ürünü görselsiz oluşturmaya devam eder.

import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest, isGuardFailure } from "@/lib/ai/guard";
import { toEnglishFoodQuery } from "@/lib/ai/image-query";
import { recordAiAction } from "@/lib/system-audit";
import { buildImageQuery, configuredProviders, pickAutoImage, searchProductImages } from "@/lib/ai/images";
import { msg } from "@/lib/ui-i18n";

const MAX_QUERY_LENGTH = 150;
// Panel seçicisi çeşitlilik ister; otomatik akış varsayılan 8 ile yetinir.
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 36;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: msg("Geçersiz istek.") }, { status: 400 });
  }

  const guard = await guardAiRequest(req.headers.get("authorization"), body.businessId, "ai_menu_import");
  if (isGuardFailure(guard)) return guard.response;

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_QUERY_LENGTH) : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, MAX_QUERY_LENGTH) : "";

  if (name === "" && category === "") {
    return NextResponse.json({ error: msg("Arama için ürün adı gerekli.") }, { status: 400 });
  }

  const requested = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.floor(body.limit) : DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested));

  try {
    const englishName = name === "" ? "" : await toEnglishFoodQuery(name);
    const images = await searchProductImages(name, category, limit, englishName);
    recordAiAction(req, guard.business, "ai.image_search", { query: name || category, results: images.length });
    return NextResponse.json({
      images,
      best: pickAutoImage(images, buildImageQuery(name, category)),
      configured: configuredProviders().length > 0,
    });
  } catch (error) {
    console.error("Görsel arama hatası:", error);
    return NextResponse.json({ images: [], best: null, configured: true });
  }
}
