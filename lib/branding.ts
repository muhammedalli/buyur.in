import { isFeatureAvailable } from "@/lib/entitlements";
import { ROOT_DOMAIN } from "@/lib/site";
import type { Business } from "@/lib/types";

// Menü ve otomatik sitedeki platform imzası ("buyur.in ile hazırlandı") ile
// menü logosunun götürdüğü adres tek yerden yönetilir. İleride bir partner
// ya da beyaz etiket kurulumu gerekirse değişecek yer burasıdır.

export interface PlatformBranding {
  /** İmzada görünen marka adı. */
  name: string;
  /** İmzanın ve menü logosunun götürdüğü ana sayfa. */
  href: string;
}

export const PLATFORM_BRANDING: PlatformBranding = {
  name: ROOT_DOMAIN,
  href: `https://${ROOT_DOMAIN}`,
};

/** Platform imzası bu işletmede görünür mü? "buyur markasını kaldırma"
 *  Premium ve Elite'te satılan bir özellik (lib/entitlements.ts →
 *  branding_removal); o planlarda imza gösterilmez. */
export function showsPlatformSignature(business: Pick<Business, "plan" | "plan_expires_at" | "menu_views">): boolean {
  return !isFeatureAvailable(business, "branding_removal");
}
