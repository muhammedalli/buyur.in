// Fiziksel menü tarama: fotoğraf veya PDF → kategori/ürün/fiyat çıkarımı.
//
// Model çıktısı doğrudan döndürülmez; lib/ai/menu-scan.ts normalize katmanından
// geçer. Okunamayan alanlar tahmin edilmez, "uncertain" olarak işaretlenir ve
// kullanıcı önizlemede düzeltir. Kayda yazma bu uçta YAPILMAZ — içe aktarma
// kullanıcının onayından sonra panelde gerçekleşir.

import { NextRequest, NextResponse } from "next/server";
import { getServicePB } from "@/lib/pocketbase-server";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { guardAiRequest, openaiClient, isGuardFailure, MENU_MODEL } from "@/lib/ai/guard";
import { aiTokenUsage, recordAiAction } from "@/lib/system-audit";
import { localeLabels, mainLocale } from "@/lib/i18n";
import { buildScanPrompt, normalizeScanResult } from "@/lib/ai/menu-scan";
import { aiUsage, aiPeriodKey } from "@/lib/entitlements";

/** Tek bir sayfanın veri URI üst sınırı (~8MB base64 ≈ 6MB dosya). */
const MAX_PAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_PREFIX = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;
const PDF_PREFIX = /^data:application\/pdf;base64,/;

type Page = { kind: "image"; data: string } | { kind: "pdf"; data: string };

// ── Çift tarama koruması ────────────────────────────────────────────────
//
// İşletme "Tara" düğmesine iki kez bastığında ya da ikinci sekmeyi açtığında
// aynı menü iki kez okunur: kotadan iki hak gider ve panelde iki ayrı sonuç
// seti belirir — kullanıcı ikisini de aktarırsa menü çift kayıtla dolar.
//
// Bellekteki kilit sunucu örneğine özeldir (ölçekte kusursuz değil); asıl
// tekrar koruması aktarım tarafındaki idempotent plandır (lib/ai/import-plan).
// Burası kullanıcıyı boşa harcanan kotadan korur.
const inFlight = new Set<string>();
const recentScans = new Map<string, number>();

/** Aynı dosyaların yeniden taranmasının "kaza" sayıldığı süre. */
const REPEAT_WINDOW_MS = 15 * 60 * 1000;

function rememberScan(key: string, now: number) {
  recentScans.set(key, now);
  // Pencereden düşenleri temizle — harita süresiz büyümesin.
  for (const [entry, at] of recentScans) {
    if (now - at > REPEAT_WINDOW_MS) recentScans.delete(entry);
  }
}

