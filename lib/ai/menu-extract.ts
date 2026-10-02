// Kaynaktan menü çıkarma (yalnızca sunucu): fotoğraf/PDF, metin ve bağlantı.
// Model çıktısı her zaman lib/ai/menu-scan.ts normalize katmanından geçer:
// okunamayan fiyat null kalır, uydurulmaz.
//
// Bağlantı okuma kademelidir (readMenuLink): düz okuma → aynı sitedeki alt
// sayfalar → gerçek tarayıcıda açma → sayfadaki menü görselleri. Bir kademe
// yeterli ürün bulursa sonrakine geçilmez; her kademe model çağrısı demektir.
//
// Metinden çıkarılan her sonuç kaynağın kendisiyle sınanır (groundScan): adı
// kaynakta geçmeyen ürün atılır, kaynakta geçmeyen fiyat silinir. Model
// "uydurma" kuralını her zaman tutmuyor; kural kodda.

import type OpenAI from "openai";
import { MENU_MODEL } from "@/lib/ai/guard";
import { buildTextExtractionPrompt, groundScan } from "@/lib/ai/menu-assistant";
import { fetchMenuSource, fetchRenderedPage, MAX_SOURCE_CHARS } from "@/lib/ai/menu-link";
import { buildScanPrompt, normalizeScanResult, type MenuPage, type ScanResult } from "@/lib/ai/menu-scan";

/** Sayfadan görsel olarak taranacak en fazla resim. */
const MAX_LINK_IMAGES = 4;
/** İzlenecek en fazla alt sayfa ve aynı anda okunan sayfa. */
const MAX_SUBPAGES = 12;
const SUBPAGE_CONCURRENCY = 4;
/** Tek model çağrısına giden alt sayfa metni (çıktı kesilmesin diye bölünür). */
const CHUNK_CHARS = 30_000;
/** Sayfada bundan az ürün çıktıysa alt sayfalara da bakılır. */
const CRAWL_BELOW = 8;
/** "16 ürün", "5 çeşit" gibi kategori kartı sayaçları: ürünler alt sayfadadır. */
const COUNT_HINT = /\b\d+\s*(ürün|urun|çeşit|cesit|items?|products?)\b/i;

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

/** Metinden çıkarır ve sonucu metnin kendisiyle sınar. `dropped`: adı
 *  kaynakta geçmediği için atılan (uydurulmuş) ürün sayısı. */
export async function extractGrounded(
  client: OpenAI,
  sourceLabel: string,
  text: string,
  usage: AiUsage
): Promise<{ scan: ScanResult; dropped: number }> {
  const source = text.slice(0, MAX_SOURCE_CHARS);
  const grounded = groundScan(await extractFromText(client, sourceLabel, source, usage), source);
  return { scan: grounded.scan, dropped: grounded.droppedProducts };
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
  via: "sayfa" | "alt sayfa" | "tarayıcı" | "görsel" | "dosya" | null;
  /** Okunan alt sayfa sayısı (via "alt sayfa"). */
  pages?: number;
  /** Kaynakta adı geçmediği için atılan ürün sayısı. */
  dropped: number;
  error?: string;
}

function combineScans(scans: ScanResult[]): ScanResult {
  return {
    categories: scans.flatMap((scan) => scan.categories),
    currency: scans.find((scan) => scan.currency)?.currency ?? "",
    uncertainCount: scans.reduce((sum, scan) => sum + scan.uncertainCount, 0),
  };
}

/** Alt sayfayı okur: önce düz, boş iskelet gelirse tarayıcıda. */
async function readSubpage(url: string): Promise<{ url: string; text: string } | null> {
  const direct = await fetchMenuSource(url);
  if (direct.ok && direct.kind === "text") return { url, text: direct.text };
  if (!direct.ok && direct.blocked) return null;
  const rendered = await fetchRenderedPage(url);
  return rendered.ok && rendered.kind === "text" ? { url, text: rendered.text } : null;
}

/** Alt sayfaları sınırlı eşzamanlılıkla okur, metinleri sayfa başlıklı
 *  parçalara böler ve her parçayı ayrı (paralel) çıkarır. */
