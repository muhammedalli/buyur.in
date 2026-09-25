import { NextResponse, type NextRequest } from "next/server";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { isAnalyticsEventType, isClientEmittableEvent, type AnalyticsEventType } from "@/lib/analytics/events";
import {
  deviceFromUserAgent,
  hostOf,
  normalizeSource,
  type DeviceType,
  type TrafficSource,
} from "@/lib/analytics/attribution";
import {
  SESSION_COOKIE,
  SESSION_TIMEOUT_MINUTES,
  VISITOR_COOKIE,
  VISITOR_TTL_DAYS,
  isValidAnalyticsId,
  newAnalyticsId,
} from "@/lib/analytics/session";
import type { MenuSession } from "@/lib/types";
import { isSuspended } from "@/lib/business-suspension";

// Menü ziyaretçi event'lerinin tek giriş kapısı. İstemci yalnızca "ne oldu"yu
// bildirir; kim/nereden/hangi cihaz bilgisi burada üretilir — böylece hem sahte
// event üretilemez hem de IP/geo gibi istemcinin bilemeyeceği veriler eklenebilir.
// Hiçbir hata menüyü bozmamalı: sorunlu durumlarda sessizce 204 dönüyoruz.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const PB_ID_RE = /^[a-z0-9]{15}$/;

const BUSINESS_CACHE_MS = 5 * 60_000;
const QR_CACHE_MS = 5 * 60_000;
const SESSION_CACHE_MS = (SESSION_TIMEOUT_MINUTES + 5) * 60_000;

/** Dakikada tek IP + işletme için üst sınır. Normal bir ziyaretçi bunun çok
 *  altında kalır; üstü bot/otomasyon demektir. */
const RATE_LIMIT_PER_MINUTE = 120;

interface CachedBusiness {
  id: string;
  expiresAt: number;
}

const businessCache = new Map<string, CachedBusiness>();
const qrCache = new Map<string, { id: string | null; expiresAt: number }>();
/** Sıcak yolda oturum kaydını tekrar okumamak için atıf da önbellekte tutulur —
 *  atıf oturum boyunca değişmediği için güvenli. */
const sessionCache = new Map<
  string,
  { id: string; businessId: string; startedAt: number; expiresAt: number; attribution: SessionAttribution }
>();
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function prune<T extends { expiresAt: number }>(map: Map<string, T>, now: number) {
  if (map.size < 500) return;
  for (const [key, value] of map) {
    if (value.expiresAt <= now) map.delete(key);
  }
}

/** Bilinen tarayıcı/crawler imzaları — bunların menü açılışı "müşteri
 *  görüntülemesi" sayılmaz (Freemium limiti bunlara takılmamalı). */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|lighthouse|pagespeed|headless|curl|wget|python-requests|axios|node-fetch/i;

function isBotAgent(userAgent: string): boolean {
  return BOT_PATTERN.test(userAgent);
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Sayaç yalnızca hız sınırı için tutulur; IP hiçbir yere yazılmaz. */
function withinRateLimit(ip: string, slug: string): boolean {
  const now = Date.now();
  const key = `${ip}:${slug}`;
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) if (v.resetAt <= now) rateBuckets.delete(k);
    }
    return true;
  }

  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_PER_MINUTE;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function relationId(value: unknown): string {
  const id = str(value, 20);
  return PB_ID_RE.test(id) ? id : "";
}

/** Küçük ve düz bir meta nesnesi bırakır — istemciden gelen serbest veri
 *  koleksiyonu şişirmesin diye anahtar/uzunluk sınırlı. */
function sanitizeMeta(value: unknown): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (count >= 8) break;
    if (!/^[a-z_]{1,24}$/.test(key)) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
    else if (typeof raw === "boolean") out[key] = raw;
    else if (typeof raw === "string") out[key] = raw.slice(0, 120);
    else continue;
    count += 1;
  }
  return count > 0 ? out : null;
}

function geoFromHeaders(req: NextRequest): { country: string; city: string } {
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-geo-country") ??
    "";
  const rawCity = req.headers.get("x-vercel-ip-city") ?? req.headers.get("cf-ipcity") ?? req.headers.get("x-geo-city") ?? "";
  let city = rawCity;
  try {
    city = decodeURIComponent(rawCity);
  } catch {
    /* bozuk kodlama: ham değeri bırak */
  }
  return { country: country.slice(0, 2).toUpperCase(), city: city.slice(0, 80) };
}

