import type PocketBase from "pocketbase";
import { businessTimezone, dayBoundsUtc, dayKey, zonedParts } from "@/lib/analytics/time";
import { FUNNEL_STEPS, FunnelTracker } from "@/lib/analytics/funnel";
import type { Business, DailyStat, MenuEvent, MenuSession, StatDimension } from "@/lib/types";

// Günlük agregasyon. Panel sorguları ham event taramaz; her işletme-günü için
// burada üretilen buyur_stats_daily kayıtlarını okur (docs/analytics-architecture.md §8).
//
// Hesap idempotenttir: aynı gün tekrar çalıştırıldığında kayıtlar üzerine yazılır,
// artık üretilmeyen satırlar silinir. Bugünün verisi STALE_MS'ten eskiyse tembel
// olarak yeniden hesaplanır.

export const STATS_COLLECTION = "buyur_stats_daily";

/** Bugünün agregatı bu süreden eskiyse yeniden hesaplanır. */
export const STALE_MS = 15 * 60_000;

/** Agregat yazarken eşzamanlı istek sayısı. */
const WRITE_CONCURRENCY = 4;

/** Gün başına saklanan üst sınırlar — uzun kuyruk agregatı şişirmesin. */
const TOP_SEARCH_TERMS = 50;
const TOP_NAVIGATION_PAIRS = 30;
const TOP_CITIES = 30;

/** Oturum "bounce" sayılır: tek sayfa görüntüleme, ürün/sepet etkileşimi yok. */
function isBounce(session: MenuSession): boolean {
  return session.page_views <= 1 && session.product_views === 0 && session.cart_adds === 0;
}

export interface StatRow {
  dimension: StatDimension;
  key: string;
  label: string;
  metrics: Record<string, number>;
}

/** Uzun kuyruklu boyutlarda gün başına saklanacak satır sınırı. */
const DIMENSION_CAPS: { dimension: StatDimension; limit: number; sortMetric: string }[] = [
  { dimension: "search", limit: TOP_SEARCH_TERMS, sortMetric: "searches" },
  { dimension: "navigation", limit: TOP_NAVIGATION_PAIRS, sortMetric: "transitions" },
  { dimension: "city", limit: TOP_CITIES, sortMetric: "sessions" },
];

/** Satırları biriktirir; tekil sayımlar (oturum/ziyaretçi) için küme tutar.
 *  Anahtarlar serbest metin olabildiği (şehir adı, arama terimi) için tekil
 *  kümeler satır kimliğine değil doğrudan satır nesnesine bağlanıyor. */
class RowBuilder {
  private rows = new Map<string, StatRow>();
  private uniques = new Map<StatRow, Map<string, Set<string>>>();

  private ensureRow(dimension: StatDimension, key: string, label: string): StatRow {
    const id = `${dimension}\u0000${key}`;
    let row = this.rows.get(id);
    if (!row) {
      row = { dimension, key, label, metrics: {} };
      this.rows.set(id, row);
    }
    // Etiket sonradan öğrenilebilir (ilk event'te boş gelmiş olabilir).
    if (!row.label && label) row.label = label;
    return row;
  }

  add(dimension: StatDimension, key: string, label: string, metric: string, amount = 1): void {
    const row = this.ensureRow(dimension, key, label);
    row.metrics[metric] = (row.metrics[metric] ?? 0) + amount;
  }

  unique(dimension: StatDimension, key: string, label: string, metric: string, value: string): void {
    if (!value) return;
    const row = this.ensureRow(dimension, key, label);

    let byMetric = this.uniques.get(row);
    if (!byMetric) {
      byMetric = new Map();
      this.uniques.set(row, byMetric);
    }
    let set = byMetric.get(metric);
    if (!set) {
      set = new Set();
      byMetric.set(metric, set);
    }
    set.add(value);
  }

  finalize(): StatRow[] {
    for (const [row, byMetric] of this.uniques) {
      for (const [metric, set] of byMetric) row.metrics[metric] = set.size;
    }

    let rows = Array.from(this.rows.values());
    for (const cap of DIMENSION_CAPS) rows = capDimension(rows, cap.dimension, cap.limit, cap.sortMetric);

    return rows.filter((row) => Object.values(row.metrics).some((value) => value > 0));
  }
}

