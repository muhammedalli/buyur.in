// Analitik event sözlüğü — hem menü istemcisi hem /api/track bu listeyi kullanır.
// Sözlük genişletildiğinde scripts/migrate-analytics.mjs ile PocketBase'teki
// select alanının değerleri de güncellenmeli (getOrCreate var olan bir alanın
// seçenek listesini değiştirmez, bkz. scripts/setup-pocketbase.mjs).

export const ANALYTICS_EVENT_TYPES = [
  // Not: "page_view" tarihsel ad — menü içindeki her rota değişimini karşılar.
  // Eski kayıtlarla uyum için yeniden adlandırılmadı.
  "page_view",
  "qr_scan",
  "session_start",
  "session_end",
  "category_view",
  // product_view = ürün listede görüldü (oturum başına ürün başına bir kez),
  // product_detail_view = detay sayfası açıldı. Faz 1 öncesi kayıtlarda
  // product_view detay açılışı anlamına geliyordu — dönemler arası kıyasta dikkat.
  "product_view",
  "product_detail_view",
  "add_to_cart",
  "remove_from_cart",
  "cart_view",
  "search",
  "campaign_view",
  "campaign_click",
  "language_change",
  "product_ar_view",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(ANALYTICS_EVENT_TYPES);

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}

/** Sunucunun kendi ürettiği event'ler — istemciden gelirse reddedilir. */
const SERVER_ONLY_EVENTS = new Set<AnalyticsEventType>(["qr_scan", "session_start", "session_end"]);

export function isClientEmittableEvent(type: AnalyticsEventType): boolean {
  return !SERVER_ONLY_EVENTS.has(type);
}

/** Menü istemcisinin /api/track'e gönderdiği gövde (slug ve entry hariç). */
export interface TrackPayload {
  type: AnalyticsEventType;
  /** Serbest hedef: sayfa türü, arama terimi, ürün/kategori id'si vb. */
  target?: string;
  /** İnsan okunur etiket (panelde id yerine bunu gösteriyoruz). */
  label?: string;
  productId?: string;
  categoryId?: string;
  popupId?: string;
  locale?: string;
  path?: string;
  meta?: Record<string, string | number | boolean>;
}
