// Yönetim panelinin işletme verisini okuyan sunucu katmanı. Okumalar servis
// hesabıyla yapılır: giriş e-postası auth kayıtlarında yalnızca yönetim
// yetkisine (manageRule) açık ve destek rolünde bu yetki yok — destek ekibi
// müşterisinin e-postasını görebilmeli. Yazmalar burada değil; admin'in kendi
// yetkisiyle app/api/admin/businesses/[id] ucunda yapılır.

import type PocketBase from "pocketbase";
import { getServicePB } from "@/lib/pocketbase-server";
import { AUDIT_LOG_COLLECTION } from "@/lib/audit-log";
import { ADMIN_BUSINESS_ROW_FIELDS, type AdminBusinessRow } from "@/lib/admin-business-list";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { STATS_COLLECTION } from "@/lib/analytics/rollup";
import { totalMetrics } from "@/lib/analytics/query";
import type { AdminLog, AdminNote, Business, DailyStat } from "@/lib/types";

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
  counts: { products: number; categories: number };
  notes: AdminNote[];
  /** İşletmenin son etkinliği (kısa): sahibinin, yönetimin ve sistemin
   *  işlemleri birlikte. Tamamı denetim kaydında, işletme filtresiyle. */
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
 *  yönetim ekranı istatistik yazmamalı; eksik günler cron'la kapanır.
 *  Yalnızca detay ekranında gösterilen veri okunur (QR ve değerlendirme
 *  listeleri işletmenin kendi panelinde). */
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
  const [products, categories, notes, logs, activity] = await Promise.all([
    count(pb, "buyur_products", id),
    count(pb, "buyur_categories", id),
    pb.collection(ADMIN_NOTE_COLLECTION).getList<AdminNote>(1, 50, { filter: byBusiness, sort: "-created", requestKey: null }).then((r) => r.items),
    pb
      .collection(AUDIT_LOG_COLLECTION)
      .getList<AdminLog>(1, 10, {
        // Eski kayıtlarda işletme yalnızca hedefte durur (göç doldurmadıysa).
        filter: pb.filter("business_id = {:id} || (target_collection = {:c} && target_id = {:id})", { c: BUSINESS_COLLECTION, id }),
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
    counts: { products, categories },
    notes,
    logs: logs.items,
    logTotal: logs.totalItems,
    activity,
  };
}

/** Tüm işletmelerin son `days` gündeki toplam etkinliği (günlük özetlerden).
 *  Okunamazsa null. İşletme sayısı büyüdüğünde (binler × 30 gün satır) bu
 *  okuma pahalılaşır; o noktada platform düzeyinde ayrı bir özet gerekir. */
export async function loadPlatformActivity(days = ACTIVITY_DAYS): Promise<BusinessActivitySummary | null> {
  try {
    const pb = await getServicePB();
    const rows = await pb.collection(STATS_COLLECTION).getFullList<DailyStat>({
      filter: pb.filter("dimension = 'total' && date >= {:from}", { from: daysAgoKey(days) }),
      fields: "dimension,metrics",
      batch: 1000,
      requestKey: null,
    });
    const totals = totalMetrics(rows);
    return {
      days,
      sessions: totals.sessions ?? 0,
      pageViews: totals.page_views ?? 0,
      qrScans: totals.qr_scans ?? 0,
      productViews: totals.product_views ?? 0,
    };
  } catch (err) {
    console.error("[admin-overview] platform etkinliği okunamadı", err);
    return null;
  }
}
