import type { AnalyticsContext } from "@/lib/analytics/access";
import { AccessError, requirePermission } from "@/lib/analytics/access";
import { buildInsights } from "@/lib/analytics/insights";
import { computeMenuScore } from "@/lib/analytics/score";
import type { DateRange } from "@/lib/analytics/range";
import { changeRatio } from "@/lib/analytics/range";
import {
  dailySeries,
  deriveOverview,
  groupDimension,
  hourlyTotals,
  businessCategoryNames,
  businessProductCategories,
  businessProductNames,
  loadStats,
  rangeUniqueVisitors,
  resolveLabels,
  totalMetrics,
  weekdayHourMatrix,
  type DimensionEntry,
  type OverviewTotals,
} from "@/lib/analytics/query";
import { classifyProduct, computeBenchmarks } from "@/lib/analytics/opportunities";
import { buildFunnel, type FunnelStepResult } from "@/lib/analytics/funnel";
import { isFeatureAvailable } from "@/lib/entitlements";
import { REPORT_DEFINITIONS, buildReport, isReportType } from "@/lib/analytics/reports";
import type { DailyStat, StatDimension } from "@/lib/types";

// Analytics uçlarının iş mantığı. Route dosyası yalnızca kimlik/zarf işini
// yapar; şekillendirme burada. Her handler kendi plan yetkisini talep eder —
// gating UI'da değil bu katmanda bağlayıcıdır.

export interface EndpointArgs {
  context: AnalyticsContext;
  range: DateRange;
  comparison: DateRange | null;
  params: URLSearchParams;
  /** Yol parçası: "products/abc123" → ["products", "abc123"] */
  segments: string[];
}

export interface EndpointResult {
  data: unknown;
  approximate?: boolean;
}

type Handler = (args: EndpointArgs) => Promise<EndpointResult>;

