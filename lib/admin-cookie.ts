// Admin çerez adları. Middleware (edge) de okuduğu için bu dosya node:crypto
// gibi sunucuya özel bir bağımlılık taşımaz.

/** Şifreli admin oturumu (lib/admin-session.ts). */
export const ADMIN_COOKIE_NAME = "buyur_admin_auth";

/** Şifre doğrulandı, e-posta kodu bekleniyor. Oturum çerezi DEĞİLDİR:
 *  yalnızca /api/admin/auth altında gönderilir ve oturum yerine geçmez. */
export const ADMIN_PENDING_COOKIE_NAME = "buyur_admin_pending";
export const ADMIN_PENDING_COOKIE_PATH = "/api/admin/auth";
