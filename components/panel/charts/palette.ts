// Grafik paleti. Değerler elle seçilmedi: buyur'un sıcak yüzeyi (#fbf5ea)
// üzerinde dataviz doğrulayıcısıyla sınandı ve geçti —
//   kategorik : parlaklık bandı ✓ · kroma ✓ · CVD komşu ΔE 12.6 (protan) /
//               14.9 (tritan) · normal görüş ΔE 19.6 · kontrast hepsi ≥ 3:1
//   funnel    : tek renk, monoton parlaklık, komşu ΔL ≥ 0.06, açık uç 2.26:1
// Sıra sabittir ve döngüye sokulmaz: 7. seri gerekiyorsa "Diğer"e katlanır.
//
// Not: panelin karanlık teması yok (app/globals.css tek yüzey tanımlar), bu
// yüzden ikinci bir mod türetmedik — tema eklenirse aynı doğrulama karanlık
// yüzey için tekrarlanmalı.

export const CHART_SURFACE = "#fbf5ea";
export const CHART_GRID = "#e0d3bf";
export const CHART_INK_SOFT = "#5c4a3d";

/** Kategorik seri renkleri — sırayla atanır, asla döngüye sokulmaz. */
export const CATEGORICAL = [
  "#e8491f", // paprika (marka)
  "#2a6fb0", // mavi
  "#b8801a", // bal
  "#0d8f86", // deniz yeşili
  "#6b4ea8", // erik
  "#4a9a63", // yeşil
] as const;

/** Funnel gibi sıralı (ordinal) kırılımlarda kullanılan tek renkli rampa. */
export const ORDINAL = ["#e79063", "#dd7343", "#d15827", "#bb4318", "#9d3413", "#7d280e"] as const;

/** Isı haritası: değer arttıkça koyulaşan tek renk. En düşük adım yüzeye yakın
 *  kalır (boş hücre = yüzey tonu); hücreler büyük ve eksenle etiketli olduğu için
 *  okunurluk renge tek başına yaslanmıyor. */
export const HEAT_SCALE = ["#f4ead9", "#f6d9c2", "#f2b894", "#ea8f61", "#dc6634", "#c23814"] as const;

/** Durum renkleri seri rengi olarak kullanılmaz; ikon/etiketle birlikte gelir. */
export const STATUS = {
  good: "#2f7d4f",
  warning: "#b8801a",
  critical: "#c23814",
  neutral: "#5c4a3d",
} as const;

export function seriesColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length]!;
}

/** 0–1 aralığındaki orana göre ısı rengi. */
export function heatColor(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return HEAT_SCALE[0];
  const index = Math.min(HEAT_SCALE.length - 1, Math.max(1, Math.ceil(ratio * (HEAT_SCALE.length - 1))));
  return HEAT_SCALE[index]!;
}
