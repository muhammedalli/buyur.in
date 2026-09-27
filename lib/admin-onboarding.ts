// Yönetim panelinden yeni işletme açmanın SAF kuralları: hangi girdi kabul
// edilir, kayda hangi alanlar yazılır. Ağ yok; sözleşmesi
// tests/admin-onboarding.test.ts. Uygulama: app/api/admin/businesses (POST).
//
// Kayıt ekranından farkı: e-posta kodu yok, telefon biçimi engellemez ve
// başka hesapta kayıtlı e-posta da kabul edilir (bkz. loginEmailAlias). Hesabı
// super_admin kendi kimliğiyle açar ve işlem denetim kaydına düşer. Kurulum
// adımı (ad + menü adresi + görünüm) de burada tamamlanır; işletme panele ilk
// girişte kurulum ekranı görmez. Menü tek dilde açılır; ek dil işletme
// panelinden eklenir.

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import { SLUG_MAX, SLUG_MIN, normalizeSlugInput } from "@/lib/admin-business-actions";
import { PLAN_ORDER } from "@/lib/entitlements";
import { isValidEmail, normalizeEmail } from "@/lib/otp-client";
import { newPasswordError } from "@/lib/password";
import { formatTurkishPhone } from "@/lib/phone";
import { addMonths } from "@/lib/plan-period";
import { SECTOR_TEMPLATES, sectorTemplate } from "@/lib/sector-templates";
import { isReservedSlug } from "@/lib/slug";
import type { Plan } from "@/lib/types";

export const BUSINESS_NAME_MAX = 120;

export interface NewBusinessInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  slug?: unknown;
  sector?: unknown;
  mainLanguage?: unknown;
  plan?: unknown;
  /** Planın bitiş günü (YYYY-MM-DD). Süreli planda boşsa plan süresinden hesaplanır. */
  expiresOn?: unknown;
  /** Menü hemen yayına girsin mi. */
  publish?: unknown;
}

/** Planın süresi (ay). null = süresiz. Sunucu plan kataloğundan okur. */
export type PlanDuration = (plan: Plan) => number | null;

export type NewBusinessResult =
  | { ok: true; data: Record<string, unknown>; slug: string; email: string }
  | { ok: false; error: string; field?: string };

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Telefon yönetim ekranında hiçbir zaman engel olmaz: Türkiye numarası tek
 *  biçime getirilir, değilse yazıldığı gibi (şema sınırı 30) saklanır, boş da
 *  olabilir. Aynı numara başka işletmede kayıtlı olabilir; tekillik yok. */
export function adminPhone(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  return formatTurkishPhone(trimmed) ?? trimmed.slice(0, 30);
}

/** Giriş e-postası PocketBase'de tekildir (auth koleksiyonu). Yöneticinin
 *  yazdığı e-posta başka bir hesapta kayıtlıysa (ör. aynı sahibin ikinci
 *  şubesi) giriş için artı adresli bir takma ad kullanılır:
 *  sahip@ornek.com → sahip+kuzey-kafe@ornek.com. Gmail, Outlook, iCloud ve
 *  çoğu sağlayıcı "+" sonrasını yok sayar; şifre sıfırlama e-postası yine aynı
 *  kutuya düşer. `attempt` > 1 ise sona sayı eklenir. Yerel kısım 64
 *  karakteri geçmez. */
export function loginEmailAlias(email: string, slug: string, attempt = 1): string {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const suffix = attempt > 1 ? `-${attempt}` : "";
  const room = Math.max(1, 64 - local.length - 1 - suffix.length);
  const tag = slug.slice(0, room).replace(/-+$/, "") || "hesap";
  return `${local}+${tag}${suffix}@${domain}`;
}

export function buildNewBusiness(input: NewBusinessInput, durationOf: PlanDuration, now: Date = new Date()): NewBusinessResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > BUSINESS_NAME_MAX) return { ok: false, error: "İşletme adını girin.", field: "name" };

  if (!isValidEmail(input.email)) return { ok: false, error: "Geçerli bir e-posta adresi girin.", field: "email" };
  const email = normalizeEmail(input.email);

  const phone = adminPhone(input.phone);

  const password = typeof input.password === "string" ? input.password : "";
  const passwordError = newPasswordError(password, password);
  if (passwordError) return { ok: false, error: passwordError, field: "password" };

  const slug = normalizeSlugInput(input.slug);
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return { ok: false, error: `Menü adresi ${SLUG_MIN}–${SLUG_MAX} karakter olmalı.`, field: "slug" };
  }
  if (isReservedSlug(slug)) return { ok: false, error: "Bu adres sistem tarafından kullanılıyor, başka bir adres seçin.", field: "slug" };

  const sectorKey = typeof input.sector === "string" ? input.sector : "";
  if (!SECTOR_TEMPLATES.some((item) => item.key === sectorKey)) return { ok: false, error: "İşletme türünü seçin.", field: "sector" };
  const template = sectorTemplate(sectorKey).template;

  const main = typeof input.mainLanguage === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(input.mainLanguage)
    ? (input.mainLanguage as Locale)
    : null;
  if (!main) return { ok: false, error: "Menünün dilini seçin.", field: "mainLanguage" };

  if (typeof input.plan !== "string" || !(PLAN_ORDER as string[]).includes(input.plan)) {
    return { ok: false, error: "Geçerli bir plan seçin.", field: "plan" };
  }
  const plan = input.plan as Plan;
  const expiresRaw = typeof input.expiresOn === "string" ? input.expiresOn.trim() : "";
  let expires: Date | null = null;
  if (expiresRaw) {
    expires = parseDay(expiresRaw);
    if (!expires) return { ok: false, error: "Bitiş tarihi okunamadı.", field: "expiresOn" };
    if (expires.getTime() <= now.getTime()) return { ok: false, error: "Bitiş tarihi ileri bir tarih olmalı.", field: "expiresOn" };
  }
  const months = durationOf(plan);
  const timeLimited = months !== null;
  // Süreli planda bitiş yoksa kayıt ekranıyla aynı hesap: bugün + plan süresi.
  if (timeLimited && !expires) expires = addMonths(now, months);

  return {
    ok: true,
    slug,
    email,
    data: {
      email,
      password,
      passwordConfirm: password,
      emailVisibility: false,
      name,
      slug,
      phone,
      template,
      main_language: main,
      languages: [],
      is_active: input.publish !== false,
      activation: { sector: sectorKey },
      plan,
      freemium_started_at: timeLimited ? now.toISOString() : "",
      plan_expires_at: expires ? expires.toISOString() : "",
      menu_views: 0,
    },
  };
}

function secureRandom(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

/** Yöneticinin tek tıkla alabileceği güçlü geçici şifre. Karışan karakterler
 *  (0/O, 1/l/I) yok: telefonda okunup yazılacak. */
export function generatePassword(random: (max: number) => number = secureRandom): string {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set: string) => set[random(set.length)];
  const chars = [pick(upper), pick(digits), ...Array.from({ length: 8 }, () => pick(lower + digits)), pick(upper), pick(digits)];
  return chars.join("");
}