async function readSubpages(client: OpenAI, links: string[], host: string, usage: AiUsage) {
  const queue = links.slice(0, MAX_SUBPAGES);
  const pages: { url: string; text: string }[] = [];
  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift()!;
      const page = await readSubpage(url).catch(() => null);
      if (page) pages.push(page);
    }
  };
  await Promise.all(Array.from({ length: SUBPAGE_CONCURRENCY }, worker));
  if (pages.length === 0) return { scan: null, pages: 0, dropped: 0 };
  // Sayfa sırası bağlantı sırasıdır (kategori sırası korunur).
  pages.sort((a, b) => links.indexOf(a.url) - links.indexOf(b.url));

  const chunks: string[] = [];
  let current = "";
  for (const page of pages) {
    const block = `## Sayfa: ${new URL(page.url).pathname}\n${page.text.slice(0, CHUNK_CHARS)}\n\n`;
    if (current && current.length + block.length > CHUNK_CHARS) {
      chunks.push(current);
      current = "";
    }
    current += block;
  }
  if (current) chunks.push(current);

  const label = `bir menü sitesinin (${host}) alt sayfalarının metni`;
  const results = await Promise.all(chunks.map((chunk) => extractGrounded(client, label, chunk, usage)));
  const scan = combineScans(results.map((result) => result.scan));
  return {
    scan: productCount(scan) > 0 ? scan : null,
    pages: pages.length,
    dropped: results.reduce((sum, result) => sum + result.dropped, 0),
  };
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
  const links: string[] = [];
  const crawled = new Set<string>();
  let dropped = 0;
  let best: ScanResult | null = null;
  let via: LinkReadResult["via"] = null;
  let countHint = false;
  let pagesRead = 0;

  const consider = (scan: ScanResult | null, from: LinkReadResult["via"]) => {
    if (scan && productCount(scan) > (best ? productCount(best) : 0)) {
      best = scan;
      via = from;
    }
  };
  const enough = () => best !== null && productCount(best) >= CRAWL_BELOW && !countHint;
  const crawl = async () => {
    const fresh = links.filter((href) => !crawled.has(href));
    if (fresh.length === 0) return;
    fresh.forEach((href) => crawled.add(href));
    const result = await readSubpages(client, fresh, host, usage);
    dropped += result.dropped;
    if (!result.scan) return;
    pagesRead += result.pages;
    // Ana sayfadaki ürünler (öne çıkanlar) alt sayfalarla birleşir; tekrarı
    // taslağa eklerken mergeExtracted ayıklar.
    const combined: ScanResult = best ? combineScans([result.scan, best]) : result.scan;
    best = combined;
    via = "alt sayfa";
  };

  // 1) Düz okuma.
  const direct = await fetchMenuSource(link);
  if (!direct.ok && direct.blocked) return { scan: null, host, via: null, dropped: 0, error: direct.error };
  if (direct.ok && direct.kind !== "text") {
    return { scan: await extractFromPages(client, [{ kind: direct.kind, data: direct.dataUrl }], usage), host, via: "dosya", dropped: 0 };
  }
  if (direct.ok) {
    direct.images.forEach((href) => images.add(href));
    links.push(...direct.links);
    countHint = COUNT_HINT.test(direct.text);
    const label = `${direct.title ? `"${direct.title}" başlıklı ` : ""}bir web sayfasının (${host}) metni ve gömülü verisi`;
    const result = await extractGrounded(client, label, direct.text, usage);
    dropped += result.dropped;
    consider(productCount(result.scan) > 0 ? result.scan : null, "sayfa");
  } else {
    direct.images?.forEach((href) => images.add(href));
    links.push(...(direct.links ?? []));
  }

  // 2) Menüyü kategori sayfalarına bölen siteler: alt sayfalar.
  if (!enough()) await crawl();

  // 3) Sayfayı gerçek tarayıcıda açarak (JS ile yüklenen QR menüler).
  if (!best) {
    const rendered = await fetchRenderedPage(link);
    if (rendered.ok && rendered.kind === "text") {
      rendered.images.forEach((href) => images.add(href));
      rendered.links.forEach((href) => !links.includes(href) && links.push(href));
      countHint = countHint || COUNT_HINT.test(rendered.text);
      const label = `${rendered.title ? `"${rendered.title}" başlıklı ` : ""}tarayıcıda açılmış bir web sayfasının (${host}) içeriği (Markdown)`;
      const result = await extractGrounded(client, label, rendered.text, usage);
      dropped += result.dropped;
      consider(productCount(result.scan) > 0 ? result.scan : null, "tarayıcı");
    } else if (!rendered.ok) {
      rendered.images?.forEach((href) => images.add(href));
      rendered.links?.forEach((href) => !links.includes(href) && links.push(href));
    }
    if (!enough()) await crawl();
  }
  if (best) return { scan: best, host, via, pages: via === "alt sayfa" ? pagesRead : undefined, dropped };

  // 4) Menüsü resim olarak yüklenmiş sayfalar: görselleri tek tek (aynı
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
    if (productCount(scan) > 0) return { scan, host, via: "görsel", dropped };
  }

  return {
    scan: null,
    host,
    via: null,
    dropped,
    error: "Bu bağlantıda menü bulunamadı. Sayfa giriş istiyor ya da menüyü göstermiyor olabilir; menünün ekran görüntülerini veya PDF'ini ekleyin.",
  };
}