/** Bir dizideki metriği büyükten küçüğe sıralar. */
function sortByMetric(entries: DimensionEntry[], metric: string): DimensionEntry[] {
  return entries.slice().sort((a, b) => (b.metrics[metric] ?? 0) - (a.metrics[metric] ?? 0));
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Genel bakışın ihtiyaç duyduğu boyutlar — tamamını çekmek gereksiz yük. */
const OVERVIEW_DIMENSIONS: StatDimension[] = ["total", "product", "category", "source", "device", "funnel"];

async function overviewTotals(
  args: EndpointArgs,
  range: DateRange,
  dimensions: StatDimension[] = OVERVIEW_DIMENSIONS
): Promise<{ rows: DailyStat[]; totals: OverviewTotals; approximate: boolean }> {
  // İki sorgu birbirine bağlı değil: sıralı beklemek yerine paralel.
  const [rows, unique] = await Promise.all([
    loadStats(args.context.service, args.context.business, range, dimensions),
    rangeUniqueVisitors(args.context.service, args.context.business, range),
  ]);

  const raw = totalMetrics(rows);
  return {
    rows,
    totals: deriveOverview(raw, unique.visitors ?? raw.visitors ?? 0),
    approximate: unique.approximate,
  };
}

function changesBetween(current: OverviewTotals, previous: OverviewTotals | null): Record<string, number | null> {
  if (!previous) return {};
  const changes: Record<string, number | null> = {};
  for (const key of Object.keys(current) as (keyof OverviewTotals)[]) {
    changes[key] = changeRatio(current[key], previous[key]);
  }
  return changes;
}

/** Adım sırası ve etiketleri lib/analytics/funnel.ts'ten gelir; satırlardan
 *  yalnızca sayı okunur (sıfır oturumlu adımın satırı hiç yazılmaz). */
function funnelFrom(rows: DailyStat[]): FunnelStepResult[] {
  const counts = Object.fromEntries(
    groupDimension(rows, "funnel").map((entry) => [entry.key, entry.metrics.sessions ?? 0])
  );
  return buildFunnel(counts);
}

// ─── Uçlar ────────────────────────────────────────────────────────────

const overview: Handler = async (args) => {
  requirePermission(args.context, "analytics.view");
  const advanced = args.context.permissions.has("analytics.advanced");

  // Karşılaştırma ve etiketler mevcut dönemden bağımsız: hepsini aynı anda
  // başlatıp tek dalgada bekliyoruz (sıralı beklemek her adımda bir ağ turu).
  const currentPromise = overviewTotals(args, args.range);
  const previousPromise = args.comparison
    ? overviewTotals(args, args.comparison, ["total"])
    : Promise.resolve(null);
  const productNamesPromise = businessProductNames(args.context.service, args.context.business.id);
  const categoryNamesPromise = businessCategoryNames(args.context.service, args.context.business.id);

  const current = await currentPromise;

  // Temel planda karşılaştırma ve kırılımlar kapalı: sadece özet + günlük seri.
  if (!advanced) {
    void previousPromise.catch(() => undefined);
    void productNamesPromise.catch(() => undefined);
    void categoryNamesPromise.catch(() => undefined);
    return {
      data: {
        totals: {
          sessions: current.totals.sessions,
          visitors: current.totals.visitors,
          page_views: current.totals.page_views,
          qr_scans: current.totals.qr_scans,
          product_views: current.totals.product_views,
          cart_adds: current.totals.cart_adds,
        },
        series: { page_views: dailySeries(current.rows, args.range, "page_views") },
        locked: ["comparison", "funnel", "sources", "devices", "products", "categories", "activity"],
      },
      approximate: current.approximate,
    };
  }

  const [previous, productLabels, categoryLabels] = await Promise.all([
    previousPromise,
    productNamesPromise,
    categoryNamesPromise,
  ]);

  return {
    data: {
      totals: current.totals,
      previous: previous?.totals ?? null,
      changes: changesBetween(current.totals, previous?.totals ?? null),
      series: {
        page_views: dailySeries(current.rows, args.range, "page_views"),
        sessions: dailySeries(current.rows, args.range, "sessions"),
        cart_adds: dailySeries(current.rows, args.range, "cart_adds"),
        product_views: dailySeries(current.rows, args.range, "product_views"),
      },
      funnel: funnelFrom(current.rows),
      sources: sortByMetric(groupDimension(current.rows, "source"), "sessions"),
      devices: sortByMetric(groupDimension(current.rows, "device"), "sessions"),
      topProducts: sortByMetric(groupDimension(current.rows, "product"), "views")
        .slice(0, 5)
        .map((entry) => ({ ...entry, label: productLabels.get(entry.key) || entry.label })),
      topCategories: sortByMetric(groupDimension(current.rows, "category"), "views")
        .slice(0, 5)
        .map((entry) => ({ ...entry, label: categoryLabels.get(entry.key) || entry.label })),
    },
    approximate: current.approximate || Boolean(previous?.approximate),
  };
};

const menu: Handler = async (args) => {
  requirePermission(args.context, "analytics.view");
  const advanced = args.context.permissions.has("analytics.advanced");
  const [current, previous] = await Promise.all([
    overviewTotals(args, args.range, ["total", "page", "hour"]),
    advanced && args.comparison ? overviewTotals(args, args.comparison, ["total"]) : Promise.resolve(null),
  ]);

  return {
    data: {
      totals: current.totals,
      previous: previous?.totals ?? null,
      changes: changesBetween(current.totals, previous?.totals ?? null),
      series: {
        page_views: dailySeries(current.rows, args.range, "page_views"),
        sessions: dailySeries(current.rows, args.range, "sessions"),
        qr_scans: dailySeries(current.rows, args.range, "qr_scans"),
      },
      pages: sortByMetric(groupDimension(current.rows, "page"), "views"),
      hourly: advanced ? hourlyTotals(current.rows, "page_views") : null,
    },
    approximate: current.approximate,
  };
};

const products: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["product"]);
  const entries = groupDimension(rows, "product");
  const labels = await businessProductNames(args.context.service, args.context.business.id);


  // Kategori filtresi ürün kayıtlarından çözülür (agregat kırılımları tek boyutlu).
  const categoryFilter = args.params.get("category") ?? "";
  const categoryByProduct = await productCategories(args, entries.map((entry) => entry.key));

  const stats = entries.map((entry) => ({
    key: entry.key,
    label: labels.get(entry.key) || entry.label,
    views: entry.metrics.views ?? 0,
    detail_views: entry.metrics.detail_views ?? 0,
    cart_adds: entry.metrics.cart_adds ?? 0,
  }));

  // Kıyas ölçüsü filtreden önce, menünün tamamı üzerinden hesaplanır: kategori
  // filtresi seçilince "ortalama" kayıp gitmesin.
  const benchmarks = computeBenchmarks(stats);

  // Önceki dönem karşılaştırması (trend sütunu) — yalnızca istendiğinde.
  const previousByKey = new Map<string, number>();
  if (args.comparison) {
    const previousRows = await loadStats(args.context.service, args.context.business, args.comparison, ["product"]);
    for (const entry of groupDimension(previousRows, "product")) {
      previousByKey.set(entry.key, entry.metrics.views ?? 0);
    }
  }

  const items = entries
    .filter((entry) => !categoryFilter || categoryByProduct.get(entry.key) === categoryFilter)
    .map((entry) => {
      const views = entry.metrics.views ?? 0;
      const detailViews = entry.metrics.detail_views ?? 0;
      const cartAdds = entry.metrics.cart_adds ?? 0;
      const stat = stats.find((item) => item.key === entry.key)!;

      return {
        key: entry.key,
        label: stat.label,
        category: categoryByProduct.get(entry.key) ?? "",
        views,
        detail_views: detailViews,
        cart_adds: cartAdds,
        cart_removes: entry.metrics.cart_removes ?? 0,
        sessions: entry.metrics.sessions ?? 0,
        detail_rate: ratio(detailViews, views),
        conversion: ratio(cartAdds, views),
        change: args.comparison ? changeRatio(views, previousByKey.get(entry.key) ?? 0) : null,
        opportunity: classifyProduct(stat, benchmarks),
      };
    });

  return {
    data: {
      items,
      total: items.length,
      benchmarks,
      /** Menüde hiç görüntülenmemiş ürünler de bir sinyal: listede yer almazlar. */
      trackedProducts: entries.length,
    },
  };
};

