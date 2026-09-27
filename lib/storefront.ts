import { isFeatureAvailable, isSubscriptionActive } from "@/lib/entitlements";
import { isSuspended } from "@/lib/business-suspension";
import { menuUrl } from "@/lib/site";
import type { Business } from "@/lib/types";

export { isTableScan } from "@/lib/storefront-route";

// İşletmenin vitrini: isletme.buyur.in kökü.
//
//   buyur.in            → pazarlama sitesi
//   isletme.buyur.in    → vitrin: web sitesi yayındaysa işletme sitesi, değilse
//                         işletme bilgilerinden otomatik karşılama sayfası
//   isletme.buyur.in/menu → QR menü
//
// Masadaki QR'dan gelen ziyaretçi menüyü okumaya gelmiştir: `?qr=<kod>`
// (etiketli QR'lar) ya da `?src=qr` (panelin ana QR'ı) taşıyan kök isteği
// vitrine uğramadan doğrudan menüye gider (middleware.ts). Böylece basılı
// etiketli QR'lar ekstra bir dokunuş istemez.

type WebsiteGate = Pick<Business, "plan" | "plan_expires_at" | "menu_views" | "suspended_at" | "site_disabled">;

/** İşletmenin yayında bir web sitesi var mı: plan izin veriyor, abonelik
 *  sürüyor, askıda değil ve sahibi siteyi kapatmamış. */
export function hasActiveWebsite(business: WebsiteGate): boolean {
  return (
    !business.site_disabled &&
    !isSuspended(business) &&
    isFeatureAvailable(business, "website") &&
    isSubscriptionActive(business)
  );
}

/** Menünün adresi (vitrin kökünden ayrı). */
export function menuPageUrl(slug: string): string {
  return `${menuUrl(slug)}/menu`;
}

/** Panelin ana QR kodunun içeriği: tarama doğrudan menüye düşer ve analizde
 *  "QR" kaynağı olarak sayılır. Paylaşılan link ise vitrindir (menuUrl). */
export function mainQrUrl(slug: string): string {
  return `${menuUrl(slug)}/menu?src=qr`;
}
