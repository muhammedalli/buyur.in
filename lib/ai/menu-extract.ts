// Kaynaktan menü çıkarma (yalnızca sunucu): fotoğraf/PDF, metin ve bağlantı.
// Model çıktısı her zaman lib/ai/menu-scan.ts normalize katmanından geçer:
// okunamayan fiyat null kalır, uydurulmaz.
//
// Bağlantı okuma kademelidir (readMenuLink): düz okuma → gerçek tarayıcıda
// açma → sayfadaki menü görselleri. Bir kademe ürün bulursa sonrakine
// geçilmez; her kademe model çağrısı demektir.

import type OpenAI from "openai";
import { MENU_MODEL } from "@/lib/ai/guard";
import { buildTextExtractionPrompt } from "@/lib/ai/menu-assistant";
import { fetchMenuSource, fetchRenderedPage, MAX_SOURCE_CHARS } from "@/lib/ai/menu-link";
import { buildScanPrompt, normalizeScanResult, type MenuPage, type ScanResult } from "@/lib/ai/menu-scan";

/** Sayfadan görsel olarak taranacak en fazla resim. */
const MAX_LINK_IMAGES = 4;

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
  calls: number;
}

export function emptyUsage(): AiUsage {
  return { input_tokens: 0, output_tokens: 0, calls: 0 };
}

export function addUsage(total: AiUsage, response: { usage?: { input_tokens?: number; output_tokens?: number } | null }) {
  total.calls += 1;
  total.input_tokens += response.usage?.input_tokens ?? 0;
  total.output_tokens += response.usage?.output_tokens ?? 0;
}

export function safeJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function productCount(scan: ScanResult): number {
  return scan.categories.reduce((sum, category) => sum + category.products.length, 0);
}

export async function extractFromPages(client: OpenAI, pages: MenuPage[], usage: AiUsage): Promise<ScanResult> {
  const content: Record<string, unknown>[] = [{ type: "input_text", text: buildScanPrompt("Türkçe") }];
  pages.forEach((page, index) => {
    content.push(
      page.kind === "image"
        ? { type: "input_image", image_url: page.data, detail: "high" }
        : { type: "input_file", filename: `menu-${index + 1}.pdf`, file_data: page.data }
    );
  });
  const response = await client.responses.create({
    model: MENU_MODEL,
    input: [{ role: "user", content: content as never }],
    text: { format: { type: "json_object" } },
    max_output_tokens: 16000,
  });
  addUsage(usage, response);
  return normalizeScanResult(safeJson(response.output_text));
}

export async function extractFromText(client: OpenAI, sourceLabel: string, text: string, usage: AiUsage): Promise<ScanResult> {
  const response = await client.responses.create({
    model: MENU_MODEL,
    input: [
      { role: "system", content: buildTextExtractionPrompt(sourceLabel) },
      { role: "user", content: text.slice(0, MAX_SOURCE_CHARS) },
    ],
    text: { format: { type: "json_object" } },
    max_output_tokens: 16000,
  });
  addUsage(usage, response);
  return normalizeScanResult(safeJson(response.output_text));
}

export interface LinkReadResult {
  scan: ScanResult | null;
  /** Sonucun etiketi (alan adı) ya da neden okunamadığı. */
  host: string;
  /** Hangi yoldan okundu: yöneticiye kısa bilgi. */
  via: "sayfa" | "tarayıcı" | "görsel" | "dosya" | null;
  error?: string;
}

/** Bağlantıdan menü okur. Hata fırlatmaz (model hatası hariç); okunamazsa
 *  nedeniyle döner. */
export async function readMenuLink(client: OpenAI, link: string, usage: AiUsage): Promise<LinkReadResult> {
  let host = link;
  try {
    host = new URL(link).hostname;
  } catch {
    /* adres hatası aşağıda söylenir */
  }
  const images = new Set<string>();

  // 1) Düz okuma.
  const direct = await fetchMenuSource(link);
  if (!direct.ok && direct.blocked) return { scan: null, host, via: null, error: direct.error };
  if (direct.ok && direct.kind !== "text") {
    return { scan: await extractFromPages(client, [{ kind: direct.kind, data: direct.dataUrl }], usage), host, via: "dosya" };
  }
  if (direct.ok) {
    direct.images.forEach((href) => images.add(href));
    const label = `${direct.title ? `"${direct.title}" başlıklı ` : ""}bir web sayfasının (${host}) metni ve gömülü verisi`;
    const scan = await extractFromText(client, label, direct.text, usage);
    if (productCount(scan) > 0) return { scan, host, via: "sayfa" };
  } else {
    direct.images?.forEach((href) => images.add(href));
  }

  // 2) Sayfayı gerçek tarayıcıda açarak (JS ile yüklenen QR menüler).
  const rendered = await fetchRenderedPage(link);
  if (rendered.ok && rendered.kind === "text") {
    rendered.images.forEach((href) => images.add(href));
    const label = `${rendered.title ? `"${rendered.title}" başlıklı ` : ""}tarayıcıda açılmış bir web sayfasının (${host}) içeriği (Markdown)`;
    const scan = await extractFromText(client, label, rendered.text, usage);
    if (productCount(scan) > 0) return { scan, host, via: "tarayıcı" };
  } else if (!rendered.ok) {
    rendered.images?.forEach((href) => images.add(href));
  }

  // 3) Menüsü resim olarak yüklenmiş sayfalar: görselleri tek tek (aynı
  //    güvenlik kurallarıyla) indirip görsel olarak tara.
  const pages: MenuPage[] = [];
  for (const href of images) {
    if (pages.length >= MAX_LINK_IMAGES) break;
    const image = await fetchMenuSource(href);
    if (image.ok && (image.kind === "image" || image.kind === "pdf")) {
      // Küçük görseller (ikon, ürün küçük resmi) menü sayfası olamaz.
      if (image.kind === "image" && image.dataUrl.length < 40_000) continue;
      pages.push({ kind: image.kind, data: image.dataUrl });
    }
  }
  if (pages.length > 0) {
    const scan = await extractFromPages(client, pages, usage);
    if (productCount(scan) > 0) return { scan, host, via: "görsel" };
  }

  return {
    scan: null,
    host,
    via: null,
    error: "Bu bağlantıda menü bulunamadı. Sayfa giriş istiyor ya da menüyü göstermiyor olabilir; menünün ekran görüntülerini veya PDF'ini ekleyin.",
  };
}
