import type { AnalyticsContext } from "@/lib/analytics/access";
import type { DateRange } from "@/lib/analytics/range";
import { changeRatio } from "@/lib/analytics/range";
import {
  dailySeries,
  deriveOverview,
  groupDimension,
  hourlyTotals,
  businessCategoryNames,
  businessProductNames,
  loadStats,
  rangeUniqueVisitors,
  resolveLabels,
  totalMetrics,
  weekdayHourMatrix,
  type OverviewTotals,
} from "@/lib/analytics/query";
import { buildInsights } from "@/lib/analytics/insights";
import { computeMenuScore, type MenuScore } from "@/lib/analytics/score";
import { classifyProduct, computeBenchmarks } from "@/lib/analytics/opportunities";
import { buildFunnel } from "@/lib/analytics/funnel";

// Rapor üretimi (Elite). Raporlar panelde gösterilen verinin aynısından üretilir —
// ayrı bir "rapor hesabı" yok, dolayısıyla ekrandaki sayı ile rapordaki sayı
// hiçbir zaman ayrışmaz.

export type ReportType =
  | "menu_performance"
  | "product_performance"
  | "category"
  | "customer_behavior"
  | "acquisition"
  | "executive_summary";

export interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  /** Rapor içinde yer alan bölümler — merkez sayfasında önizleme olarak listelenir. */
  sections: string[];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    type: "executive_summary",
    title: "Yönetici özeti",
    description: "Dönemin tek sayfalık iş özeti: ne değişti, ne öne çıktı, nereye bakılmalı.",
    sections: ["Özet cümleler", "Menü performans skoru", "Temel metrikler", "İçgörüler"],
  },
  {
    type: "menu_performance",
    title: "Menü performans raporu",
    description: "Ziyaret, oturum, QR ve etkileşim metriklerinin dönemsel dökümü.",
    sections: ["Temel metrikler", "Günlük seri", "Sayfa kırılımı", "Cihazlar"],
  },
  {
    type: "product_performance",
    title: "Ürün performans raporu",
    description: "Tüm ürünlerin görüntülenme, sepet ve dönüşüm sıralaması ile fırsat değerlendirmesi.",
    sections: ["Ürün tablosu", "Fırsat dağılımı", "En iyi ve en zayıf ürünler"],
  },
  {
    type: "category",
    title: "Kategori raporu",
    description: "Kategori karşılaştırması, dönüşüm ve ürün dağılımı.",
    sections: ["Kategori tablosu", "Dönüşüm sıralaması"],
  },
  {
    type: "customer_behavior",
    title: "Müşteri davranışı raporu",
    description: "Huni, etkileşim, yeni/dönen ziyaretçi ve aktivite saatleri.",
    sections: ["Dönüşüm hunisi", "Yeni ve dönen ziyaretçi", "Saat ve gün yoğunluğu"],
  },
  {
    type: "acquisition",
    title: "Trafik kaynağı raporu",
    description: "Kaynak, QR ve kampanya performansı.",
    sections: ["Kaynak tablosu", "QR karşılaştırması", "Kampanyalar"],
  },
];

export function isReportType(value: string): value is ReportType {
  return REPORT_DEFINITIONS.some((definition) => definition.type === value);
}

export interface ReportTable {
  key: string;
  title: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
}

