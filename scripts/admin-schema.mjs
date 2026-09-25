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
 *  herkesi. Kendi kaydını güncelleyebilir (ad, şifre) ama ROLÜNÜ değiştiremez:
 *  aksi hâlde destek hesabı kendini super_admin yapabilirdi. Hesaplar API'den
 *  açılmaz; scripts/create-admin.mjs superuser token'ıyla açar. */
export const ADMIN_RULES = {
  listRule: `id = @request.auth.id || ${SUPER_ADMIN}`,
  viewRule: `id = @request.auth.id || ${SUPER_ADMIN}`,
  createRule: null,
  updateRule: `(id = @request.auth.id && @request.body.role:isset = false) || ${SUPER_ADMIN}`,
  deleteRule: SUPER_ADMIN,
  manageRule: SUPER_ADMIN,
};