async function productCategories(args: EndpointArgs, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  return businessProductCategories(args.context.service, args.context.business.id);
}

const categories: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["category"]);
  const entries = groupDimension(rows, "category");
  const labels = await resolveLabels(args.context.service, "buyur_categories", entries.map((entry) => entry.key));

  const items = sortByMetric(entries, "views").map((entry) => {
    const views = entry.metrics.views ?? 0;
    const productViews = entry.metrics.product_views ?? 0;
    const cartAdds = entry.metrics.cart_adds ?? 0;
    return {
      key: entry.key,
      label: labels.get(entry.key) || entry.label,
      views,
      product_views: productViews,
      cart_adds: cartAdds,
      sessions: entry.metrics.sessions ?? 0,
      conversion: ratio(cartAdds, productViews),
    };
  });

  return { data: { items } };
};

const sources: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["source", "total"]);
  const entries = sortByMetric(groupDimension(rows, "source"), "sessions");
  const totalSessions = entries.reduce((sum, entry) => sum + (entry.metrics.sessions ?? 0), 0);

  return {
    data: {
      items: entries.map((entry) => {
        const sessions = entry.metrics.sessions ?? 0;
        return {
          key: entry.key,
          label: entry.label,
          sessions,
          visitors: entry.metrics.visitors ?? 0,
          page_views: entry.metrics.page_views ?? 0,
          product_views: entry.metrics.product_views ?? 0,
          cart_adds: entry.metrics.cart_adds ?? 0,
          share: ratio(sessions, totalSessions),
          conversion: ratio(entry.metrics.cart_adds ?? 0, sessions),
          avg_duration: ratio(entry.metrics.duration_sum ?? 0, sessions),
        };
      }),
      totalSessions,
    },
  };
};