/** Bir boyutta yalnızca en yoğun `limit` satırı bırakır. */
function capDimension(rows: StatRow[], dimension: StatDimension, limit: number, sortMetric: string): StatRow[] {
  const target = rows.filter((row) => row.dimension === dimension);
  if (target.length <= limit) return rows;

  const keep = new Set(
    target
      .slice()
      .sort((a, b) => (b.metrics[sortMetric] ?? 0) - (a.metrics[sortMetric] ?? 0))
      .slice(0, limit)
  );

  return rows.filter((row) => row.dimension !== dimension || keep.has(row));
}

/** PocketBase kayıt kimliği biçimi — eski kayıtlarda target'ın kimlik mi yoksa
 *  serbest metin mi olduğunu ayırmak için. */
const PB_ID_RE = /^[a-z0-9]{15}$/;

/** target'ı ürün kimliği taşıyabilen event tipleri. */
const PRODUCT_EVENTS = new Set<MenuEvent["type"]>([
  "product_view",
  "product_detail_view",
  "add_to_cart",
  "remove_from_cart",
]);

const TOTAL_EVENT_METRIC: Partial<Record<MenuEvent["type"], string>> = {
  page_view: "page_views",
  qr_scan: "qr_scans",
  category_view: "category_views",
  product_view: "product_views",
  product_detail_view: "product_detail_views",
  add_to_cart: "cart_adds",
  remove_from_cart: "cart_removes",
  cart_view: "cart_views",
  search: "searches",
  campaign_view: "campaign_views",
  campaign_click: "campaign_clicks",
  language_change: "language_changes",
};

/** QR bazında huni adımları (tekil oturum): menü açıldı → ürün görüldü → sepete eklendi. */
const QR_FUNNEL_METRICS: Partial<Record<MenuEvent["type"], string>> = {
  page_view: "menu_opens",
  product_view: "product_viewers",
  product_detail_view: "product_viewers",
  add_to_cart: "cart_adders",
};

/** Ham event + oturum kayıtlarından bir günün bütün agregat satırlarını üretir.
 *  Saf fonksiyon: IO yok, test edilebilir. */
