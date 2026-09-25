// İşletme hesabı koleksiyonunun (buyur_businesses, auth tipi) kuralları —
// scripts/setup-pocketbase.mjs (sıfırdan kurulum) ile
// scripts/migrate-merge-business-auth.mjs (mevcut kurulumun göçü) aynı
// cümleleri buradan okur; ikisi ayrışırsa setup, göçün kurduğu kuralları
// sessizce geri yazardı.
//
// Model: 1 işletme hesabı = 1 buyur_businesses kaydı = 1 kimlik. Giriş
// e-postası/şifre PocketBase'in auth alanlarında, işletmenin tüm bilgileri
// (ad, slug, iletişim, plan…) aynı kayıttadır. Ayrı bir kullanıcı tablosu yok.

export const BUSINESS_COLLECTION = "buyur_businesses";

export const ADMIN_BYPASS = '@request.auth.collectionName = "buyur_admins"';

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
];

const protectedGuard = BUSINESS_PROTECTED_FIELDS.map((field) => `@request.body.${field}:isset = false`).join(" && ");

/** buyur_businesses API kuralları. Menü herkese açıktır ama yalnızca yayında
 *  (is_active) olan işletmeler görünür; kurulumu bitmemiş hesap görünmez.
 *  Giriş e-postası PocketBase tarafından gizlenir (emailVisibility). */
export const BUSINESS_RULES = {
  listRule: `is_active = true || id = @request.auth.id || ${ADMIN_BYPASS}`,
  viewRule: `is_active = true || id = @request.auth.id || ${ADMIN_BYPASS}`,
  // Hesap tarayıcıdan açılmaz: /api/auth/register OTP doğrulandıktan sonra
  // servis hesabıyla oluşturur.
  createRule: ADMIN_BYPASS,
  updateRule: `(id = @request.auth.id && ${protectedGuard}) || ${ADMIN_BYPASS}`,
  deleteRule: `id = @request.auth.id || ${ADMIN_BYPASS}`,
  manageRule: ADMIN_BYPASS,
};

/** Bağlı koleksiyonlardaki eski "sahibin işletmesi" ifadesini yeni modele
 *  çevirir: `business.owner = @request.auth.id` → `business = @request.auth.id`
 *  (işletme kaydının kendisi kimliktir). `product.business.owner` de aynı
 *  şekilde `product.business` olur. */
export function rewriteOwnerRule(rule) {
  if (typeof rule !== "string") return rule;
  return rule.replace(/\bbusiness\.owner\b/g, "business");
}