const devices: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["device", "country", "city"]);
  const deviceEntries = sortByMetric(groupDimension(rows, "device"), "sessions");
  const totalSessions = deviceEntries.reduce((sum, entry) => sum + (entry.metrics.sessions ?? 0), 0);

  return {
    data: {
      devices: deviceEntries.map((entry) => ({
        key: entry.key,
        label: entry.label,
        sessions: entry.metrics.sessions ?? 0,
        page_views: entry.metrics.page_views ?? 0,
        product_views: entry.metrics.product_views ?? 0,
        cart_adds: entry.metrics.cart_adds ?? 0,
        share: ratio(entry.metrics.sessions ?? 0, totalSessions),
        avg_duration: ratio(entry.metrics.duration_sum ?? 0, entry.metrics.sessions ?? 0),
      })),
      countries: sortByMetric(groupDimension(rows, "country"), "sessions").map((entry) => ({
        key: entry.key,
        label: entry.label,
        sessions: entry.metrics.sessions ?? 0,
        share: ratio(entry.metrics.sessions ?? 0, totalSessions),
      })),
      cities: sortByMetric(groupDimension(rows, "city"), "sessions")
        .slice(0, 20)
        .map((entry) => ({
          key: entry.key,
          label: entry.label,
          sessions: entry.metrics.sessions ?? 0,
          share: ratio(entry.metrics.sessions ?? 0, totalSessions),
        })),
    },
  };
};

const qr: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["qr", "hour", "total"]);
  const entries = sortByMetric(groupDimension(rows, "qr"), "scans");
  const labels = await resolveLabels(args.context.service, "buyur_qr_codes", entries.map((entry) => entry.key));
  const totals = totalMetrics(rows);

  return {
    data: {
      totals: { scans: totals.qr_scans ?? 0 },
      series: dailySeries(rows, args.range, "qr_scans"),
      hourly: hourlyTotals(rows, "sessions"),
      // QR bazında huni: tarama → menü açılışı → ürün görüntüleme → sepete
      // ekleme (adım başına tekil oturum; bkz. rollup QR_FUNNEL_METRICS).
      items: entries.map((entry) => {
        const sessions = entry.metrics.sessions ?? 0;
        const cartAdders = entry.metrics.cart_adders ?? 0;
        return {
          key: entry.key,
          label: labels.get(entry.key) || entry.label,
          scans: entry.metrics.scans ?? 0,
          sessions,
          menu_opens: entry.metrics.menu_opens ?? 0,
          product_viewers: entry.metrics.product_viewers ?? 0,
          cart_adders: cartAdders,
          conversion: ratio(cartAdders, sessions),
        };
      }),
    },
  };
};

const activity: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["hour", "total"]);
  const hourly = hourlyTotals(rows, "page_views");
  const matrix = weekdayHourMatrix(rows, "page_views");

  const peakHour = hourly.reduce((best, value, hour) => (value > hourly[best]! ? hour : best), 0);
  const weekdayTotals = matrix.map((hours) => hours.reduce((sum, value) => sum + value, 0));
  const peakWeekday = weekdayTotals.reduce((best, value, day) => (value > weekdayTotals[best]! ? day : best), 0);

  return {
    data: {
      hourly,
      matrix,
      weekdayTotals,
      peak: { hour: peakHour, weekday: peakWeekday },
      series: dailySeries(rows, args.range, "page_views"),
    },
  };
};

const funnel: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");
  const rows = await loadStats(args.context.service, args.context.business, args.range, ["funnel", "total"]);
  return { data: { steps: funnelFrom(rows) } };
};

const search: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["search", "total"]);
  const entries = sortByMetric(groupDimension(rows, "search"), "searches");
  const totals = totalMetrics(rows);

  return {
    data: {
      totals: {
        searches: totals.searches ?? 0,
        terms: entries.length,
        no_results: entries.reduce((sum, entry) => sum + (entry.metrics.no_results ?? 0), 0),
      },
      items: entries.map((entry) => ({
        key: entry.key,
        label: entry.label,
        searches: entry.metrics.searches ?? 0,
        no_results: entry.metrics.no_results ?? 0,
        avg_results: ratio(entry.metrics.result_sum ?? 0, entry.metrics.searches ?? 0),
      })),
    },
  };
};

const campaigns: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["campaign"]);
  const entries = sortByMetric(groupDimension(rows, "campaign"), "views");
  const labels = await resolveLabels(args.context.service, "buyur_popups", entries.map((entry) => entry.key), "title");

  return {
    data: {
      items: entries.map((entry) => {
        const views = entry.metrics.views ?? 0;
        const clicks = entry.metrics.clicks ?? 0;
        return {
          key: entry.key,
          label: labels.get(entry.key) || entry.label,
          views,
          clicks,
          click_rate: ratio(clicks, views),
        };
      }),
    },
  };
};

