// Yönetim panelinin işletme verisini okuyan sunucu katmanı. Okumalar servis
// hesabıyla yapılır: giriş e-postası auth kayıtlarında yalnızca yönetim
// yetkisine (manageRule) açık ve destek rolünde bu yetki yok — destek ekibi
// müşterisinin e-postasını görebilmeli. Yazmalar burada değil; admin'in kendi
// yetkisiyle app/api/admin/businesses/[id] ucunda yapılır.

import type PocketBase from "pocketbase";
import { getServicePB } from "@/lib/pocketbase-server";
import { ADMIN_LOG_COLLECTION } from "@/lib/admin-audit";
import { ADMIN_BUSINESS_ROW_FIELDS, type AdminBusinessRow } from "@/lib/admin-business-list";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { STATS_COLLECTION } from "@/lib/analytics/rollup";
import { totalMetrics } from "@/lib/analytics/query";
import type { AdminLog, AdminNote, Business, DailyStat, QrCode, Review } from "@/lib/types";

export const ADMIN_NOTE_COLLECTION = "buyur_admin_notes";

export async function loadBusinessRows(): Promise<AdminBusinessRow[]> {
  const pb = await getServicePB();
  return pb.collection(BUSINESS_COLLECTION).getFullList<AdminBusinessRow>({
    fields: ADMIN_BUSINESS_ROW_FIELDS,
    batch: 500,
    requestKey: null,
  });
}

export interface BusinessActivitySummary {
  days: number;
  sessions: number;
  pageViews: number;
  qrScans: number;
  productViews: number;
}

export interface BusinessDetail {
  business: Business;
  counts: { products: number; categories: number; qrCodes: number; reviews: number };
  reviews: Review[];
  qrCodes: QrCode[];
  notes: AdminNote[];
  /** Son işlemler (kısa); tamamı denetim kaydında. */
  logs: AdminLog[];
  logTotal: number;
  /** Okunamazsa null: özet yok diye sayfa açılmamazlık etmesin. */
  activity: BusinessActivitySummary | null;
}

const ACTIVITY_DAYS = 30;

function daysAgoKey(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

async function count(pb: PocketBase, collection: string, businessId: string): Promise<number> {
  const res = await pb.collection(collection).getList(1, 1, {
    filter: pb.filter("business = {:id}", { id: businessId }),
    fields: "id",
    requestKey: null,
  });
  return res.totalItems;
}

/** İşletme yoksa null (sayfa 404 verir). Kalan okumalar tek turda paralel:
 *  gecikmenin kaynağı sıralı PocketBase turlarıdır. Rollup TETİKLENMEZ —
 *  yönetim ekranı istatistik yazmamalı; eksik günler cron'la kapanır. */
export async function loadBusinessDetail(id: string): Promise<BusinessDetail | null> {
  const pb = await getServicePB();
  let business: Business;
  try {
    business = await pb.collection(BUSINESS_COLLECTION).getOne<Business>(id, { requestKey: null });
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }

  const byBusiness = pb.filter("business = {:id}", { id });
  const [products, categories, qrTotal, reviewTotal, reviews, qrCodes, notes, logs, activity] = await Promise.all([
    count(pb, "buyur_products", id),
    count(pb, "buyur_categories", id),
    count(pb, "buyur_qr_codes", id),
    count(pb, "buyur_reviews", id),
    pb.collection("buyur_reviews").getList<Review>(1, 5, { filter: byBusiness, sort: "-created", requestKey: null }).then((r) => r.items),
    pb.collection("buyur_qr_codes").getList<QrCode>(1, 50, { filter: byBusiness, sort: "-created", requestKey: null }).then((r) => r.items),
    pb.collection(ADMIN_NOTE_COLLECTION).getList<AdminNote>(1, 50, { filter: byBusiness, sort: "-created", requestKey: null }).then((r) => r.items),
    pb
      .collection(ADMIN_LOG_COLLECTION)
      .getList<AdminLog>(1, 10, {
        filter: pb.filter("target_collection = {:c} && target_id = {:id}", { c: BUSINESS_COLLECTION, id }),
        sort: "-created",
        requestKey: null,
      }),
    pb
      .collection(STATS_COLLECTION)
      .getFullList<DailyStat>({
        filter: pb.filter("business = {:id} && dimension = 'total' && date >= {:from}", { id, from: daysAgoKey(ACTIVITY_DAYS) }),
        fields: "date,dimension,key,label,metrics",
        requestKey: null,
      })
      .then((rows): BusinessActivitySummary => {
        const totals = totalMetrics(rows);
        return {
          days: ACTIVITY_DAYS,
          sessions: totals.sessions ?? 0,
          pageViews: totals.page_views ?? 0,
          qrScans: totals.qr_scans ?? 0,
          productViews: totals.product_views ?? 0,
        };
      })
      .catch(() => null),
  ]);

  return {
    business,
    counts: { products, categories, qrCodes: qrTotal, reviews: reviewTotal },
    reviews,
    qrCodes,
    notes,
    logs: logs.items,
    logTotal: logs.totalItems,
    activity,
  };
}
