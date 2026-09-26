import { systemSetting } from "@/lib/system-settings";
import type { Plan } from "@/lib/types";

// İlan edilen fiyatlar `buyur_plans` koleksiyonundan okunur — kodda rakam YOK.
// Fiyat değişikliği admin panelinden yapılır; en geç bir dakika içinde landing,
// panel, yasal sayfalar ve yapılandırılmış veri (JSON-LD) aynı rakamı gösterir
// (bkz. lib/plan-catalog-loader.ts). Tohum değerler yalnızca yeni bir ortamı
// kurarken kullanılan scripts/plan-catalog.mjs içinde durur.
//
// Her planın TEK fiyatı vardır: aylık fiyat (`price_monthly`). Yıllık ödemenin
// aylık karşılığı ondan türetilir: sistem ayarındaki yıllık indirim oranı
// (lib/system-settings.ts → yearly_discount_percent, varsayılan %20) düşülür.
// Kayıttaki eski `price_yearly_monthly` alanı artık okunmaz; iki fiyatın elle
// ayrı ayrı tutulup birbirinden kopması böylece mümkün değil.
//
// Kayıt okunamamışsa ücretli planların fiyatı BİLİNMEZ (null): ekranlar rakam
// uydurmak yerine "fiyat için bize yazın" der. Ücretsiz plan tanım gereği 0₺.

export interface PlanPricing {
  /** Aylık ödemede aylık ücret. */
  monthly: number;
  /** Yıllık ödemede aylık eşdeğer ücret; yıllık toplam = 12 katı. */
  yearlyMonthly: number;
}

export const MONTHS_IN_YEAR = 12;

const FREE: PlanPricing = { monthly: 0, yearlyMonthly: 0 };

/** Plan → aylık fiyat (yıllık karşılık okuma anında hesaplanır: indirim
 *  oranı fiyattan bağımsız değişebilir). */
let liveMonthly: Partial<Record<Plan, number>> = {};

export interface PlanPriceRecord {
  key?: string;
  price_monthly?: unknown;
}

const isPrice = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Kuruşa yuvarlar: 249 × 0,8 kayan noktada 199.20000000000002 çıkıyor. */
const toKurus = (amount: number) => Math.round(amount * 100) / 100;

/** Aylık fiyattan yıllık ödemenin aylık karşılığı. */
export function yearlyMonthlyPrice(monthly: number, discountPercent: number = systemSetting("yearly_discount_percent")): number {
  return toKurus((monthly * (100 - discountPercent)) / 100);
}

/** `buyur_plans` kayıtlarındaki fiyatları yükler. Geçersiz/eksik fiyatlı kayıt
 *  yok sayılır: yanlış bir fiyat göstermektense hiç göstermemek daha güvenli. */
export function applyPlanPrices(records: PlanPriceRecord[]): void {
  const next: Partial<Record<Plan, number>> = {};
  for (const record of records) {
    if (record.key !== "premium" && record.key !== "elite") continue;
    if (!isPrice(record.price_monthly)) continue;
    next[record.key] = record.price_monthly;
  }
  liveMonthly = next;
}

export function resetPlanPrices(): void {
  liveMonthly = {};
}

/** Planın ilan fiyatı; ücretli plan için kayıt okunamadıysa null. */
export function planPricing(plan: Plan): PlanPricing | null {
  if (plan === "freemium") return FREE;
  const monthly = liveMonthly[plan];
  if (monthly === undefined) return null;
  return { monthly, yearlyMonthly: yearlyMonthlyPrice(monthly) };
}

/** Yıllık ödemede tek seferde tahsil edilen tutar. */
export function yearlyTotal(pricing: PlanPricing): number {
  return pricing.yearlyMonthly * MONTHS_IN_YEAR;
}

/** Yıllık ödemenin aylığa göre indirim oranı (tam sayı yüzde). */
export function yearlyDiscountPercent(pricing: PlanPricing): number {
  if (pricing.monthly <= 0) return 0;
  return Math.round((1 - pricing.yearlyMonthly / pricing.monthly) * 100);
}

/** Kuruşu olan tutarlarda iki hane (199,20₺ · 2.390,40₺), tam sayılarda hiç
 *  (249₺): ilan edilen fiyat faturadaki tutarla birebir okunsun, ama ekranda
 *  gereksiz ",00" dolaşmasın.
 *
 *  Kayan nokta toleransı: 199,2 × 12 aritmetikte 2390.3999999999996 çıkıyor;
 *  bunu "tam sayı değil" diye değil, gerçekten kuruşlu olduğu için iki haneyle
 *  yazıyoruz — ama 200 × 12 gibi tam sonuçlar yuvarlama artığı yüzünden
 *  kuruşlu görünmesin diye kuruş kontrolünü yuvarlayarak yapıyoruz. */
export function formatTL(amount: number): string {
  const kurus = Math.round(amount * 100) % 100;
  const digits = kurus === 0 ? 0 : 2;
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)}₺`;
}