async function resolveBusinessId(
  pb: Awaited<ReturnType<typeof getServicePB>>,
  slug: string
): Promise<string | null> {
  const now = Date.now();
  const cached = businessCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.id;

  try {
    const business = await pb
      .collection("buyur_businesses")
      .getFirstListItem<{ id: string; suspended_at?: string }>(pb.filter("slug = {:slug} && is_active = true", { slug }), {
        fields: "id,suspended_at",
        requestKey: null,
      });
    // Askıdaki menü yayında değil: görüntülenmesi sayılmaz, event yazılmaz.
    if (isSuspended(business)) return null;
    prune(businessCache, now);
    businessCache.set(slug, { id: business.id, expiresAt: now + BUSINESS_CACHE_MS });
    return business.id;
  } catch {
    return null;
  }
}

async function resolveQrId(
  pb: Awaited<ReturnType<typeof getServicePB>>,
  businessId: string,
  code: string
): Promise<string | null> {
  if (!code) return null;
  const now = Date.now();
  const cacheKey = `${businessId}:${code}`;
  const cached = qrCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.id;

  let id: string | null = null;
  try {
    const record = await pb
      .collection("buyur_qr_codes")
      .getFirstListItem<{ id: string }>(
        pb.filter("business = {:business} && code = {:code} && is_active = true", { business: businessId, code }),
        { fields: "id", requestKey: null }
      );
    id = record.id;
  } catch {
    // Tanınmayan QR kodu: kaynak yine "qr" sayılır, sadece hangi QR olduğu bilinmez.
    id = null;
  }
  prune(qrCache, now);
  qrCache.set(cacheKey, { id, expiresAt: now + QR_CACHE_MS });
  return id;
}

/** Oturum boyunca sabit kalan atıf bilgisi (ilk temas). */
interface SessionAttribution {
  visitor: string;
  source: TrafficSource;
  medium: string;
  campaign: string;
  referrerHost: string;
  device: DeviceType;
  country: string;
  city: string;
  locale: string;
  qr: string;
}

interface SessionContext extends SessionAttribution {
  key: string;
  recordId: string;
  startedAt: number;
  isNew: boolean;
}

interface EntryParams {
  qr: string;
  src: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrer: string;
  path: string;
}

function readEntry(value: unknown): EntryParams {
  const entry = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    qr: str(entry.qr, 40),
    src: str(entry.src, 40),
    utmSource: str(entry.utm_source, 60),
    utmMedium: str(entry.utm_medium, 60),
    utmCampaign: str(entry.utm_campaign, 60),
    referrer: str(entry.referrer, 300),
    path: str(entry.path, 200),
  };
}

/** Var olan oturumu tazeler ya da yenisini açar. Yeni oturumda atıf (kaynak,
 *  cihaz, konum) bir kez hesaplanır ve oturum boyunca sabit kalır. */