const navigation: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["navigation"]);
  const entries = sortByMetric(groupDimension(rows, "navigation"), "transitions").slice(0, 20);

  return {
    data: {
      items: entries.map((entry) => {
        const [from, to] = entry.key.split(">");
        return {
          key: entry.key,
          label: entry.label,
          from: from ?? "",
          to: to ?? "",
          transitions: entry.metrics.transitions ?? 0,
        };
      }),
    },
  };
};

/** Tek ürünün performansı: kendi serisi + kategori ve işletme ortalamasıyla
 *  kıyas + önceki dönem. Ürün kimliği yolun ikinci parçasından gelir. */
export const productDetail: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");

  const productId = args.segments[1] ?? "";
  if (!/^[a-z0-9]{15}$/.test(productId)) {
    throw new Error("invalid_product");
  }

  // Ürünün gerçekten bu işletmeye ait olduğunu doğruluyoruz (tenant izolasyonu).
  const product = await args.context.service
    .collection("buyur_products")
    .getFirstListItem<{ id: string; name: string; category: string }>(
      args.context.service.filter("id = {:id} && business = {:business}", {
        id: productId,
        business: args.context.business.id,
      }),
      { fields: "id,name,category", requestKey: null }
    );

  const rows = await loadStats(args.context.service, args.context.business, args.range, ["product", "category"]);
  const productEntries = groupDimension(rows, "product");
  const entry = productEntries.find((item) => item.key === productId);

  const views = entry?.metrics.views ?? 0;
  const detailViews = entry?.metrics.detail_views ?? 0;
  const cartAdds = entry?.metrics.cart_adds ?? 0;

  const categoryProducts = await productCategories(args, productEntries.map((item) => item.key));
  const siblings = productEntries.filter((item) => categoryProducts.get(item.key) === product.category);
  const categoryAvgViews = siblings.length > 0
    ? siblings.reduce((sum, item) => sum + (item.metrics.views ?? 0), 0) / siblings.length
    : 0;
  const businessAvgViews = productEntries.length > 0
    ? productEntries.reduce((sum, item) => sum + (item.metrics.views ?? 0), 0) / productEntries.length
    : 0;

  let previous: { views: number; cart_adds: number; conversion: number } | null = null;
  if (args.comparison) {
    const previousRows = await loadStats(args.context.service, args.context.business, args.comparison, ["product"]);
    const previousEntry = groupDimension(previousRows, "product").find((item) => item.key === productId);
    const previousViews = previousEntry?.metrics.views ?? 0;
    const previousCartAdds = previousEntry?.metrics.cart_adds ?? 0;
    previous = {
      views: previousViews,
      cart_adds: previousCartAdds,
      conversion: ratio(previousCartAdds, previousViews),
    };
  }

  return {
    data: {
      product: { id: product.id, name: product.name, category: product.category },
      totals: {
        views,
        detail_views: detailViews,
        cart_adds: cartAdds,
        cart_removes: entry?.metrics.cart_removes ?? 0,
        sessions: entry?.metrics.sessions ?? 0,
        detail_rate: ratio(detailViews, views),
        conversion: ratio(cartAdds, views),
      },
      previous,
      changes: previous
        ? {
            views: changeRatio(views, previous.views),
            cart_adds: changeRatio(cartAdds, previous.cart_adds),
            conversion: changeRatio(ratio(cartAdds, views), previous.conversion),
          }
        : null,
      series: {
        views: dailySeries(rows, args.range, "views", { dimension: "product", key: productId }),
        detail_views: dailySeries(rows, args.range, "detail_views", { dimension: "product", key: productId }),
        cart_adds: dailySeries(rows, args.range, "cart_adds", { dimension: "product", key: productId }),
      },
      benchmarks: {
        category_avg_views: categoryAvgViews,
        business_avg_views: businessAvgViews,
        vs_category: categoryAvgViews > 0 ? views / categoryAvgViews - 1 : null,
        vs_business: businessAvgViews > 0 ? views / businessAvgViews - 1 : null,
        category_products: siblings.length,
      },
    },
  };
};

