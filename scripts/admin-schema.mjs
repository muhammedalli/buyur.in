// Yönetim hesabı koleksiyonunun (buyur_admins) rolleri ve kuralları —
// scripts/setup-pocketbase.mjs (sıfırdan kurulum) ile scripts/migrate-admin.mjs
// (mevcut kurulumun göçü) aynı cümleleri buradan okur; ikisi ayrışırsa setup,
// göçün kurduğu kuralları sessizce geri yazardı.

export const ADMIN_COLLECTION = "buyur_admins";

export const ADMIN_BYPASS = '@request.auth.collectionName = "buyur_admins"';

/** Sunucunun servis hesabı (lib/pocketbase-server.ts). İnsan değildir: panele
 *  giremez (lib/admin-roles.ts yalnızca super_admin/support tanır) ama plan ve
 *  sayaç alanlarını yazabilmesi gerekir (kayıt, menü sayacı, AI kotası).
 *  Önceden `support` rolündeydi; o yüzden DB kuralları destek rolünü plan
 *  yazımından ayıramıyordu. */
export const SERVICE_ROLE = "service";

export const ADMIN_ROLE_VALUES = ["super_admin", "support", SERVICE_ROLE];

/** Plan ve hesap gibi gelir/erişim kararlarını DB seviyesinde yazabilen
 *  yönetim hesapları. Panel tarafındaki eşi: lib/admin-roles.ts. */
export const TRUSTED_ADMIN = `(${ADMIN_BYPASS} && (@request.auth.role = "super_admin" || @request.auth.role = "${SERVICE_ROLE}"))`;

export const SUPER_ADMIN = `(${ADMIN_BYPASS} && @request.auth.role = "super_admin")`;

/** buyur_admins API kuralları. Bir admin yalnızca kendini görür, super_admin
 *  herkesi. Kendi kaydını güncelleyebilir (ad, şifre) ama ROLÜNÜ ve erişimini
 *  değiştiremez: aksi hâlde destek hesabı kendini super_admin yapabilirdi.
 *
 *  super_admin panelden hesap açar, rol değiştirir ve erişimi kapatır
 *  (app/api/admin/admins). Üç kilit:
 *  - servis hesabına dokunamaz ve kimseyi servis rolüne alamaz (sunucunun
 *    kimliğini bozmak kayıt/sayaç/AI yazımlarını durdururdu);
 *  - kendi rolünü ve erişimini değiştiremez (kendini kilitleyemez; "son
 *    super_admin" kuralının DB tarafındaki yarısı);
 *  - erişimi kapalı hesap (`disabled_at`) giriş yapamaz ve token yenileyemez
 *    (authRule). Eldeki token'ları hook düşürür (pocketbase/pb_hooks). */
const NOT_SERVICE = `role != "${SERVICE_ROLE}" && @request.body.role != "${SERVICE_ROLE}"`;
const OWN_ACCESS_UNTOUCHED = "@request.body.role:isset = false && @request.body.disabled_at:isset = false";

export const ADMIN_RULES = {
  listRule: `id = @request.auth.id || ${SUPER_ADMIN}`,
  viewRule: `id = @request.auth.id || ${SUPER_ADMIN}`,
  createRule: `${SUPER_ADMIN} && @request.body.role != "${SERVICE_ROLE}"`,
  updateRule: `(id = @request.auth.id && ${OWN_ACCESS_UNTOUCHED}) || (${SUPER_ADMIN} && ${NOT_SERVICE} && (id != @request.auth.id || (${OWN_ACCESS_UNTOUCHED})))`,
  deleteRule: `${SUPER_ADMIN} && role != "${SERVICE_ROLE}" && id != @request.auth.id`,
  manageRule: `${SUPER_ADMIN} && role != "${SERVICE_ROLE}"`,
  authRule: 'disabled_at = ""',
};
