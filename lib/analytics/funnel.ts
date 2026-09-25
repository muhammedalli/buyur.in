import type { AnalyticsEventType } from "@/lib/analytics/events";

// Müşteri yolculuğu hunisinin TEK kaynağı: adımların sırası, etiketi ve bir
// oturumun bir adıma "ulaştı" sayılma kuralı. Rollup (yazan), analiz ucu ve
// rapor (okuyan) buradan beslenir.
//
// Etiket bilerek veritabanı satırından okunmaz: rollup sıfır oturumlu adımın
// satırını yazmıyor, okuyan taraf da etiketi o satırdan aldığı için panelde
// ham anahtar ("product_detail", "cart_view") görünüyordu.
//
// Menüde adımlar atlanabiliyor: ürün kartındaki + ile detaya girmeden sepete
// eklenir, öne çıkanlardan kategoriye girmeden ürüne gidilir, önceki ziyaretten
// kalan sepetle sepet sayfası açılır. Adımlar birbirinden bağımsız sayılınca
// huni genişliyor, "1 oturum var ama %0 geçiş, %100 kayıp" gibi çelişkili
// sonuçlar çıkıyordu. Bu yüzden her adım bir öncekinin alt kümesi olacak
// biçimde tanımlanır. Kategori ve ürün detayı yan dallardır, huniye girmez;
// kendi kırılımlarında (kategori/ürün analitiği) görünürler.

export type FunnelStepKey = "menu_open" | "product_view" | "add_to_cart" | "cart_view";

export const FUNNEL_STEPS: readonly { key: FunnelStepKey; label: string }[] = [
  { key: "menu_open", label: "Menü açıldı" },
  { key: "product_view", label: "Ürün görüntülendi" },
  { key: "add_to_cart", label: "Sepete eklendi" },
  { key: "cart_view", label: "Sepet görüntülendi" },
];

/** Bir ürünü gördüğünü kanıtlayan event'ler: listede görmek, detayını açmak ya
 *  da sepete eklemek (görmeden eklenemez). */
const PRODUCT_SEEN = new Set<AnalyticsEventType>(["product_view", "product_detail_view", "add_to_cart"]);

/** Oturumların hangi adıma ulaştığını izler. Event'ler zaman sırasıyla
 *  verilmelidir: "sepet görüntülendi" yalnızca sepete eklemeden SONRA sayılır. */
export class FunnelTracker {
  private reached = new Map<FunnelStepKey, Set<string>>(FUNNEL_STEPS.map((step) => [step.key, new Set<string>()]));

  observe(type: AnalyticsEventType, session: string): void {
    if (!session) return;
    const reached = (key: FunnelStepKey) => this.reached.get(key)!;

    reached("menu_open").add(session);
    if (PRODUCT_SEEN.has(type)) reached("product_view").add(session);
    if (type === "add_to_cart") reached("add_to_cart").add(session);
    if (type === "cart_view" && reached("add_to_cart").has(session)) reached("cart_view").add(session);
  }

  counts(): Record<FunnelStepKey, number> {
    return Object.fromEntries(FUNNEL_STEPS.map((step) => [step.key, this.reached.get(step.key)!.size])) as Record<
      FunnelStepKey,
      number
    >;
  }
}

export interface FunnelStepResult {
  key: FunnelStepKey;
  label: string;
  sessions: number;
  /** Bir önceki adıma göre geçiş oranı (0–1). İlk adımda ve önceki adım boşken null. */
  conversion: number | null;
  /** Bu adımda kaybedilen pay (0–1). conversion null ise null. */
  dropoff: number | null;
}

/** Adım başına oturum sayılarından huniyi kurar.
 *
 *  Sayılar bir adımda bir öncekini aşamaz. Yeni rollup bunu tanım gereği
 *  sağlar; bu kural adımların bağımsız sayıldığı eski günlük satırlar içindir
 *  (o günler rollup ucu `?days=` ile yeniden hesaplanınca kesinleşir). */
export function buildFunnel(counts: Partial<Record<string, number>>): FunnelStepResult[] {
  let previous: number | null = null;
  return FUNNEL_STEPS.map((step) => {
    const raw = Math.max(0, counts[step.key] ?? 0);
    const sessions = previous === null ? raw : Math.min(raw, previous);
    const conversion = previous === null || previous === 0 ? null : sessions / previous;
    previous = sessions;
    return {
      key: step.key,
      label: step.label,
      sessions,
      conversion,
      dropoff: conversion === null ? null : 1 - conversion,
    };
  });
}
