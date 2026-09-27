// Bir menü BAĞLANTISINDAN içerik okuma (yalnızca sunucu).
//
// Sunucu, yöneticinin verdiği adrese istek atar: bu bir SSRF kapısıdır. Bu
// yüzden adres ve her yönlendirme adımı ayrı ayrı doğrulanır: yalnızca
// http(s), standart port, kullanıcı adı/şifresiz; ad çözümlemesi iç ağ, döngü
// ya da bulut meta veri adresine çıkıyorsa istek atılmaz. Süre ve boyut
// sınırlıdır.
//
// QR menü platformlarının çoğu menüyü tarayıcıda (JS ile) oluşturur; düz
// okumada HTML boş iskelet gelir. Bu yüzden okuma üç kademelidir (sıra
// lib/ai/menu-extract.ts → readMenuLink'te):
//  1) düz okuma (gömülü JSON-LD / __NEXT_DATA__ / Nuxt verisi dahil),
//  2) sayfayı gerçek tarayıcıda açan okuyucu (fetchRenderedPage, Jina Reader),
//  3) sayfadaki menü görselleri (menüsünü resim olarak yükleyen işletmeler).
// Hiçbiri sonuç vermezse uydurulmaz; yöneticiye açıkça söylenir.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
/** Modele gidecek metnin üst sınırı (~20k token). */
export const MAX_SOURCE_CHARS = 60_000;
/** Bundan kısa metin "sayfa boş geldi" sayılır. */
const MIN_TEXT_CHARS = 120;
/** Tarayıcıda açma (JS'in çalışması dahil) için süre. */
const RENDER_TIMEOUT_MS = 30_000;
const READER_BASE = "https://r.jina.ai/";

export type LinkSource =
  | { ok: true; kind: "text"; text: string; title: string; url: string; images: string[] }
  | { ok: true; kind: "image"; dataUrl: string; url: string }
  | { ok: true; kind: "pdf"; dataUrl: string; url: string }
  /** `blocked`: adres güvenlik kuralına takıldı; başka yoldan da denenmez. */
  | { ok: false; error: string; url: string; blocked?: boolean; images?: string[] };

/** IPv4/IPv6 adresi iç ağ, döngü, bağlantı-yerel ya da ayrılmış bir blokta mı. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/** Adresin biçim kontrolü (ağa çıkmadan). Geçerliyse URL, değilse hata metni. */
export function checkMenuUrl(raw: string): URL | string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "Bağlantı okunamadı. Tam adresi (https:// ile) yapıştırın.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Yalnızca http(s) bağlantıları okunabilir.";
  if (url.username || url.password) return "Kullanıcı adı/şifre içeren bağlantılar okunmaz.";
  if (url.port && url.port !== "80" && url.port !== "443") return "Standart dışı port içeren bağlantılar okunmaz.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "İç ağ adresleri okunmaz.";
  }
  if (isIP(host) && isPrivateAddress(host)) return "İç ağ adresleri okunmaz.";
  return url;
}

