import PocketBase from "pocketbase";
import { PB_URL } from "@/lib/pocketbase";
import { getServicePB } from "@/lib/pocketbase-server";
import { isFeatureAvailable, type Feature } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { BUSINESS_COLLECTION, isBusinessSetUp } from "@/lib/business-account";
import type { Business, PlanLimits, PlanRecord } from "@/lib/types";

// Analytics API'nin yetki katmanı. İki kural pazarlıksız:
//   1) İşletme kimliği asla istemciden gelen değere güvenilerek kullanılmaz —
//      çağıranın token'ından türetilir ya da sahiplik/üyelik doğrulanır.
//   2) Plan yetkisi UI'da değil burada, sunucu tarafında kontrol edilir.

export type Permission =
  | "analytics.view"
  | "analytics.advanced"
  | "analytics.export"
  | "reports.view"
  | "reports.export";

/** Buyur'da oturum = işletme hesabı: rol/ekip kavramı yok.
 *  İzinler yalnızca plana bağlıdır. */
const ALL_PERMISSIONS: Permission[] = [
  "analytics.view",
  "analytics.advanced",
  "analytics.export",
  "reports.view",
  "reports.export",
];

/** İzin → özellik eşlemesi. Kararın kendisi lib/entitlements.ts'te; burası
 *  yalnızca analytics API'sinin izin adlarını o matrise bağlar. */
const PERMISSION_FEATURES: Record<Permission, Feature> = {
  "analytics.view": "basic_analytics",
  "analytics.advanced": "advanced_analytics",
  "analytics.export": "report_export",
  "reports.view": "advanced_reports",
  "reports.export": "report_export",
};

/** Plan kaydı okunamazsa geçerli en kısıtlı (Freemium) limitler. */
export const DEFAULT_LIMITS: PlanLimits = {
  ai_menu_import: true,
  ai_pages_per_scan: 5,
  ai_scans_per_month: 2,
  ai_translation: true,
  analytics: true,
  analytics_advanced: false,
  analytics_retention_days: 90,
  api_access: false,
  branding_removal: false,
  campaigns: false,
  website: false,
  insights: false,
  menu_views: 5000,
  reports: false,
  reports_export: false,
  scheduled_reports: false,
};

export interface AnalyticsContext {
  userId: string;
  business: Business;
  plan: PlanRecord | null;
  limits: PlanLimits;
  permissions: Set<Permission>;
  /** Veri okumaları için servis istemcisi (sahiplik yukarıda doğrulandı). */
  service: PocketBase;
}

/** Çözülmüş bağlam önbelleği. Her analitik isteği kimlik + işletme + plan için
 *  4 ayrı PocketBase turu atıyordu (her tur ~250ms). Aynı token'la gelen
 *  isteklerde bunu bir kez yapıp kısa süre saklıyoruz.
 *
 *  Ödünleşim: iptal edilen bir token ya da değişen bir plan en fazla bu süre
 *  kadar geç yansır. Analitik okuma uçları için kabul edilebilir. */
const CONTEXT_TTL_MS = 60_000;
const contextCache = new Map<string, { context: AnalyticsContext; expiresAt: number }>();

function pruneContextCache(now: number): void {
  if (contextCache.size < 200) return;
  for (const [key, entry] of contextCache) {
    if (entry.expiresAt <= now) contextCache.delete(key);
  }
}

export class AccessError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

/** Token'ı PocketBase'e doğrulatır; sahte/expired token burada elenir.
 *  Oturumun sahibi işletme kaydının kendisidir (buyur_businesses, auth). */
async function authenticate(token: string): Promise<Business> {
  if (!token) throw new AccessError(401, "unauthenticated");

  const pb = new PocketBase(PB_URL);
  pb.authStore.save(token, null);

  try {
    const auth = await pb.collection(BUSINESS_COLLECTION).authRefresh<Business>({ requestKey: null });
    if (!auth.record?.id) throw new AccessError(401, "unauthenticated");
    return auth.record;
  } catch (err) {
    if (err instanceof AccessError) throw err;
    throw new AccessError(401, "unauthenticated");
  }
}

/** Oturumdaki işletmeyi doğrular. `requestedId` verilmişse yalnızca eşitlik
 *  kontrolünde kullanılır — istemciden gelen kimliğe asla güvenilmez. */
function resolveBusiness(account: Business, requestedId: string | null): Business {
  if (!isBusinessSetUp(account)) throw new AccessError(404, "no_business");
  if (requestedId && requestedId !== account.id) throw new AccessError(403, "forbidden");
  return account;
}

function effectivePermissions(business: Business): Set<Permission> {
  const granted = new Set<Permission>();
  for (const permission of ALL_PERMISSIONS) {
    if (isFeatureAvailable(business, PERMISSION_FEATURES[permission])) granted.add(permission);
  }
  return granted;
}

/** Analytics uçlarının ortak giriş kapısı: kimlik → işletme → plan → izinler. */
export async function resolveAnalyticsContext(request: Request, requestedBusinessId?: string | null): Promise<AnalyticsContext> {
  const token = bearerToken(request);
  // `rev` panelin bildiği plandır ve YALNIZCA önbellek anahtarına girer: plan
  // değişince bağlam 60 sn beklemeden yeniden çözülür. Yetki kararı her zaman
  // aşağıda sunucudan okunan işletme kaydıyla verilir; istemci değeri
  // yanlış gelse bile yalnızca önbellek ıskalanır.
  const rev = new URL(request.url).searchParams.get("rev") ?? "";
  const cacheKey = `${token}\u0000${requestedBusinessId ?? ""}\u0000${rev}`;
  const now = Date.now();

  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.context;

  const account = await authenticate(token);
  const business = resolveBusiness(account, requestedBusinessId ?? null);
  const userId = account.id;
  const service = await getServicePB();

  // Özellik kapıları (insights, raporlar…) canlı plan kaydından okunur.
  await ensurePlanCatalog(service);

  let plan: PlanRecord | null = null;
  try {
    plan = await service
      .collection("buyur_plans")
      .getFirstListItem<PlanRecord>(service.filter("key = {:key}", { key: business.plan }), { requestKey: null });
  } catch {
    // Plan kaydı okunamazsa güvenli tarafta kalıp temel yetkilerle devam ediyoruz.
  }

  const limits: PlanLimits = { ...DEFAULT_LIMITS, ...(plan?.limits ?? {}) };

  const context: AnalyticsContext = {
    userId,
    business,
    plan,
    limits,
    permissions: effectivePermissions(business),
    service,
  };

  pruneContextCache(now);
  contextCache.set(cacheKey, { context, expiresAt: now + CONTEXT_TTL_MS });
  return context;
}

/** Plan/rol değişikliğinden sonra bağlamı anında tazelemek için. */
export function clearAnalyticsContextCache(): void {
  contextCache.clear();
}

export function requirePermission(context: AnalyticsContext, permission: Permission): void {
  if (!context.permissions.has(permission)) {
    throw new AccessError(403, `permission_denied:${permission}`);
  }
}