export function buildDailyRows(events: MenuEvent[], sessions: MenuSession[], timezone: string): StatRow[] {
  const builder = new RowBuilder();

  // ─── Oturum tabanlı metrikler ───
  let durationSum = 0;
  for (const session of sessions) {
    const source = session.source || "direct";
    const device = session.device || "mobile";

    builder.add("total", "", "Toplam", "sessions");
    builder.unique("total", "", "Toplam", "visitors", session.visitor);
    builder.add("total", "", "Toplam", session.is_returning ? "returning_sessions" : "new_sessions");
    if (isBounce(session)) builder.add("total", "", "Toplam", "bounced_sessions");
    durationSum += session.duration_sec;

    builder.add("source", source, source, "sessions");
    builder.unique("source", source, source, "visitors", session.visitor);
    builder.add("source", source, source, "duration_sum", session.duration_sec);

    builder.add("device", device, device, "sessions");
    builder.add("device", device, device, "duration_sum", session.duration_sec);

    if (session.country) {
      builder.add("country", session.country, session.country, "sessions");
      builder.unique("country", session.country, session.country, "visitors", session.visitor);
    }
    if (session.city) builder.add("city", session.city, session.city, "sessions");
    if (session.qr) builder.add("qr", session.qr, session.qr, "sessions");
    if (session.locale) builder.add("total", "", "Toplam", `locale_${session.locale}`);

    const { hour } = zonedParts(new Date(session.started_at), timezone);
    builder.add("hour", "sessions", "Oturum (saat)", String(hour));
  }
  builder.add("total", "", "Toplam", "duration_sum", durationSum);

  // ─── Event tabanlı metrikler ───
  const funnel = new FunnelTracker();
  const lastCategoryBySession = new Map<string, { id: string; label: string }>();

  const ordered = events
    .slice()
    .sort((a, b) => Date.parse(a.occurred_at || a.created) - Date.parse(b.occurred_at || b.created));

  for (const event of ordered) {
    // Faz 1 öncesi kayıtlarda ürün/kategori ilişkisi yok; kimlik `target`ta
    // duruyor. Geçmişin analitikten düşmemesi için ilişki boşsa target'ı
    // PocketBase kimliği biçimindeyse ilişki gibi kabul ediyoruz.
    const productId = event.product || (PRODUCT_EVENTS.has(event.type) && PB_ID_RE.test(event.target) ? event.target : "");
    const categoryId =
      event.category || (event.type === "category_view" && PB_ID_RE.test(event.target) ? event.target : "");

    const at = new Date(event.occurred_at || event.created);
    const { hour } = zonedParts(at, timezone);
    const metric = TOTAL_EVENT_METRIC[event.type];

    builder.add("total", "", "Toplam", "events");
    if (metric) builder.add("total", "", "Toplam", metric);

    if (event.type === "page_view") {
      builder.add("page", event.target || "unknown", event.label || event.target, "views");
      builder.add("hour", "page_views", "Sayfa görüntüleme (saat)", String(hour));
    }
    if (event.type === "product_view" || event.type === "product_detail_view" || event.type === "add_to_cart") {
      builder.add("hour", "engagement", "Ürün etkileşimi (saat)", String(hour));
    }

    // Huni: adım başına tekil oturum (kural lib/analytics/funnel.ts'te; event'ler
    // zaman sırasıyla geldiği için "ekledikten sonra sepeti açtı" ayrımı yapılabiliyor).
    funnel.observe(event.type, event.session);

    const source = event.source || "direct";
    const device = event.device || "mobile";

    if (event.type === "product_view" || event.type === "product_detail_view") {
      builder.add("source", source, source, "product_views");
      builder.add("device", device, device, "product_views");
    }
    if (event.type === "page_view") {
      builder.add("source", source, source, "page_views");
      builder.add("device", device, device, "page_views");
      if (event.country) builder.add("country", event.country, event.country, "page_views");
      if (event.city) builder.add("city", event.city, event.city, "page_views");
    }
    if (event.type === "add_to_cart") {
      builder.add("source", source, source, "cart_adds");
      builder.add("device", device, device, "cart_adds");
    }

    // Ürün kırılımı
    if (productId) {
      const label = event.label || productId;
      if (event.type === "product_view") builder.add("product", productId, label, "views");
      if (event.type === "product_detail_view") builder.add("product", productId, label, "detail_views");
      if (event.type === "add_to_cart") builder.add("product", productId, label, "cart_adds");
      if (event.type === "remove_from_cart") builder.add("product", productId, label, "cart_removes");
      builder.unique("product", productId, label, "sessions", event.session);
    }

    // Kategori kırılımı: hem doğrudan kategori görüntüleme hem kategoriye bağlı ürün olayları.
    if (categoryId) {
      const label = event.type === "category_view" ? event.label || categoryId : "";
      if (event.type === "category_view") builder.add("category", categoryId, label, "views");
      if (event.type === "product_view" || event.type === "product_detail_view") {
        builder.add("category", categoryId, label, "product_views");
      }
      if (event.type === "add_to_cart") builder.add("category", categoryId, label, "cart_adds");
      builder.unique("category", categoryId, label, "sessions", event.session);
    }

    if (event.type === "qr_scan") {
      const key = event.qr || event.target || "unknown";
      builder.add("qr", key, event.label || key, "scans");
      builder.unique("qr", key, event.label || key, "sessions", event.session);
    }

    // QR hunisi: QR'la başlayan oturumun QR'ı her event'e yazılıyor (bkz.
    // /api/track writeEvent), adım başına tekil oturum sayılır.
    const qrStep = event.qr ? QR_FUNNEL_METRICS[event.type] : undefined;
    if (qrStep && event.qr) builder.unique("qr", event.qr, "", qrStep, event.session);

    if (event.popup) {
      if (event.type === "campaign_view") builder.add("campaign", event.popup, event.label || event.popup, "views");
      if (event.type === "campaign_click") builder.add("campaign", event.popup, event.label || event.popup, "clicks");
    }

    if (event.type === "search" && event.target) {
      const meta = event.meta as { results?: number; no_result?: boolean } | undefined;
      builder.add("search", event.target, event.label || event.target, "searches");
      builder.add("search", event.target, event.label || event.target, "result_sum", Number(meta?.results ?? 0));
      if (meta?.no_result) builder.add("search", event.target, event.label || event.target, "no_results");
    }

    // Kategoriden kategoriye geçişler (menü içi navigasyon).
    if (event.type === "category_view" && event.session && categoryId) {
      const previous = lastCategoryBySession.get(event.session);
      if (previous && previous.id !== categoryId) {
        builder.add(
          "navigation",
          `${previous.id}>${categoryId}`,
          `${previous.label} → ${event.label || categoryId}`,
          "transitions"
        );
      }
      lastCategoryBySession.set(event.session, { id: categoryId, label: event.label || categoryId });
    }
  }

  const funnelCounts = funnel.counts();
  for (const step of FUNNEL_STEPS) {
    builder.add("funnel", step.key, step.label, "sessions", funnelCounts[step.key]);
  }

  return builder.finalize();
}