async function resolvesPublic(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** HTML'den menü okumaya yarayan metni çıkarır: görünür metin + gömülü veri
 *  (JSON-LD, __NEXT_DATA__, Nuxt/Vue durum nesneleri). Saf; test edilir. */
export function htmlToMenuText(html: string): { text: string; title: string } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

  const embedded: string[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attrs = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    if (!body) continue;
    const isJsonLd = /type\s*=\s*["']application\/ld\+json["']/i.test(attrs);
    const isNextData = /id\s*=\s*["']__NEXT_DATA__["']/i.test(attrs);
    const isStateBlob = /window\.__(NUXT|INITIAL_STATE|APOLLO_STATE|PRELOADED_STATE)__/.test(body) || /type\s*=\s*["']application\/json["']/i.test(attrs);
    if (isJsonLd || isNextData || isStateBlob) embedded.push(body.slice(0, MAX_SOURCE_CHARS));
  }

  const visible = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v\r]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  const parts = [visible];
  if (embedded.length > 0) parts.push("GÖMÜLÜ VERİ:\n" + embedded.join("\n\n"));
  return { text: parts.join("\n\n").slice(0, MAX_SOURCE_CHARS), title };
}

async function readLimited(res: Response): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return null;
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Sayfadaki görsel bağlantıları (HTML <img>/og:image ya da Markdown ![](…)).
 *  Menüsünü resim olarak yükleyen işletmeler için son çare: logo, ikon ve
 *  vektör dosyaları elenir; adında "menu/menü" geçenler öne alınır. Saf. */
export function extractImageLinks(source: string, baseUrl: string, limit = 12): string[] {
  const found: string[] = [];
  const patterns = [
    /<img\b[^>]*?\s(?:data-src|src)\s*=\s*["']([^"']+)["']/gi,
    /<meta\b[^>]*?property\s*=\s*["']og:image["'][^>]*?content\s*=\s*["']([^"']+)["']/gi,
    /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(decodeEntities(match[1] ?? ""));
  }
  const skip = /(logo|icon|favicon|sprite|avatar|flag|badge|placeholder|loading|spinner|pixel|tracking|qr)/i;
  const urls: string[] = [];
  for (const raw of found) {
    let url: URL;
    try {
      url = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const path = url.pathname.toLowerCase();
    if (/\.(svg|ico|gif)$/.test(path) || skip.test(path)) continue;
    if (!urls.includes(url.href)) urls.push(url.href);
  }
  const menuFirst = (href: string) => (/(menu|men%c3%bc|menü|fiyat|price)/i.test(href) ? 0 : 1);
  return urls.sort((a, b) => menuFirst(a) - menuFirst(b)).slice(0, limit);
}

/** Sayfayı gerçek bir tarayıcıda açıp oluşan içeriği okur (Jina Reader).
 *  JS ile yüklenen QR menüler için gereklidir. Adres önce aynı güvenlik
 *  kurallarından geçer; okuyucuya yalnızca herkese açık bir menü adresi gider.
 *  MENU_LINK_RENDERER=off ile kapatılır; JINA_API_KEY varsa kotası yükselir. */
export async function fetchRenderedPage(raw: string): Promise<LinkSource> {
  const checked = checkMenuUrl(raw);
  if (typeof checked === "string") return { ok: false, error: checked, url: raw, blocked: true };
  if (process.env.MENU_LINK_RENDERER === "off") return { ok: false, error: "Tarayıcı ile okuma kapalı.", url: checked.href };
  if (!(await resolvesPublic(checked.hostname))) {
    return { ok: false, error: "Bu bağlantının sunucusuna ulaşılamadı ya da iç ağ adresine çıkıyor.", url: checked.href, blocked: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-With-Images-Summary": "true",
      "X-No-Cache": "true",
      "X-Timeout": String(Math.floor(RENDER_TIMEOUT_MS / 1000) - 5),
      "X-Locale": "tr-TR",
    };
    const key = process.env.JINA_API_KEY?.trim();
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${READER_BASE}${checked.href}`, { headers, signal: controller.signal });
    const body = (await res.json().catch(() => null)) as {
      data?: { title?: string; content?: string; images?: Record<string, string> | null };
    } | null;
    if (!res.ok || !body?.data) {
      return { ok: false, error: res.status === 429 ? "Sayfa okuyucu şu an yoğun; biraz sonra tekrar deneyin." : "Sayfa tarayıcıyla da açılamadı.", url: checked.href };
    }
    const content = (body.data.content ?? "").slice(0, MAX_SOURCE_CHARS);
    const images = [...new Set([...Object.values(body.data.images ?? {}), ...extractImageLinks(content, checked.href)])].filter((href) => {
      try {
        return typeof checkMenuUrl(href) !== "string";
      } catch {
        return false;
      }
    });
    if (content.replace(/\s+/g, "").length < MIN_TEXT_CHARS) {
      return { ok: false, error: "Sayfada okunabilir metin yok.", url: checked.href, images };
    }
    return { ok: true, kind: "text", text: content, title: body.data.title ?? "", url: checked.href, images };
  } catch (error) {
    const aborted = (error as { name?: string })?.name === "AbortError";
    return { ok: false, error: aborted ? "Sayfa tarayıcıda zamanında açılmadı." : "Sayfa tarayıcıyla açılamadı.", url: checked.href };
  } finally {
    clearTimeout(timer);
  }
}

/** Bağlantıyı okur. Hata fırlatmaz; her sonuç kullanıcıya söylenebilir. */
export async function fetchMenuSource(raw: string): Promise<LinkSource> {
  const checked = checkMenuUrl(raw);
  if (typeof checked === "string") return { ok: false, error: checked, url: raw, blocked: true };

  let url = checked;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      if (!(await resolvesPublic(url.hostname))) {
        return { ok: false, error: "Bu bağlantının sunucusuna ulaşılamadı ya da iç ağ adresine çıkıyor.", url: url.href, blocked: true };
      }
      const res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; buyur-menu-import/1.0; +https://buyur.in)",
          Accept: "text/html,application/xhtml+xml,application/json,image/*,application/pdf;q=0.9,*/*;q=0.5",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.6",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || hop >= MAX_REDIRECTS) return { ok: false, error: "Bağlantı çok fazla yönlendirme yaptı.", url: url.href };
        const next = checkMenuUrl(new URL(location, url).href);
        if (typeof next === "string") return { ok: false, error: next, url: url.href, blocked: true };
        url = next;
        continue;
      }
      if (!res.ok) {
        return { ok: false, error: `Sayfa açılamadı (HTTP ${res.status}). Bağlantıyı tarayıcıda kontrol edin.`, url: url.href };
      }

      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const body = await readLimited(res);
      if (!body) return { ok: false, error: "Sayfa çok büyük (3 MB üstü); ekran görüntüsü ya da PDF yükleyin.", url: url.href };

      if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(type)) {
        return { ok: true, kind: "image", dataUrl: `data:${type};base64,${Buffer.from(body).toString("base64")}`, url: url.href };
      }
      if (type === "application/pdf") {
        return { ok: true, kind: "pdf", dataUrl: `data:application/pdf;base64,${Buffer.from(body).toString("base64")}`, url: url.href };
      }

      const content = new TextDecoder("utf-8", { fatal: false }).decode(body);
      if (type.includes("json")) {
        return { ok: true, kind: "text", text: content.slice(0, MAX_SOURCE_CHARS), title: "", url: url.href, images: [] };
      }
      if (type && !type.includes("html") && !type.startsWith("text/")) {
        return { ok: false, error: "Bu bağlantı bir web sayfası, görsel ya da PDF değil.", url: url.href };
      }

      const isHtml = !type.startsWith("text/plain");
      const { text, title } = isHtml ? htmlToMenuText(content) : { text: content.slice(0, MAX_SOURCE_CHARS), title: "" };
      const images = isHtml ? extractImageLinks(content, url.href) : [];
      if (text.replace(/\s+/g, "").length < MIN_TEXT_CHARS) {
        return { ok: false, error: "Sayfa boş iskelet olarak geldi (menü tarayıcıda yükleniyor).", url: url.href, images };
      }
      return { ok: true, kind: "text", text, title, url: url.href, images };
    }
  } catch (error) {
    const aborted = (error as { name?: string })?.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "Sayfa zamanında yanıt vermedi. Bağlantıyı kontrol edip tekrar deneyin." : "Sayfaya bağlanılamadı. Bağlantıyı kontrol edin.",
      url: raw,
    };
  } finally {
    clearTimeout(timer);
  }
}
