import { msg } from "@/lib/ui-i18n";

// Ürün fırsat analizi: hangi üründe ne yapılmalı sorusuna veriyle cevap.
// Eşikler sabit sayı değil, işletmenin kendi medyanı — 40 ürünlük bir kafeyle
// 400 ürünlük bir otel aynı ölçüye vurulamaz. Medyan kullanıyoruz çünkü tek bir
// "vitrin ürünü" ortalamayı yukarı çekip diğer her şeyi "düşük" gösterebiliyor.

export type OpportunityKind = "star" | "hidden_gem" | "leaky" | "underperformer" | "insufficient";

export interface ProductStat {
  key: string;
  label: string;
  views: number;
  detail_views: number;
  cart_adds: number;
}

export interface Opportunity {
  kind: OpportunityKind;
  /** Kısa rozet metni. */
  label: string;
  /** Ne olduğunu anlatan cümle (msg ile işaretli; ekranda t(message, messageVars)). */
  message: string;
  messageVars?: Record<string, number>;
  /** Ne yapılabileceğine dair somut öneri (yoksa null). */
  recommendation: string | null;
}

/** Bu eşiğin altındaki görüntülenmede sınıflandırma yapmıyoruz: birkaç
 *  görüntülemeden çıkan "dönüşüm %100" gibi sonuçlar gürültüdür. */
export const MIN_VIEWS_FOR_CLASSIFICATION = 20;

export interface OpportunityBenchmarks {
  medianViews: number;
  medianConversion: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function computeBenchmarks(products: ProductStat[]): OpportunityBenchmarks {
  const eligible = products.filter((product) => product.views >= MIN_VIEWS_FOR_CLASSIFICATION);
  const base = eligible.length >= 3 ? eligible : products;

  return {
    medianViews: median(base.map((product) => product.views)),
    medianConversion: median(
      base.filter((product) => product.views > 0).map((product) => product.cart_adds / product.views)
    ),
  };
}

export function classifyProduct(product: ProductStat, benchmarks: OpportunityBenchmarks): Opportunity {
  if (product.views < MIN_VIEWS_FOR_CLASSIFICATION) {
    return {
      kind: "insufficient",
      label: msg("Veri az"),
      message: msg("Bu içgörüyü oluşturmak için daha fazla veriye ihtiyacımız var (en az {count} görüntülenme)."),
      messageVars: { count: MIN_VIEWS_FOR_CLASSIFICATION },
      recommendation: null,
    };
  }

  const conversion = product.views > 0 ? product.cart_adds / product.views : 0;
  const highViews = product.views >= benchmarks.medianViews;
  const highConversion = conversion >= benchmarks.medianConversion;

  if (highViews && highConversion) {
    return {
      kind: "star",
      label: msg("Yıldız ürün"),
      message: msg("Hem çok görüntüleniyor hem de sepete girme oranı menü ortalamanızın üstünde."),
      recommendation: msg("Menüde en üstte tutun; kampanya ve öneri alanlarında bu ürünü kullanın."),
    };
  }

  if (highViews && !highConversion) {
    return {
      kind: "leaky",
      label: msg("Yüksek ilgi, düşük dönüşüm"),
      message: msg("Müşteriler bu ürüne bakıyor ama sepete eklemiyor."),
      recommendation: msg("Fiyat, görsel, açıklama ve porsiyon bilgisini gözden geçirin — ilgi var, ikna eksik."),
    };
  }

  if (!highViews && highConversion) {
    return {
      kind: "hidden_gem",
      label: msg("Gizli değer"),
      message: msg("Az görülüyor ama görenlerin sepete ekleme oranı yüksek."),
      recommendation: msg("Ürünü kategorisinde yukarı taşıyın, \"popüler\" rozeti ekleyin veya kampanyaya dahil edin."),
    };
  }

  return {
    kind: "underperformer",
    label: msg("Zayıf performans"),
    message: msg("Hem görüntülenme hem dönüşüm menü ortalamanızın altında."),
    recommendation: msg("Görsel ve açıklamayı yenileyin, konumunu değiştirin; iyileşmezse menüden çıkarmayı değerlendirin."),
  };
}

/** Rozet renkleri için durum eşlemesi (renk tek başına anlam taşımasın diye
 *  arayüzde her zaman metinle birlikte kullanılıyor). */
export const OPPORTUNITY_TONE: Record<OpportunityKind, "good" | "warning" | "critical" | "neutral"> = {
  star: "good",
  hidden_gem: "good",
  leaky: "warning",
  underperformer: "critical",
  insufficient: "neutral",
};