async function fetchDayEvents(pb: PocketBase, businessId: string, from: Date, to: Date): Promise<MenuEvent[]> {
  return pb.collection("buyur_events").getFullList<MenuEvent>({
    filter: pb.filter("business = {:business} && occurred_at >= {:from} && occurred_at < {:to}", {
      business: businessId,
      from,
      to,
    }),
    batch: 500,
    sort: "occurred_at",
    requestKey: null,
  });
}

async function fetchDaySessions(pb: PocketBase, businessId: string, from: Date, to: Date): Promise<MenuSession[]> {
  return pb.collection("buyur_sessions").getFullList<MenuSession>({
    filter: pb.filter("business = {:business} && started_at >= {:from} && started_at < {:to}", {
      business: businessId,
      from,
      to,
    }),
    batch: 500,
    sort: "started_at",
    requestKey: null,
  });
}

/** Hesaplanan satırları yazar: mevcutları günceller, eksikleri oluşturur,
 *  artık üretilmeyenleri siler (gün yeniden hesaplandığında kalıntı kalmasın). */
async function persistRows(pb: PocketBase, businessId: string, day: string, rows: StatRow[]): Promise<void> {
  const existing = await pb.collection(STATS_COLLECTION).getFullList<DailyStat>({
    filter: pb.filter("business = {:business} && date = {:date}", { business: businessId, date: day }),
    batch: 500,
    requestKey: null,
  });

  const existingByKey = new Map(existing.map((row) => [`${row.dimension}\u0000${row.key}`, row]));
  const seen = new Set<string>();

  const writes = rows.map((row) => {
    const id = `${row.dimension}\u0000${row.key}`;
    seen.add(id);
    const current = existingByKey.get(id);
    const payload = {
      business: businessId,
      date: day,
      dimension: row.dimension,
      key: row.key.slice(0, 120),
      label: row.label.slice(0, 200),
      metrics: row.metrics,
    };

    return () =>
      current
        ? pb.collection(STATS_COLLECTION).update(current.id, payload, { requestKey: null })
        : createOrUpdate(pb, payload);
  });

  const deletes = Array.from(existingByKey)
    .filter(([id]) => !seen.has(id))
    .map(([, row]) => () =>
      pb
        .collection(STATS_COLLECTION)
        .delete(row.id, { requestKey: null })
        .catch((err: unknown) => {
          // Paralel bir rollup aynı satırı çoktan silmiş olabilir.
          if (errorStatus(err) !== 404) throw err;
        })
    );

  await runPool([...writes, ...deletes], WRITE_CONCURRENCY);
}

interface StatPayload {
  business: string;
  date: string;
  dimension: StatDimension;
  key: string;
  label: string;
  metrics: Record<string, number>;
}

function errorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) return undefined;
  return Number((err as { status: unknown }).status);
}

/** Satırı oluşturur; aynı anahtarlı satır bu arada başka bir istek tarafından
 *  yazılmışsa (benzersiz indeks çakışması) onu günceller.
 *
 *  Panelde bir sayfa birden çok analiz ucunu aynı anda çağırıyor ve sunucusuz
 *  ortamda bu istekler farklı örneklere düşüyor: aynı gün paralel rollup'lanınca
 *  ikinci `create` (business, date, dimension, key) indeksine takılıyordu. Bu
 *  hata tüm isteği 500'e çevirip paneli "Analiz verileri şu anda yüklenemiyor"
 *  ekranına düşürüyordu. */