/** Girdiyi doğrular: yalnızca beklenen veri URI biçimleri ve boyut sınırı. */
function parsePages(value: unknown, maxPages: number): { pages: Page[] } | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Görsel bulunamadı." };
  }
  if (value.length > maxPages) {
    return { error: `Tek seferde en fazla ${maxPages} sayfa menü tarayabilirsiniz.` };
  }

  const pages: Page[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return { error: "Geçersiz dosya biçimi." };
    if (entry.length > MAX_PAGE_BYTES) {
      return { error: "Dosyalardan biri çok büyük. Her sayfa en fazla 6 MB olmalı." };
    }
    if (IMAGE_PREFIX.test(entry)) {
      pages.push({ kind: "image", data: entry });
    } else if (PDF_PREFIX.test(entry)) {
      pages.push({ kind: "pdf", data: entry });
    } else {
      return { error: "Yalnızca görsel (jpg, png, webp) veya PDF yükleyebilirsiniz." };
    }
  }

  return { pages };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const guard = await guardAiRequest(req.headers.get("authorization"), body.businessId, "ai_menu_import");
  if (isGuardFailure(guard)) return guard.response;
  const { business } = guard;

  // Kota: plan başına aylık tarama hakkı (lib/entitlements.ts → aiUsage).
  const usage = aiUsage(business);
  if (usage.exhausted) {
    return NextResponse.json(
      { error: `Bu ay için yapay zekâ tarama hakkınız doldu (${usage.limit}/${usage.limit}). Gelecek ay yenilenir.` },
      { status: 429 }
    );
  }

  const parsed = parsePages(body.images, usage.pagesPerScan);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Sürmekte olan bir tarama varken ikincisi başlatılmaz.
  if (inFlight.has(business.id)) {
    return NextResponse.json(
      { error: "Bu işletme için bir menü taraması zaten sürüyor. Bitmesini bekleyin." },
      { status: 409, headers: { "x-buyur-scan": "in-flight" } }
    );
  }

  // Aynı dosyalar kısa süre içinde yeniden gönderildiyse kullanıcı onaylamadan
  // kota harcanmaz; panel "yine de tara" derse `force` ile geri gelir.
  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.slice(0, 128) : "";
  const repeatKey = fingerprint ? `${business.id}:${fingerprint}` : "";
  const now = Date.now();
  if (repeatKey && body.force !== true) {
    const lastAt = recentScans.get(repeatKey);
    if (lastAt !== undefined && now - lastAt < REPEAT_WINDOW_MS) {
      return NextResponse.json(
        {
          error: "Bu menü sayfalarını az önce taradınız. Sonucu panelde kontrol edin.",
          duplicate: true,
        },
        { status: 409, headers: { "x-buyur-scan": "duplicate" } }
      );
    }
  }

  const openai = openaiClient();
  if (isGuardFailure(openai)) return openai.response;

  inFlight.add(business.id);
  try {
    // Responses API görsel ve PDF'i aynı içerik dizisinde kabul eder; PDF'i
    // istemcide sayfa sayfa görsele çevirmeye gerek kalmıyor.
    const content: Record<string, unknown>[] = [{ type: "input_text", text: buildScanPrompt(localeLabels[mainLocale(business)]) }];
    parsed.pages.forEach((page, index) => {
      if (page.kind === "image") {
        content.push({ type: "input_image", image_url: page.data, detail: "high" });
      } else {
        content.push({ type: "input_file", filename: `menu-${index + 1}.pdf`, file_data: page.data });
      }
    });

    const response = await openai.responses.create({
      model: MENU_MODEL,
      input: [{ role: "user", content: content as never }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 8000,
    });

    let raw: unknown;
    try {
      raw = JSON.parse(response.output_text || "{}");
    } catch {
      return NextResponse.json(
        { error: "Menü okunamadı. Daha net bir fotoğrafla tekrar deneyin." },
        { status: 502 }
      );
    }

    const result = normalizeScanResult(raw);

    if (result.categories.length === 0) {
      return NextResponse.json(
        { error: "Menüde okunabilir ürün bulunamadı. Daha net ve düz çekilmiş bir fotoğrafla tekrar deneyin." },
        { status: 422 }
      );
    }

    // Kota yalnızca gerçekten sonuç üreten tarama için harcanır. Sayaç
    // servis hesabıyla yazılır: hesap sahibi kendi kaydında kota alanlarını
    // değiştiremez (aksi hâlde sayacı sıfırlayıp kotayı aşabilirdi).
    const period = aiPeriodKey();
    try {
      const service = await getServicePB();
      await service.collection(BUSINESS_COLLECTION).update(business.id, {
        ai_scans_used: usage.used + 1,
        ai_scans_period: period,
      });
    } catch (error) {
      // Sayaç yazılamazsa kullanıcıyı sonucundan etmeyelim; yalnızca logla.
      console.error("Yapay zekâ kota sayacı güncellenemedi:", error);
    }

    // Sonuç üreten tarama hatırlanır: aynı dosyalar yeniden gelirse uyarılır.
    if (repeatKey) rememberScan(repeatKey, Date.now());

    recordAiAction(req, business, "ai.menu_scan", {
      model: MENU_MODEL,
      pages: parsed.pages.length,
      categories: result.categories.length,
      products: result.categories.reduce((sum, category) => sum + category.products.length, 0),
      ...aiTokenUsage(response),
    });

    return NextResponse.json({
      ...result,
      fingerprint,
      usage: {
        used: usage.used + 1,
        limit: usage.limit,
        remaining: usage.limit === null ? null : Math.max(0, usage.limit - usage.used - 1),
      },
    });
  } catch (error) {
    console.error("Yapay zekâ menü tarama hatası:", error);
    return NextResponse.json({ error: "Yapay zekâ tarama yaparken bir hata oluştu." }, { status: 500 });
  } finally {
    inFlight.delete(business.id);
  }
}
