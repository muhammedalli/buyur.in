// İşletme hesabı koleksiyonunun (buyur_businesses, auth tipi) kuralları —
// scripts/setup-pocketbase.mjs (sıfırdan kurulum) ile
// scripts/migrate-merge-business-auth.mjs (mevcut kurulumun göçü) aynı
// cümleleri buradan okur; ikisi ayrışırsa setup, göçün kurduğu kuralları
// sessizce geri yazardı.
//
// Model: 1 işletme hesabı = 1 buyur_businesses kaydı = 1 kimlik. Giriş
// e-postası/şifre PocketBase'in auth alanlarında, işletmenin tüm bilgileri
// (ad, slug, iletişim, plan…) aynı kayıttadır. Ayrı bir kullanıcı tablosu yok.

import { ADMIN_BYPASS, TRUSTED_ADMIN } from "./admin-schema.mjs";

export { ADMIN_BYPASS };

export const BUSINESS_COLLECTION = "buyur_businesses";

/** Sahibinin panelden DEĞİŞTİREMEYECEĞİ alanlar: plan ve sayaçlar yalnızca
 *  sunucu (servis hesabı) ve yönetim tarafından yazılır. Önceden işletme
 *  sahibi kendi kaydında `plan: "elite"` ya da `ai_scans_used: 0` yazarak
 *  ücretli plana/ek kotaya kendini geçirebiliyordu. */
export const BUSINESS_PROTECTED_FIELDS = [
  "plan",
  "freemium_started_at",
  "plan_expires_at",
  "menu_views",
  "ai_scans_used",
  "ai_scans_period",
  // Yönetimden askıya alma (lib/business-suspension.ts): sahibi kendi menüsünü
  // yeniden açamamalı.
  "suspended_at",
  "suspension_reason",
];

/** Destek rolünün de yazamadığı alanlar: plan ve kullanım sayacı gelir
 *  kararıdır. Deneme süresi ve AI kotası destekte kalır (lib/admin-roles.ts →
 *  business.trial_extend, business.ai_quota_reset). Panel bu kuralı zaten
 *  sunucuda uygular; bu, admin token'ı bir şekilde sızarsa ikinci kilittir. */
export const SUPPORT_LOCKED_FIELDS = ["plan", "menu_views", "suspended_at", "suspension_reason"];

const guard = (fields) => fields.map((field) => `@request.body.${field}:isset = false`).join(" && ");
const protectedGuard = guard(BUSINESS_PROTECTED_FIELDS);
const supportGuard = guard(SUPPORT_LOCKED_FIELDS);

/** buyur_businesses API kuralları. Menü herkese açıktır ama yalnızca yayında
 *  (is_active) olan işletmeler görünür; kurulumu bitmemiş hesap görünmez.
 *  Giriş e-postası PocketBase tarafından gizlenir (emailVisibility). */
export const BUSINESS_RULES = {
  listRule: `is_active = true || id = @request.auth.id || ${ADMIN_BYPASS}`,
  viewRule: `is_active = true || id = @request.auth.id || ${ADMIN_BYPASS}`,
  // Hesap tarayıcıdan açılmaz: /api/auth/register OTP doğrulandıktan sonra
  // servis hesabıyla oluşturur.
  createRule: TRUSTED_ADMIN,
  updateRule: `(id = @request.auth.id && ${protectedGuard}) || ${TRUSTED_ADMIN} || (${ADMIN_BYPASS} && ${supportGuard})`,
  deleteRule: `id = @request.auth.id || ${TRUSTED_ADMIN}`,
  // Şifre/e-posta'yı eski şifre olmadan değiştirme yetkisi: şifre sıfırlama
  // akışı (servis hesabı) ve super_admin. Destek sıfırlama e-postası gönderir,
  // şifreyi kendisi koymaz.
  manageRule: TRUSTED_ADMIN,
};

/** Bağlı koleksiyonlardaki eski "sahibin işletmesi" ifadesini yeni modele
 *  çevirir: `business.owner = @request.auth.id` → `business = @request.auth.id`
 *  (işletme kaydının kendisi kimliktir). `product.business.owner` de aynı
 *  şekilde `product.business` olur. */
export function rewriteOwnerRule(rule) {
  if (typeof rule !== "string") return rule;
  return rule.replace(/\bbusiness\.owner\b/g, "business");
}