export interface ReportPayload {
  type: ReportType;
  title: string;
  description: string;
  business: { name: string; slug: string; logo_url?: string };
  range: DateRange;
  comparison: DateRange | null;
  generatedAt: string;
  summary: string[];
  totals: OverviewTotals;
  previous: OverviewTotals | null;
  changes: Record<string, number | null>;
  score: MenuScore | null;
  series: Record<string, { date: string; value: number }[]>;
  tables: ReportTable[];
  insights: { title: string; detail: string; evidence: string; kind: string }[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function percent(value: number, digits = 1): string {
  return `%${(value * 100).toFixed(digits).replace(".", ",")}`;
}

function duration(seconds: number): string {
  const total = Math.round(seconds);
  return total >= 60 ? `${Math.floor(total / 60)}dk ${total % 60}sn` : `${total}sn`;
}

const SOURCE_LABELS: Record<string, string> = {
  qr: "QR kod",
  instagram: "Instagram",
  google: "Google",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  youtube: "YouTube",
  campaign: "Kampanya linki",
  direct: "Doğrudan",
  other: "Diğer",
};

const DEVICE_LABELS: Record<string, string> = { mobile: "Mobil", tablet: "Tablet", desktop: "Masaüstü" };

const PAGE_LABELS: Record<string, string> = {
  welcome: "Karşılama",
  menu: "Menü",
  category: "Kategori sayfaları",
  product: "Ürün sayfaları",
  search: "Arama",
  cart: "Sepet",
  degerlendir: "Değerlendirme",
};

/** Yönetici özeti cümleleri — sayıdan cümleye, abartısız. */
function summarySentences(
  totals: OverviewTotals,
  previous: OverviewTotals | null,
  topProduct: string | null,
  topSource: { label: string; change: number | null } | null,
  bestCategory: { label: string; conversion: number } | null
): string[] {
  const lines: string[] = [];

  const viewChange = previous ? changeRatio(totals.page_views, previous.page_views) : null;
  if (viewChange !== null) {
    lines.push(
      viewChange >= 0
        ? `Menü görüntülenmesi bu dönemde ${percent(viewChange, 0)} arttı.`
        : `Menü görüntülenmesi bu dönemde ${percent(Math.abs(viewChange), 0)} azaldı.`
    );
  } else {
    lines.push(`Dönem boyunca ${totals.page_views} menü görüntülenmesi kaydedildi.`);
  }

  lines.push(
    `${totals.visitors} tekil ziyaretçi, ${totals.sessions} oturum; ortalama oturum süresi ${duration(totals.avg_session_duration)}.`
  );

  if (bestCategory) {
    lines.push(`${bestCategory.label} kategorisi ${percent(bestCategory.conversion)} ile en yüksek dönüşümü üretti.`);
  }
  if (topSource) {
    lines.push(
      topSource.change !== null
        ? `${topSource.label} trafiği ${percent(topSource.change, 0)} değişti ve dönemin en güçlü kanalı oldu.`
        : `${topSource.label} dönemin en güçlü trafik kanalı oldu.`
    );
  }
  if (topProduct) {
    lines.push(`${topProduct} en çok görüntülenen ürün olmayı sürdürüyor.`);
  }

  return lines;
}

export async function buildReport(
  context: AnalyticsContext,
  type: ReportType,
  range: DateRange,
  comparison: DateRange | null
): Promise<ReportPayload> {
  // Rapor tek seferde çok veri istiyor: bağımsız sorguları paralel başlatıyoruz.
  const [rows, unique, previousRows] = await Promise.all([
    loadStats(context.service, context.business, range),
    rangeUniqueVisitors(context.service, context.business, range),
    comparison ? loadStats(context.service, context.business, comparison) : Promise.resolve(null),
  ]);

  const rawTotals = totalMetrics(rows);
  const totals = deriveOverview(rawTotals, unique.visitors ?? rawTotals.visitors ?? 0);

  let previous: OverviewTotals | null = null;
  const previousProducts = new Map<string, number>();
  const previousSources = new Map<string, number>();

  if (previousRows) {
    const previousRaw = totalMetrics(previousRows);
    previous = deriveOverview(previousRaw, previousRaw.visitors ?? 0);
    for (const entry of groupDimension(previousRows, "product")) previousProducts.set(entry.key, entry.metrics.views ?? 0);
    for (const entry of groupDimension(previousRows, "source")) previousSources.set(entry.key, entry.metrics.sessions ?? 0);
  }

  const products = groupDimension(rows, "product");
  const categories = groupDimension(rows, "category");
  const sources = groupDimension(rows, "source");
  const devices = groupDimension(rows, "device");
  const pages = groupDimension(rows, "page");
  const qrCodes = groupDimension(rows, "qr");
  const campaigns = groupDimension(rows, "campaign");
  const searches = groupDimension(rows, "search");
  const funnel = groupDimension(rows, "funnel");

  const [productLabels, categoryLabels, qrLabels, campaignLabels] = await Promise.all([
    businessProductNames(context.service, context.business.id),
    businessCategoryNames(context.service, context.business.id),
    resolveLabels(context.service, "buyur_qr_codes", qrCodes.map((entry) => entry.key)),
    resolveLabels(context.service, "buyur_popups", campaigns.map((entry) => entry.key), "title"),
  ]);

  const changes: Record<string, number | null> = {};
  if (previous) {
    for (const key of Object.keys(totals) as (keyof OverviewTotals)[]) {
      changes[key] = changeRatio(totals[key], previous[key]);
    }
  }

  const productStats = products.map((entry) => ({
    key: entry.key,
    label: productLabels.get(entry.key) ?? entry.label,
    views: entry.metrics.views ?? 0,
    detail_views: entry.metrics.detail_views ?? 0,
    cart_adds: entry.metrics.cart_adds ?? 0,
  }));
  const benchmarks = computeBenchmarks(productStats);

  const bestCategory = categories
    .filter((entry) => (entry.metrics.product_views ?? 0) >= 20)
    .map((entry) => ({
      label: categoryLabels.get(entry.key) ?? entry.label,
      conversion: ratio(entry.metrics.cart_adds ?? 0, entry.metrics.product_views ?? 0),
    }))
    .sort((a, b) => b.conversion - a.conversion)[0] ?? null;

  const topSourceEntry = sources.slice().sort((a, b) => (b.metrics.sessions ?? 0) - (a.metrics.sessions ?? 0))[0];
  const topSource = topSourceEntry
    ? {
        label: SOURCE_LABELS[topSourceEntry.key] ?? topSourceEntry.label,
        change: changeRatio(topSourceEntry.metrics.sessions ?? 0, previousSources.get(topSourceEntry.key) ?? 0),
      }
    : null;

  const topProduct = productStats.slice().sort((a, b) => b.views - a.views)[0]?.label ?? null;

  const productList = await context.service.collection("buyur_products").getList(1, 1, {
    filter: context.service.filter("business = {:business}", { business: context.business.id }),
    fields: "id",
    requestKey: null,
  });

  const score = computeMenuScore({
    totals,
    previousSessions: previous?.sessions ?? null,
    productCoverage: { viewed: products.length, total: productList.totalItems },
  });

  const hourly = hourlyTotals(rows, "page_views");
  const matrix = weekdayHourMatrix(rows, "page_views");
  const weekdayTotals = matrix.map((hours) => hours.reduce((sum, value) => sum + value, 0));
  const peakHour = hourly.reduce((best, value, hour) => (value > hourly[best]! ? hour : best), 0);
  const peakWeekday = weekdayTotals.reduce((best, value, day) => (value > weekdayTotals[best]! ? day : best), 0);

  const insights = buildInsights({
    totals,
    previous,
    products,
    categories,
    previousProducts,
    sources,
    previousSources,
    searches,
    peak: hourly.some((value) => value > 0) ? { hour: peakHour, weekday: peakWeekday } : null,
    productLabels,
    categoryLabels,
  });

  // ─── Bölümler rapor tipine göre ───
  const tables: ReportTable[] = [];
  const series: Record<string, { date: string; value: number }[]> = {};

  const wantsMenu = type === "menu_performance" || type === "executive_summary";
  const wantsProducts = type === "product_performance" || type === "executive_summary";
  const wantsCategories = type === "category" || type === "executive_summary";
  const wantsBehavior = type === "customer_behavior" || type === "executive_summary";
  const wantsAcquisition = type === "acquisition" || type === "executive_summary";

  if (wantsMenu) {
    series.page_views = dailySeries(rows, range, "page_views");
    series.sessions = dailySeries(rows, range, "sessions");

    tables.push({
      key: "pages",
      title: "Sayfa kırılımı",
      columns: [
        { key: "page", label: "Sayfa" },
        { key: "views", label: "Görüntülenme", align: "right" },
      ],
      rows: pages
        .slice()
        .sort((a, b) => (b.metrics.views ?? 0) - (a.metrics.views ?? 0))
        .map((entry) => ({ page: PAGE_LABELS[entry.key] ?? entry.label, views: entry.metrics.views ?? 0 })),
    });

    tables.push({
      key: "devices",
      title: "Cihazlar",
      columns: [
        { key: "device", label: "Cihaz" },
        { key: "sessions", label: "Oturum", align: "right" },
        { key: "cart_adds", label: "Sepete ekleme", align: "right" },
      ],
      rows: devices.map((entry) => ({
        device: DEVICE_LABELS[entry.key] ?? entry.label,
        sessions: entry.metrics.sessions ?? 0,
        cart_adds: entry.metrics.cart_adds ?? 0,
      })),
    });
  }

  if (wantsProducts) {
    const sorted = productStats.slice().sort((a, b) => b.views - a.views);
    tables.push({
      key: "products",
      title: "Ürün performansı",
      columns: [
        { key: "product", label: "Ürün" },
        { key: "views", label: "Görüntülenme", align: "right" },
        { key: "detail_views", label: "Detay", align: "right" },
        { key: "cart_adds", label: "Sepete ekleme", align: "right" },
        { key: "conversion", label: "Dönüşüm", align: "right" },
        { key: "assessment", label: "Değerlendirme" },
      ],
      rows: (type === "executive_summary" ? sorted.slice(0, 10) : sorted).map((product) => ({
        product: product.label,
        views: product.views,
        detail_views: product.detail_views,
        cart_adds: product.cart_adds,
        conversion: percent(ratio(product.cart_adds, product.views), 0),
        assessment: classifyProduct(product, benchmarks).label,
      })),
    });
  }

  if (wantsCategories) {
    tables.push({
      key: "categories",
      title: "Kategori performansı",
      columns: [
        { key: "category", label: "Kategori" },
        { key: "views", label: "Görüntülenme", align: "right" },
        { key: "product_views", label: "Ürün görüntülenme", align: "right" },
        { key: "cart_adds", label: "Sepete ekleme", align: "right" },
        { key: "conversion", label: "Dönüşüm", align: "right" },
      ],
      rows: categories
        .slice()
        .sort((a, b) => (b.metrics.views ?? 0) - (a.metrics.views ?? 0))
        .map((entry) => ({
          category: categoryLabels.get(entry.key) ?? entry.label,
          views: entry.metrics.views ?? 0,
          product_views: entry.metrics.product_views ?? 0,
          cart_adds: entry.metrics.cart_adds ?? 0,
          conversion: percent(ratio(entry.metrics.cart_adds ?? 0, entry.metrics.product_views ?? 0), 1),
        })),
    });
  }

  if (wantsBehavior) {
    // Sıra ve etiketler lib/analytics/funnel.ts'ten; panel hunisiyle aynı hesap.
    const steps = buildFunnel(Object.fromEntries(funnel.map((entry) => [entry.key, entry.metrics.sessions ?? 0])));

    tables.push({
      key: "funnel",
      title: "Dönüşüm hunisi",
      columns: [
        { key: "step", label: "Adım" },
        { key: "sessions", label: "Oturum", align: "right" },
        { key: "conversion", label: "Geçiş", align: "right" },
      ],
      rows: steps.map((step) => ({
        step: step.label,
        sessions: step.sessions,
        conversion: step.conversion === null ? "—" : percent(step.conversion, 0),
      })),
    });

    tables.push({
      key: "visitors",
      title: "Yeni ve dönen ziyaretçi",
      columns: [
        { key: "segment", label: "Segment" },
        { key: "sessions", label: "Oturum", align: "right" },
        { key: "share", label: "Pay", align: "right" },
      ],
      rows: [
        {
          segment: "Yeni ziyaretçi",
          sessions: totals.new_sessions,
          share: percent(ratio(totals.new_sessions, totals.sessions), 0),
        },
        {
          segment: "Dönen ziyaretçi",
          sessions: totals.returning_sessions,
          share: percent(ratio(totals.returning_sessions, totals.sessions), 0),
        },
      ],
    });

    tables.push({
      key: "hours",
      title: "Saatlik yoğunluk",
      columns: [
        { key: "hour", label: "Saat" },
        { key: "views", label: "Görüntülenme", align: "right" },
      ],
      rows: hourly
        .map((value, hour) => ({ hour: `${String(hour).padStart(2, "0")}:00`, views: value }))
        .filter((row) => row.views > 0),
    });
  }

  if (wantsAcquisition) {
    tables.push({
      key: "sources",
      title: "Trafik kaynakları",
      columns: [
        { key: "source", label: "Kaynak" },
        { key: "sessions", label: "Oturum", align: "right" },
        { key: "cart_adds", label: "Sepete ekleme", align: "right" },
        { key: "conversion", label: "Dönüşüm", align: "right" },
      ],
      rows: sources
        .slice()
        .sort((a, b) => (b.metrics.sessions ?? 0) - (a.metrics.sessions ?? 0))
        .map((entry) => ({
          source: SOURCE_LABELS[entry.key] ?? entry.label,
          sessions: entry.metrics.sessions ?? 0,
          cart_adds: entry.metrics.cart_adds ?? 0,
          conversion: percent(ratio(entry.metrics.cart_adds ?? 0, entry.metrics.sessions ?? 0), 1),
        })),
    });

    if (qrCodes.length > 0) {
      tables.push({
        key: "qr",
        title: "QR performansı",
        columns: [
          { key: "qr", label: "QR kodu" },
          { key: "scans", label: "Tarama", align: "right" },
          { key: "sessions", label: "Oturum", align: "right" },
        ],
        rows: qrCodes
          .slice()
          .sort((a, b) => (b.metrics.scans ?? 0) - (a.metrics.scans ?? 0))
          .map((entry) => ({
            qr: qrLabels.get(entry.key) ?? entry.label,
            scans: entry.metrics.scans ?? 0,
            sessions: entry.metrics.sessions ?? 0,
          })),
      });
    }

    if (campaigns.length > 0) {
      tables.push({
        key: "campaigns",
        title: "Kampanyalar",
        columns: [
          { key: "campaign", label: "Kampanya" },
          { key: "views", label: "Gösterim", align: "right" },
          { key: "clicks", label: "Tıklama", align: "right" },
          { key: "rate", label: "Tıklama oranı", align: "right" },
        ],
        rows: campaigns.map((entry) => ({
          campaign: campaignLabels.get(entry.key) ?? entry.label,
          views: entry.metrics.views ?? 0,
          clicks: entry.metrics.clicks ?? 0,
          rate: percent(ratio(entry.metrics.clicks ?? 0, entry.metrics.views ?? 0), 0),
        })),
      });
    }
  }

  const definition = REPORT_DEFINITIONS.find((item) => item.type === type)!;

  return {
    type,
    title: definition.title,
    description: definition.description,
    business: {
      name: context.business.name,
      slug: context.business.slug,
      logo_url: context.business.logo_url || undefined,
    },
    range,
    comparison,
    generatedAt: new Date().toISOString(),
    summary: summarySentences(totals, previous, topProduct, topSource, bestCategory),
    totals,
    previous,
    changes,
    score: type === "executive_summary" ? score : null,
    series,
    tables,
    insights: type === "executive_summary" ? insights.map(({ title, detail, evidence, kind }) => ({ title, detail, evidence, kind })) : [],
  };
}
