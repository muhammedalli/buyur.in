import { NextResponse, type NextRequest } from "next/server";
import { getServicePB, hasServiceCredentials } from "@/lib/pocketbase-server";
import { businessTimezone, dayKey, shiftDay } from "@/lib/analytics/time";
import { rollupDay } from "@/lib/analytics/rollup";
import { pruneEvents, pruneSessions, retentionDaysFor } from "@/lib/analytics/retention";
import type { Business, PlanRecord } from "@/lib/types";

// Toplu rollup: dışarıdan bir zamanlayıcı (cron) tetikler. Panel okuma anında
// zaten tembel rollup yapıyor; bu uç, hiç ziyaret edilmeyen panellerin de
// agregatını güncel tutmak ve saklama süresi dolmuş ham veriyi temizlemek için.
//
// Kullanım:  curl -H "x-analytics-secret: <ANALYTICS_CRON_SECRET>" https://…/api/analytics/rollup
// Parametre: ?days=2 (varsayılan) — bugün dahil kaç günün yeniden hesaplanacağı.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Günlük cron 2 gün ister; ilk kurulumda geçmişi toplu hesaplamak için
// (?days=120 gibi) geniş pencereye izin veriyoruz.
const MAX_DAYS = 400;

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.ANALYTICS_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("x-analytics-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasServiceCredentials()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const days = Math.min(MAX_DAYS, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("days") ?? "2", 10) || 2));

  try {
    const pb = await getServicePB();
    const [businesses, plans] = await Promise.all([
      // Kurulumu bitmemiş hesapların (slug yok) menüsü ve verisi yoktur.
      pb.collection("buyur_businesses").getFullList<Business>({ filter: 'slug != ""', batch: 200, requestKey: null }),
      pb.collection("buyur_plans").getFullList<PlanRecord>({ batch: 50, requestKey: null }),
    ]);

    const planByKey = new Map(plans.map((plan) => [plan.key, plan]));
    const now = new Date();
    let rolledDays = 0;
    let prunedEvents = 0;
    let prunedSessions = 0;

    for (const business of businesses) {
      const timezone = businessTimezone(business);
      const today = dayKey(now, timezone);

      for (let offset = 0; offset < days; offset += 1) {
        await rollupDay(pb, business, shiftDay(today, -offset));
        rolledDays += 1;
      }

      const retentionDays = retentionDaysFor(planByKey.get(business.plan) ?? null);
      prunedEvents += await pruneEvents(pb, business, retentionDays);
      prunedSessions += await pruneSessions(pb, business, retentionDays);
    }

    return NextResponse.json({
      businesses: businesses.length,
      rolledDays,
      prunedEvents,
      prunedSessions,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[rollup] başarısız:", err);
    return NextResponse.json({ error: "rollup_failed" }, { status: 500 });
  }
}