/** Otomatik içgörüler + menü performans skoru. Plan yetkisi: analytics_advanced
 *  üstüne ayrıca `insights` bayrağı aranır. */
const insights: Handler = async (args) => {
  requirePermission(args.context, "analytics.advanced");
  if (!isFeatureAvailable(args.context.business, "insights")) {
    throw new AccessError(403, "permission_denied:insights");
  }

  const rows = await loadStats(args.context.service, args.context.business, args.range);
  const rawTotals = totalMetrics(rows);
  const unique = await rangeUniqueVisitors(args.context.service, args.context.business, args.range);
  const totals = deriveOverview(rawTotals, unique.visitors ?? rawTotals.visitors ?? 0);

  const products = groupDimension(rows, "product");
  const categories = groupDimension(rows, "category");
  const sources = groupDimension(rows, "source");
  const searches = groupDimension(rows, "search");

  let previousTotals: OverviewTotals | null = null;
  const previousProducts = new Map<string, number>();
  const previousSources = new Map<string, number>();

  if (args.comparison) {
    const previousRows = await loadStats(args.context.service, args.context.business, args.comparison);
    const previousRaw = totalMetrics(previousRows);
    previousTotals = deriveOverview(previousRaw, previousRaw.visitors ?? 0);
    for (const entry of groupDimension(previousRows, "product")) {
      previousProducts.set(entry.key, entry.metrics.views ?? 0);
    }
    for (const entry of groupDimension(previousRows, "source")) {
      previousSources.set(entry.key, entry.metrics.sessions ?? 0);
    }
  }

  const [productLabels, categoryLabels] = await Promise.all([
    businessProductNames(args.context.service, args.context.business.id),
    businessCategoryNames(args.context.service, args.context.business.id),
  ]);

  // Menüdeki toplam ürün sayısı — skorun "ürün kapsamı" bileşeni için.
  const productList = await args.context.service.collection("buyur_products").getList(1, 1, {
    filter: args.context.service.filter("business = {:business}", { business: args.context.business.id }),
    fields: "id",
    requestKey: null,
  });

  const hourly = hourlyTotals(rows, "page_views");
  const matrix = weekdayHourMatrix(rows, "page_views");
  const weekdayTotals = matrix.map((hours) => hours.reduce((sum, value) => sum + value, 0));
  const peakHour = hourly.reduce((best, value, hour) => (value > hourly[best]! ? hour : best), 0);
  const peakWeekday = weekdayTotals.reduce((best, value, day) => (value > weekdayTotals[best]! ? day : best), 0);
  const hasActivity = hourly.some((value) => value > 0);

  const list = buildInsights({
    totals,
    previous: previousTotals,
    products,
    categories,
    previousProducts,
    sources,
    previousSources,
    searches,
    peak: hasActivity ? { hour: peakHour, weekday: peakWeekday } : null,
    productLabels,
    categoryLabels,
  });

  const score = computeMenuScore({
    totals,
    previousSessions: previousTotals?.sessions ?? null,
    productCoverage: { viewed: products.length, total: productList.totalItems },
  });

  return { data: { insights: list, score }, approximate: unique.approximate };
};

/** Rapor listesi (Elite). Tek tek raporlar reportDetail ile üretilir. */
const reports: Handler = async (args) => {
  requirePermission(args.context, "reports.view");
  return {
    data: {
      reports: REPORT_DEFINITIONS,
      canExport: args.context.permissions.has("reports.export"),
    },
  };
};

/** Tek bir raporun tam içeriği (Elite). */
export const reportDetail: Handler = async (args) => {
  requirePermission(args.context, "reports.view");

  const type = args.segments[1] ?? "";
  if (!isReportType(type)) throw new AccessError(404, "unknown_report");

  const payload = await buildReport(args.context, type, args.range, args.comparison);
  return { data: payload };
};

export const ANALYTICS_ENDPOINTS: Record<string, Handler> = {
  overview,
  insights,
  reports,
  menu,
  products,
  categories,
  sources,
  devices,
  qr,
  activity,
  funnel,
  search,
  campaigns,
  navigation,
};