async function ensureSession(args: {
  pb: Awaited<ReturnType<typeof getServicePB>>;
  req: NextRequest;
  businessId: string;
  slug: string;
  cookieSid: string | null;
  visitor: string;
  entry: EntryParams;
  locale: string;
  path: string;
}): Promise<SessionContext> {
  const { pb, req, businessId, slug, cookieSid, visitor, entry, locale, path } = args;
  const now = Date.now();

  if (cookieSid) {
    const cached = sessionCache.get(cookieSid);
    if (cached && cached.businessId === businessId && cached.expiresAt > now) {
      // Süre uzatılır: oturum ancak SESSION_TIMEOUT_MINUTES boyunca hiç event
      // gelmezse kapanır (kayan pencere).
      cached.expiresAt = now + SESSION_CACHE_MS;
      return {
        ...cached.attribution,
        key: cookieSid,
        recordId: cached.id,
        startedAt: cached.startedAt,
        isNew: false,
      };
    }

    try {
      const existing = await pb
        .collection("buyur_sessions")
        .getFirstListItem<MenuSession>(pb.filter("business = {:business} && key = {:key}", { business: businessId, key: cookieSid }), {
          requestKey: null,
        });
      const lastSeen = Date.parse(existing.last_seen_at || existing.started_at);
      if (Number.isFinite(lastSeen) && now - lastSeen < SESSION_TIMEOUT_MINUTES * 60_000) {
        const startedAt = Date.parse(existing.started_at) || now;
        const attribution: SessionAttribution = {
          visitor: existing.visitor || visitor,
          source: (existing.source || "direct") as TrafficSource,
          medium: existing.medium ?? "",
          campaign: existing.campaign ?? "",
          referrerHost: existing.referrer_host ?? "",
          device: (existing.device || "mobile") as DeviceType,
          country: existing.country ?? "",
          city: existing.city ?? "",
          locale: existing.locale || locale,
          qr: existing.qr ?? "",
        };
        prune(sessionCache, now);
        sessionCache.set(cookieSid, {
          id: existing.id,
          businessId,
          startedAt,
          expiresAt: now + SESSION_CACHE_MS,
          attribution,
        });
        return { ...attribution, key: cookieSid, recordId: existing.id, startedAt, isNew: false };
      }
    } catch {
      // Kayıt yok / okunamadı: yeni oturum açılır.
    }
  }

  // ─── Yeni oturum ───
  const key = newAnalyticsId();
  const userAgent = req.headers.get("user-agent") ?? "";
  const { country, city } = geoFromHeaders(req);
  const qrId = await resolveQrId(pb, businessId, entry.qr);
  const source = normalizeSource({
    qrCode: entry.qr,
    srcParam: entry.src,
    utmSource: entry.utmSource,
    referrer: entry.referrer,
    selfHost: req.headers.get("host")?.split(":")[0] ?? "",
  });

  let isReturning = false;
  try {
    const previous = await pb.collection("buyur_sessions").getList(1, 1, {
      filter: pb.filter("business = {:business} && visitor = {:visitor}", { business: businessId, visitor }),
      fields: "id",
      requestKey: null,
    });
    isReturning = previous.totalItems > 0;
  } catch {
    /* okunamadıysa "yeni ziyaretçi" varsayımı en az zararlı */
  }

  const nowIso = new Date(now).toISOString();
  const created = await pb.collection("buyur_sessions").create<MenuSession>(
    {
      business: businessId,
      key,
      visitor,
      started_at: nowIso,
      last_seen_at: nowIso,
      duration_sec: 0,
      events_count: 0,
      page_views: 0,
      product_views: 0,
      cart_adds: 0,
      source,
      medium: entry.utmMedium,
      campaign: entry.utmCampaign,
      referrer_host: entry.referrer.includes("://") ? hostOf(entry.referrer) : entry.referrer,
      device: deviceFromUserAgent(userAgent),
      country,
      city,
      locale,
      entry_path: entry.path || path,
      exit_path: entry.path || path,
      qr: qrId ?? "",
      is_returning: isReturning,
    },
    { requestKey: null }
  );

  const attribution: SessionAttribution = {
    visitor,
    source,
    medium: created.medium,
    campaign: created.campaign,
    referrerHost: created.referrer_host,
    device: created.device as DeviceType,
    country,
    city,
    locale,
    qr: qrId ?? "",
  };

  prune(sessionCache, now);
  sessionCache.set(key, {
    id: created.id,
    businessId,
    startedAt: now,
    expiresAt: now + SESSION_CACHE_MS,
    attribution,
  });

  const context: SessionContext = { ...attribution, key, recordId: created.id, startedAt: now, isNew: true };

  // Oturum açılışı ve (kaynağı QR ise) tarama sunucu tarafında kaydedilir;
  // istemci bu event'leri gönderemez (bkz. isClientEmittableEvent).
  await writeEvent(pb, businessId, context, { type: "session_start", target: slug, label: "Oturum başladı", path });
  if (source === "qr") {
    await writeEvent(pb, businessId, context, {
      type: "qr_scan",
      target: entry.qr || "qr",
      label: "QR tarama",
      path,
      qr: qrId ?? "",
    });
  }

  return context;
}

interface EventInput {
  type: AnalyticsEventType;
  target?: string;
  label?: string;
  path?: string;
  product?: string;
  category?: string;
  popup?: string;
  qr?: string;
  meta?: Record<string, string | number | boolean> | null;
}

async function writeEvent(
  pb: Awaited<ReturnType<typeof getServicePB>>,
  businessId: string,
  session: SessionContext,
  input: EventInput
): Promise<void> {
  await pb.collection("buyur_events").create(
    {
      business: businessId,
      type: input.type,
      target: input.target ?? "",
      label: input.label ?? "",
      session: session.key,
      visitor: session.visitor,
      product: input.product ?? "",
      category: input.category ?? "",
      popup: input.popup ?? "",
      qr: input.qr ?? session.qr ?? "",
      source: session.source,
      medium: session.medium,
      campaign: session.campaign,
      referrer_host: session.referrerHost,
      device: session.device,
      country: session.country,
      city: session.city,
      locale: session.locale,
      meta: input.meta ?? null,
      occurred_at: new Date().toISOString(),
    },
    { requestKey: null }
  );
}

