import type { Business } from "@/lib/types";

const MS_PER_DAY = 86_400_000;

/** Bitişe bu kadar gün ya da daha az kaldığında panelde hatırlatma gösterilir. */
export const TRIAL_WARNING_DAYS = 14;

/** PocketBase tarihleri "2026-07-20 10:03:41.308Z" biçiminde döner; aradaki
 *  boşluk yüzünden bazı tarayıcılar (Safari) doğrudan parse edemiyor. */
function parsePocketBaseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ay ekler. Karşılığı olmayan günlerde (31 Ocak + 1 ay) sonraki aya taşmak
 *  yerine hedef ayın son gününe sabitler — deneme süresi hiçbir işletmede
 *  birkaç gün uzamasın diye. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const expectedMonth = (((result.getMonth() + months) % 12) + 12) % 12;
  result.setMonth(result.getMonth() + months);
  if (result.getMonth() !== expectedMonth) result.setDate(0);
  return result;
}

/** Yeni hesabın plan alanları. Varsayılan plan admin panelinden değişebilir
 *  (buyur_plans.is_default); kayıt okunamazsa "freemium"a düşülür ve süre
 *  yazılmaz — yanlış bir tarihle işletmeyi "süresi dolmuş" göstermektense
 *  süresiz kabul etmek daha az zararlıdır. Süre kayıt anında sabitlenir:
 *  plan kaydındaki süre sonradan değişse bile mevcut işletmenin hakkı değişmez.
 *  Bu alanlar hesap sahibine kapalıdır (scripts/business-schema.mjs), bu
 *  yüzden yalnızca sunucu yazar. */
export function initialPlanFields(
  defaultPlan: { key?: string; trial_months?: number } | null,
  now: Date = new Date()
): { plan: string; freemium_started_at: string; plan_expires_at: string; menu_views: number } {
  const trialMonths = defaultPlan?.trial_months ?? 0;
  return {
    plan: defaultPlan?.key || "freemium",
    freemium_started_at: trialMonths > 0 ? now.toISOString() : "",
    plan_expires_at: trialMonths > 0 ? addMonths(now, trialMonths).toISOString() : "",
    menu_views: 0,
  };
}

export interface TrialStatus {
  expiresAt: Date;
  /** Bitişe kalan tam gün; süre dolduysa 0. */
  daysLeft: number;
  expired: boolean;
  /** Süre dolmuş ya da bitmesine TRIAL_WARNING_DAYS'ten az kalmış. */
  warn: boolean;
}

/** Süreli plandaki işletmenin kalan süresini hesaplar. `plan_expires_at` boşsa
 *  (ücretli plan ya da göç öncesi kayıt) null döner — süre takibi yok demektir. */
export function trialStatus(
  business: Pick<Business, "plan_expires_at">,
  now: Date = new Date()
): TrialStatus | null {
  const expiresAt = parsePocketBaseDate(business.plan_expires_at);
  if (!expiresAt) return null;

  const msLeft = expiresAt.getTime() - now.getTime();
  const daysLeft = msLeft > 0 ? Math.ceil(msLeft / MS_PER_DAY) : 0;

  return {
    expiresAt,
    daysLeft,
    expired: msLeft <= 0,
    warn: daysLeft <= TRIAL_WARNING_DAYS,
  };
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
