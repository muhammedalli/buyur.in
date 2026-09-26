// Merkezi denetim kaydının (buyur_admin_logs) şeması ve kuralları —
// scripts/setup-pocketbase.mjs (sıfırdan kurulum) ile scripts/migrate-audit.mjs
// (mevcut kurulumun göçü) aynı tanımı buradan okur.
//
// Koleksiyonun adı tarihsel: ilk sürümde yalnızca yönetici işlemlerini
// tutuyordu. Artık sistemdeki bütün önemli işlemlerin tek kaydıdır; yazanlar:
//   - Next.js yönetim uçları (lib/admin-audit.ts, yöneticinin kendi token'ı),
//   - Next.js sunucu akışları (kayıt, AI, çıkış; servis hesabı),
//   - PocketBase hook'u (pocketbase/pb_hooks, işletme ve superuser yazmaları;
//     kurallardan bağımsız $app.save ile).
// Kaydı adını değiştirmek yerine genişlettik: canlıdaki geçmiş kayıtlar ve
// bağlantılar aynı yerde kalıyor.

import { ADMIN_BYPASS, SERVICE_ROLE } from "./admin-schema.mjs";

export const AUDIT_LOG_COLLECTION = "buyur_admin_logs";

/** Kaydı kimin yaptığı. lib/audit-log.ts → AUDIT_ACTOR_TYPES ile aynı. */
export const AUDIT_ACTOR_TYPES = ["admin", "business", "system", "superuser"];

/** Göçle eklenen alanlar (ilk sürümde yoktu). Setup de aynı nesneleri kullanır. */
export const AUDIT_LOG_NEW_FIELDS = [
  { name: "actor_type", type: "select", required: false, maxSelect: 1, values: AUDIT_ACTOR_TYPES },
  { name: "actor_id", type: "text", required: false, min: 0, max: 30, pattern: "", presentable: false },
  { name: "actor_email", type: "text", required: false, min: 0, max: 200, pattern: "", presentable: false },
  // İlişki değil düz metin: işletme kalıcı olarak silinse de geçmişi okunabilsin.
  { name: "business_id", type: "text", required: false, min: 0, max: 30, pattern: "", presentable: false },
  { name: "meta", type: "json", maxSize: 20000 },
];

export const AUDIT_LOG_INDEXES = [
  "CREATE UNIQUE INDEX `idx_admin_logs_op` ON `buyur_admin_logs` (`op_id`)",
  "CREATE INDEX `idx_admin_logs_created` ON `buyur_admin_logs` (`created`)",
  "CREATE INDEX `idx_admin_logs_target` ON `buyur_admin_logs` (`target_collection`, `target_id`)",
  "CREATE INDEX `idx_admin_logs_admin` ON `buyur_admin_logs` (`admin`)",
  "CREATE INDEX `idx_admin_logs_business` ON `buyur_admin_logs` (`business_id`, `created`)",
  "CREATE INDEX `idx_admin_logs_actor` ON `buyur_admin_logs` (`actor_id`, `created`)",
  "CREATE INDEX `idx_admin_logs_action` ON `buyur_admin_logs` (`action`)",
];

/** Yalnızca eklenir: güncelleme ve silme kuralı yok (null = yalnızca
 *  superuser); iz, yazan yönetici tarafından da silinemez.
 *  Yazan her zaman kendi adına yazar (`admin = auth.id`). Bir yönetici başka
 *  bir aktör adına kayıt atamaz; aktör alanı boş bırakılırsa kayıt yazan
 *  yöneticinindir. Başkası adına (işletme, sistem) yalnızca servis hesabı
 *  yazar: kayıt ve AI gibi sunucu akışları. */
export const AUDIT_LOG_RULES = {
  listRule: ADMIN_BYPASS,
  viewRule: ADMIN_BYPASS,
  createRule:
    `${ADMIN_BYPASS} && @request.body.admin = @request.auth.id && (@request.auth.role = "${SERVICE_ROLE}" || ` +
    `((@request.body.actor_type:isset = false || @request.body.actor_type = "admin") && ` +
    `(@request.body.actor_id:isset = false || @request.body.actor_id = @request.auth.id)))`,
  updateRule: null,
  deleteRule: null,
};
