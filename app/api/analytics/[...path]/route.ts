import { NextResponse, type NextRequest } from "next/server";
import { AccessError, resolveAnalyticsContext } from "@/lib/analytics/access";
import { ANALYTICS_ENDPOINTS, productDetail, reportDetail, type EndpointArgs } from "@/lib/analytics/endpoints";
import { comparisonRange, normalizeCompareMode, resolveRange } from "@/lib/analytics/range";
import { businessTimezone } from "@/lib/analytics/time";
import { isFeatureAvailable } from "@/lib/entitlements";
import { createTimer } from "@/lib/analytics/timing";
import { pbRequestCount } from "@/lib/pocketbase-server";
import { msg } from "@/lib/ui-i18n";

// Analytics okuma uçları. Ortak sözleşme (docs/analytics-architecture.md §7):
//   GET /api/analytics/<uç>?preset=last_30&compare=previous_period
//   Authorization: Bearer <pocketbase token>
//
// Kimlik doğrulama, tenant izolasyonu ve plan yetkisi burada + handler'larda
// zorunlu; istemciden gelen hiçbir işletme kimliğine güvenilmez.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hiç hesaplanmamış günler istek anında (tembel) rollup'lanıyor; varsayılan
// fonksiyon süresi buna yetmeyip isteği yarıda kesebiliyordu.
export const maxDuration = 60;

const PB_ID_RE = /^[a-z0-9]{15}$/;

/** Yanıt önbelleği. Panelde sekme değiştirmek, filtreye dokunup geri almak ya da
 *  aynı sayfanın birden çok grafiği aynı ucu çağırmak sık görülüyor; agregat
 *  verisi de saniyelik değişmiyor. Anahtar işletme + rol + uç + parametreler —
 *  farklı kullanıcı ya da farklı yetki asla aynı yanıtı paylaşmaz. */
const RESPONSE_TTL_MS = 30_000;
const responseCache = new Map<string, { body: unknown; expiresAt: number }>();

function cacheKeyFor(businessId: string, segments: string[], params: URLSearchParams): string {
  const query = Array.from(params.entries())
    .filter(([key]) => key !== "business")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `${businessId}\u0000${segments.join("/")}\u0000${query}`;
}

function pruneResponseCache(now: number): void {
  if (responseCache.size < 300) return;
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const segments = (path ?? []).filter(Boolean);
  const endpoint = segments[0] ?? "";

  const handler =
    endpoint === "products" && segments.length === 2
      ? productDetail
      : endpoint === "reports" && segments.length === 2
        ? reportDetail
        : ANALYTICS_ENDPOINTS[endpoint];

  if (!handler) {
    return NextResponse.json({ error: msg("not_found") }, { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const requestedBusiness = params.get("business");
  if (requestedBusiness && !PB_ID_RE.test(requestedBusiness)) {
    return NextResponse.json({ error: msg("invalid_business") }, { status: 400 });
  }

  const timer = createTimer();
  const pbBefore = pbRequestCount();

  try {
    const context = await timer.measure("auth", () => resolveAnalyticsContext(req, requestedBusiness));
    const timezone = businessTimezone(context.business);

    const { range, preset } = resolveRange(
      { preset: params.get("preset"), from: params.get("from"), to: params.get("to") },
      timezone
    );
    const compareMode = normalizeCompareMode(params.get("compare"));
    const comparison = comparisonRange(range, compareMode);

    const cacheKey = cacheKeyFor(context.business.id, segments, params);
    const now = Date.now();
    const cached = responseCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      const hit = NextResponse.json(cached.body);
      hit.headers.set("Server-Timing", `${timer.header()}, cache;desc=hit`);
      hit.headers.set("X-Analytics-Cache", "hit");
      return hit;
    }

    const args: EndpointArgs = { context, range, comparison, params, segments };
    const result = await timer.measure("data", () => handler(args));

    if (process.env.ANALYTICS_TIMING === "1") {
      console.log(
        `[analytics/${segments.join("/")}] ${timer.summary()} pb_istek=${pbRequestCount() - pbBefore}`
      );
    }

    const body = {
      data: result.data,
      meta: {
        range: { ...range, preset, timezone },
        comparison: comparison ? { ...comparison, mode: compareMode } : null,
        plan: {
          key: context.business.plan,
          advanced: context.permissions.has("analytics.advanced"),
          reports: context.permissions.has("reports.view"),
          export: context.permissions.has("reports.export"),
          insights: isFeatureAvailable(context.business, "insights"),
        },
        approximate: result.approximate === true,
        generatedAt: new Date().toISOString(),
      },
    };

    pruneResponseCache(now);
    responseCache.set(cacheKey, { body, expiresAt: now + RESPONSE_TTL_MS });

    const response = NextResponse.json(body);
    // Tarayıcının ağ sekmesinde faz kırılımı görünür.
    response.headers.set("Server-Timing", timer.header());
    response.headers.set("X-Analytics-Cache", "miss");
    return response;
  } catch (err) {
    if (err instanceof AccessError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    if (err instanceof Error && err.message === "invalid_product") {
      return NextResponse.json({ error: msg("invalid_product") }, { status: 400 });
    }
    // İç hatanın detayı istemciye sızmaz; sunucu loguna düşer.
    console.error(`[analytics/${endpoint}] hata:`, err);
    return NextResponse.json({ error: msg("analytics_unavailable") }, { status: 500 });
  }
}