async function createOrUpdate(pb: PocketBase, payload: StatPayload): Promise<unknown> {
  try {
    return await pb.collection(STATS_COLLECTION).create(payload, { requestKey: null });
  } catch (err) {
    if (errorStatus(err) !== 400) throw err;

    let existing: { id: string };
    try {
      existing = await pb.collection(STATS_COLLECTION).getFirstListItem<{ id: string }>(
        pb.filter("business = {:business} && date = {:date} && dimension = {:dimension} && key = {:key}", {
          business: payload.business,
          date: payload.date,
          dimension: payload.dimension,
          key: payload.key,
        }),
        { fields: "id", requestKey: null }
      );
    } catch {
      // Çakışan satır bulunamadıysa hata gerçek bir doğrulama hatasıdır.
      throw err;
    }
    return pb.collection(STATS_COLLECTION).update(existing.id, payload, { requestKey: null });
  }
}

/** Yüzlerce satırı tek tek beklemek yerine sınırlı eşzamanlılıkla yazar —
 *  PocketBase'i boğmadan rollup süresini kısaltır. */
async function runPool(tasks: (() => Promise<unknown>)[], concurrency: number): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (index < tasks.length) {
      const task = tasks[index++]!;
      await task();
    }
  });
  await Promise.all(workers);
}

/** Aynı örnekte aynı işletme-gününün eşzamanlı hesabını tekilleştirir: panelde
 *  paralel gelen istekler aynı günü ikişer kez hesaplayıp birbirinin satırlarıyla
 *  yarışmasın. (Farklı örnekler arası yarışı createOrUpdate karşılıyor.) */
const inflightDays = new Map<string, Promise<number>>();

/** Tek bir işletme-gününü yeniden hesaplar. */
export function rollupDay(pb: PocketBase, business: Business, day: string): Promise<number> {
  const key = `${business.id} ${day}`;
  const running = inflightDays.get(key);
  if (running) return running;

  const task = computeDay(pb, business, day).finally(() => inflightDays.delete(key));
  inflightDays.set(key, task);
  return task;
}

async function computeDay(pb: PocketBase, business: Business, day: string): Promise<number> {
  const timezone = businessTimezone(business);
  const { from, to } = dayBoundsUtc(day, timezone);
  const [events, sessions] = await Promise.all([
    fetchDayEvents(pb, business.id, from, to),
    fetchDaySessions(pb, business.id, from, to),
  ]);

  const rows = buildDailyRows(events, sessions, timezone);

  // Veri olmayan günler için de bir "toplam" satırı yazıyoruz. Aksi hâlde o gün
  // hiç satır üretmez, ensureFreshStats onu "hesaplanmamış" sanar ve HER
  // istekte yeniden hesaplar — panelin yavaşlığının ana kaynağı buydu.
  if (!rows.some((row) => row.dimension === "total" && row.key === "")) {
    rows.push({ dimension: "total", key: "", label: "Toplam", metrics: { events: 0 } });
  }

  await persistRows(pb, business.id, day, rows);
  return rows.length;
}

/** İşletmenin ham verisinin kapsadığı gün aralığı. Bu pencerenin dışındaki
 *  günlerde tanım gereği hiç event yok; onları tek tek "hesaplayıp" boş bulmak
 *  saf ağ israfı (ör. geçen yılın aynı dönemi seçildiğinde 14 boş gün).
 *  Pencere tek sorguyla bulunur ve kısa süre önbellekte tutulur. */
const DATA_WINDOW_TTL_MS = 5 * 60_000;
/** "empty" = işletmenin hiç event'i yok (hiçbir gün hesaplanmaz),
 *  null = pencere sorgulanamadı (eski davranışa dönülür). */
type DataWindow = { first: string; last: string } | "empty" | null;

const dataWindowCache = new Map<string, { window: DataWindow; expiresAt: number }>();