/** Oturum sayaçlarını olay tipine göre günceller (PocketBase'in `alan+` artırma
 *  sözdizimiyle — okuma/yazma yarışını önler). */
async function touchSession(
  pb: Awaited<ReturnType<typeof getServicePB>>,
  session: SessionContext,
  type: AnalyticsEventType,
  path: string
): Promise<void> {
  const now = Date.now();
  const patch: Record<string, unknown> = {
    last_seen_at: new Date(now).toISOString(),
    duration_sec: Math.max(0, Math.round((now - session.startedAt) / 1000)),
    "events_count+": 1,
  };
  if (path) patch.exit_path = path;
  if (type === "page_view") patch["page_views+"] = 1;
  if (type === "product_view" || type === "product_detail_view") patch["product_views+"] = 1;
  if (type === "add_to_cart") patch["cart_adds+"] = 1;

  await pb.collection("buyur_sessions").update(session.recordId, patch, { requestKey: null });
}

function noContent(cookies?: { sid: string; secure: boolean }): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  if (cookies) {
    res.cookies.set(SESSION_COOKIE, cookies.sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookies.secure,
      path: "/",
      maxAge: SESSION_TIMEOUT_MINUTES * 60,
    });
  }
  return res;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return new NextResponse(null, { status: 400 });

  const slug = str(body.slug, 60).toLowerCase();
  const type = body.type;
  if (!SLUG_RE.test(slug) || !isAnalyticsEventType(type) || !isClientEmittableEvent(type)) {
    return new NextResponse(null, { status: 400 });
  }

  // Servis hesabı tanımlı değilse (ör. yeni bir ortam) analitik sessizce kapalı
  // kalır — menü akışı bundan etkilenmemeli.
  if (!hasServiceCredentials()) return noContent();

  if (!withinRateLimit(clientIp(req), slug)) return new NextResponse(null, { status: 429 });

  const secure = req.nextUrl.protocol === "https:";

  try {
    const pb = await getServicePB();
    const businessId = await resolveBusinessId(pb, slug);
    if (!businessId) return noContent();

    const cookieSidRaw = req.cookies.get(SESSION_COOKIE)?.value;
    const cookieVidRaw = req.cookies.get(VISITOR_COOKIE)?.value;
    const cookieSid = isValidAnalyticsId(cookieSidRaw) ? cookieSidRaw : null;
    const visitor = isValidAnalyticsId(cookieVidRaw) ? cookieVidRaw : newAnalyticsId();

    const path = str(body.path, 200);
    const locale = str(body.locale, 5);
    const entry = readEntry(body.entry);

    const session = await ensureSession({
      pb,
      req,
      businessId,
      slug,
      cookieSid,
      visitor,
      entry,
      locale,
      path,
    });

    await writeEvent(pb, businessId, session, {
      type,
      target: str(body.target, 120),
      label: str(body.label, 200),
      path,
      product: relationId(body.productId),
      category: relationId(body.categoryId),
      popup: relationId(body.popupId),
      meta: sanitizeMeta(body.meta),
    });

    await touchSession(pb, session, type, path);

    // Freemium menü görüntülenme sayacı. Yalnızca gerçek müşteri sayfa
    // görüntülemeleri sayılır: bot/önizleme trafiği ve menü dışı event'ler
    // (sepete ekleme, arama…) sayaca girmez. Yanıtı bloklamıyoruz.
    if (type === "page_view" && !isBotAgent(req.headers.get("user-agent") ?? "")) {
      void pb
        .collection("buyur_businesses")
        .update(businessId, { "menu_views+": 1 }, { requestKey: null })
        .catch(() => undefined);
    }

    const res = noContent({ sid: session.key, secure });
    res.cookies.set(VISITOR_COOKIE, session.visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: VISITOR_TTL_DAYS * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    // Analitik hiçbir koşulda menüyü bozmaz; sorun sunucu loguna düşer.
    console.error("[track] event yazılamadı:", err);
    return noContent();
  }
}
