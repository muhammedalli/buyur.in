// Yönetimden işletme silme — YUMUŞAK silme. Kayıt ve bütün içeriği durur,
// geri alınabilir; kalıcı temizlik ayrı bir iştir.
//
// Silinen hesap:
//   - giriş yapamaz ve oturum yenileyemez (buyur_businesses.authRule,
//     scripts/business-schema.mjs); eldeki token'ları PocketBase hook'u düşürür;
//   - herkese açık hiçbir yüzeyde görünmez. Bunun için ayrı bir kontrol
//     eklemek yerine silme, askıyı da koyar: menü, site, /api/track, vitrin ve
//     sitemap zaten isSuspended() ile eler (CLAUDE.md §10). Tek kapı, unutulacak
//     yeni bir kontrol yok.
//   - yayından da kalkar (is_active = false): askı yalnızca uygulamada
//     uygulanır, PocketBase'in herkese açık okuma kuralı ise is_active'e bakar.
//     Silinen işletmenin adı ve menüsü ham API'den de okunamasın.
//   - Geri alınınca askı, yalnızca silmeyle birlikte konduysa kalkar; silmeden
//     önce zaten askıdaysa askıda kalır. Yayın durumu silmeden önceki hâline
//     döner; o hâl denetim kaydındaki silme kaydının "önce" değeridir.
//
// E-posta ve menü adresi (slug) silinen kayıtta kalır: aynı e-postayla yeni
// hesap açılamaz, adres başkasına geçmez. Geri alma bu yüzden sorunsuzdur.

import type { Business } from "@/lib/types";

export function isDeleted(business: Pick<Business, "deleted_at"> | null | undefined): boolean {
  return Boolean(business?.deleted_at?.trim());
}

function time(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value.trim().replace(" ", "T"));
  return Number.isNaN(ms) ? null : ms;
}

/** Askı silmeyle birlikte mi kondu (aynı an)? */
export function suspendedByDeletion(business: Pick<Business, "deleted_at" | "suspended_at">): boolean {
  const deleted = time(business.deleted_at);
  return deleted !== null && deleted === time(business.suspended_at);
}

export function deletionPatch(
  business: Pick<Business, "deleted_at" | "suspended_at"> & Partial<Pick<Business, "is_active">>,
  reason: string,
  now: Date = new Date()
): Record<string, unknown> {
  const at = now.toISOString();
  const patch: Record<string, unknown> = { deleted_at: at, deletion_reason: reason.trim().slice(0, 500) };
  if (!business.suspended_at?.trim()) {
    patch.suspended_at = at;
    patch.suspension_reason = "";
  }
  if (business.is_active) patch.is_active = false;
  return patch;
}

/** `wasActive`: silmeden önce yayında mıydı (silme kaydının "önce" değeri;
 *  bilinmiyorsa false — yayına almak yöneticinin bilinçli işlemi olsun). */
export function restorePatch(
  business: Pick<Business, "deleted_at" | "suspended_at"> & Partial<Pick<Business, "slug">>,
  wasActive = false
): Record<string, unknown> {
  const patch: Record<string, unknown> = { deleted_at: "", deletion_reason: "" };
  if (suspendedByDeletion(business)) {
    patch.suspended_at = "";
    patch.suspension_reason = "";
  }
  if (wasActive && business.slug) patch.is_active = true;
  return patch;
}