async function businessDataWindow(pb: PocketBase, business: Business): Promise<DataWindow> {
  const now = Date.now();
  const cached = dataWindowCache.get(business.id);
  if (cached && cached.expiresAt > now) return cached.window;

  let window: DataWindow = null;
  try {
    const [oldest, newest] = await Promise.all([
      pb.collection("buyur_events").getList<{ occurred_at: string }>(1, 1, {
        filter: pb.filter("business = {:business} && occurred_at != ''", { business: business.id }),
        fields: "occurred_at",
        sort: "occurred_at",
        requestKey: null,
      }),
      pb.collection("buyur_events").getList<{ occurred_at: string }>(1, 1, {
        filter: pb.filter("business = {:business} && occurred_at != ''", { business: business.id }),
        fields: "occurred_at",
        sort: "-occurred_at",
        requestKey: null,
      }),
    ]);

    const first = oldest.items[0]?.occurred_at;
    const last = newest.items[0]?.occurred_at;
    if (first && last) {
      const timezone = businessTimezone(business);
      window = {
        first: dayKey(new Date(first.replace(" ", "T")), timezone),
        last: dayKey(new Date(last.replace(" ", "T")), timezone),
      };
    } else if (oldest.totalItems === 0) {
      // Hiç event yok: her günü "hesaplayıp boş bulmak" saf israf.
      window = "empty";
    }
  } catch {
    // Pencere bulunamazsa eski davranışa (her günü hesapla) düşüyoruz.
    window = null;
  }

  dataWindowCache.set(business.id, { window, expiresAt: now + DATA_WINDOW_TTL_MS });
  return window;
}

/** Verilen aralıkta eksik ya da bayatlamış günleri hesaplar.
 *  - Hiç kaydı olmayan gün → hesaplanır.
 *  - Bugün → agregatı STALE_MS'ten eskiyse yeniden hesaplanır.
 *  - Geçmiş günler → bir kez hesaplandıktan sonra tekrar dokunulmaz. */
export async function ensureFreshStats(
  pb: PocketBase,
  business: Business,
  days: string[],
  now: Date = new Date(),
  options: { limit?: number } = {}
): Promise<string[]> {
  if (days.length === 0) return [];

  const timezone = businessTimezone(business);
  const today = dayKey(now, timezone);

  const existing = await pb.collection(STATS_COLLECTION).getFullList<DailyStat>({
    filter: pb.filter("business = {:business} && date >= {:from} && date <= {:to} && dimension = {:dimension}", {
      business: business.id,
      from: days[0],
      to: days[days.length - 1],
      dimension: "total",
    }),
    fields: "date,updated",
    batch: 500,
    requestKey: null,
  });

  const updatedByDay = new Map(existing.map((row) => [row.date, Date.parse(row.updated.replace(" ", "T"))]));
  const stale: string[] = [];

  // Verinin hiç olmadığı günleri hesaplamaya çalışmıyoruz (gün başına 2 sorgu ederdi).
  const window = await businessDataWindow(pb, business);

  for (const day of days) {
    if (day > today) continue; // gelecek gün hesaplanmaz
    const updatedAt = updatedByDay.get(day);
    if (updatedAt === undefined) {
      if (window === "empty") continue;
      if (window && (day < window.first || day > window.last)) continue;
      stale.push(day);
      continue;
    }
    if (day === today && now.getTime() - updatedAt > STALE_MS) stale.push(day);
  }

  // Sınır verilmişse en yeni günleri öncelikliyoruz: panelde en çok bakılan
  // taraf bugüne yakın olan; eski boşlukları cron kapatır.
  const selected = options.limit ? stale.slice(-options.limit) : stale;

  // Hiç hesaplanmamış günler beklenir (veri olmadan yanıt anlamsız); yalnızca
  // "bugün bayatladı" tazelemesi arka plana alınır — kullanıcı 15 dakikalık
  // gecikmeyi beklemek yerine mevcut veriyi anında görür.
  const blocking = selected.filter((day) => day !== today || !updatedByDay.has(day));
  const background = selected.filter((day) => !blocking.includes(day));

  for (const day of blocking) {
    try {
      await rollupDay(pb, business, day);
    } catch (err) {
      // Tek bir günün hesaplanamaması tüm analiz isteğini düşürmesin: mevcut
      // agregatla yanıt verilir, gün bir sonraki istekte ya da cron'da yeniden denenir.
      console.error(`[rollup] ${business.id}/${day} hesaplanamadı:`, err);
    }
  }

  for (const day of background) {
    void rollupDay(pb, business, day).catch((err) => {
      console.error("[rollup] arka plan tazelemesi başarısız:", err);
    });
  }

  return selected;
}
