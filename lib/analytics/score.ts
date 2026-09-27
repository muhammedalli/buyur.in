import { msg } from "@/lib/ui-i18n";
import type { OverviewTotals } from "@/lib/analytics/query";

// Menü performans skoru. Kara kutu değil: her bileşenin ne ölçtüğü, hangi hedefe
// göre puanlandığı ve ağırlığı açıkça döner — işletme skoru sorgulayabilsin diye.
// Hedefler menüva'daki tipik menü davranışından seçildi ve tek yerde tanımlı.

export interface ScoreComponent {
  key: string;
  label: string;
  /** Ölçülen ham değer (oran ya da saniye). */
  value: number;
  /** 100 puan alınacak hedef. */
  target: number;
  /** 0-100 arası bileşen puanı. */
  score: number;
  weight: number;
  /** Okuyucuya gösterilecek biçimlendirilmiş değer. */
  display: string;
  hint: string;
}

export interface MenuScore {
  /** 0-100; yeterli veri yoksa null. */
  score: number | null;
  components: ScoreComponent[];
  strengths: string[];
  weaknesses: string[];
  /** Skorun hesaplanabilmesi için gereken minimum örneklem sağlandı mı. */
  sufficient: boolean;
  sampleSessions: number;
}

/** Bu oturum sayısının altında skor üretmiyoruz — birkaç ziyaretten çıkan puan yanıltır. */
export const MIN_SESSIONS_FOR_SCORE = 50;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function percentDisplay(value: number): string {
  return `%${(value * 100).toFixed(1).replace(".", ",")}`;
}

function durationDisplay(seconds: number): string {
  const total = Math.round(seconds);
  return total >= 60 ? `${Math.floor(total / 60)}dk ${total % 60}sn` : `${total}sn`;
}

export interface ScoreInput {
  totals: OverviewTotals;
  previousSessions: number | null;
  /** Menüdeki toplam ürün sayısı ve bunlardan kaçının görüntülendiği. */
  productCoverage: { viewed: number; total: number };
}

export function computeMenuScore(input: ScoreInput): MenuScore {
  const { totals } = input;
  const sufficient = totals.sessions >= MIN_SESSIONS_FOR_SCORE;

  const components: ScoreComponent[] = [];

  // 1) Etkileşim: menüde geçirilen süre.
  components.push({
    key: "engagement",
    label: msg("Menüde geçirilen süre"),
    value: totals.avg_session_duration,
    target: 90,
    score: clamp((totals.avg_session_duration / 90) * 100),
    weight: 0.2,
    display: durationDisplay(totals.avg_session_duration),
    hint: msg("Ortalama oturum süresi. 90 saniye ve üzeri tam puan."),
  });

  // 2) Derinlik: oturum başına görüntülenen sayfa.
  components.push({
    key: "depth",
    label: msg("Oturum başına sayfa"),
    value: totals.pages_per_session,
    target: 4,
    score: clamp((totals.pages_per_session / 4) * 100),
    weight: 0.15,
    display: totals.pages_per_session.toFixed(1).replace(".", ","),
    hint: msg("Bir ziyarette gezilen sayfa sayısı. 4 sayfa ve üzeri tam puan."),
  });

  // 3) Dönüşüm: sepete ekleme oranı.
  components.push({
    key: "conversion",
    label: msg("Sepet dönüşümü"),
    value: totals.cart_conversion,
    target: 0.25,
    score: clamp((totals.cart_conversion / 0.25) * 100),
    weight: 0.25,
    display: percentDisplay(totals.cart_conversion),
    hint: msg("Sepete ekleme yapan oturumların payı. %25 ve üzeri tam puan."),
  });

  // 4) Ürün kapsamı: menünün ne kadarı görülüyor.
  const coverage = input.productCoverage.total > 0 ? input.productCoverage.viewed / input.productCoverage.total : 0;
  components.push({
    key: "coverage",
    label: msg("Ürün kapsamı"),
    value: coverage,
    target: 0.7,
    score: clamp((coverage / 0.7) * 100),
    weight: 0.15,
    display: `${percentDisplay(coverage)} (${input.productCoverage.viewed}/${input.productCoverage.total})`,
    hint: msg("Menüdeki ürünlerin ne kadarının görüntülendiği. %70 ve üzeri tam puan."),
  });

  // 5) Dönen ziyaretçi.
  components.push({
    key: "returning",
    label: msg("Dönen ziyaretçi"),
    value: totals.returning_rate,
    target: 0.3,
    score: clamp((totals.returning_rate / 0.3) * 100),
    weight: 0.15,
    display: percentDisplay(totals.returning_rate),
    hint: msg("Daha önce menünüzü açmış ziyaretçilerin payı. %30 ve üzeri tam puan."),
  });

  // 6) Trafik büyümesi (karşılaştırma yoksa nötr 50 puan — cezalandırmıyoruz).
  const growth =
    input.previousSessions && input.previousSessions > 0
      ? (totals.sessions - input.previousSessions) / input.previousSessions
      : null;
  components.push({
    key: "growth",
    label: msg("Trafik değişimi"),
    value: growth ?? 0,
    target: 0.1,
    score: growth === null ? 50 : clamp(50 + (growth / 0.1) * 50),
    weight: 0.1,
    display: growth === null ? "karşılaştırma yok" : percentDisplay(growth),
    hint: msg("Önceki döneme göre oturum değişimi. %10 büyüme tam puan; karşılaştırma kapalıysa nötr sayılır."),
  });

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weighted = components.reduce((sum, component) => sum + component.score * component.weight, 0);
  const score = sufficient ? Math.round(weighted / totalWeight) : null;

  return {
    score,
    components,
    strengths: components.filter((component) => component.score >= 70).map((component) => component.label),
    weaknesses: components.filter((component) => component.score < 45).map((component) => component.label),
    sufficient,
    sampleSessions: totals.sessions,
  };
}
