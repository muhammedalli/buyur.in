// Ödemeler koleksiyonunun (buyur_payments) şeması ve kuralları —
// scripts/setup-pocketbase.mjs (sıfırdan kurulum) ile scripts/migrate-payments.mjs
// (mevcut kurulumun göçü) aynı tanımı buradan okur.
//
// Uygulama tarafı lib/payments.ts'tir (tür/durum/yöntem sözlükleri, bakiye
// hesabı); değer listeleri orada birebir aynı olmalı (tests/payments.test.ts
// kilitler). Ayrıntı: docs/payments.md.

import { ADMIN_BYPASS, SUPER_ADMIN } from "./admin-schema.mjs";

export const PAYMENTS_COLLECTION = "buyur_payments";

export const PAYMENT_TYPE_VALUES = ["charge", "incoming", "outgoing"];
export const PAYMENT_STATUS_VALUES = ["completed", "pending", "cancelled"];
export const PAYMENT_METHOD_VALUES = ["bank_transfer", "credit_card", "cash", "online", "other"];

/** Yalnızca yönetim görür. Yazma super_admin'e açık: panelde de
 *  requireAdmin({ action: "payments.edit" }) (lib/admin-roles.ts) ve her
 *  yazma denetim kaydına düşer (app/api/admin/payments). İşletme sahibi bu
 *  koleksiyonu hiç okuyamaz. */
export const PAYMENTS_RULES = {
  listRule: ADMIN_BYPASS,
  viewRule: ADMIN_BYPASS,
  createRule: SUPER_ADMIN,
  updateRule: SUPER_ADMIN,
  deleteRule: SUPER_ADMIN,
};

/** `business` ilişkisi göç sırasında koleksiyon kimliğiyle kurulur. İşletme
 *  silinse de para kaydı kalmalıdır: cascadeDelete kapalı (işletme silme zaten
 *  yumuşaktır, lib/business-deletion.ts). */
export function paymentFields(businessCollectionId) {
  return [
    {
      name: "business",
      type: "relation",
      required: true,
      collectionId: businessCollectionId,
      cascadeDelete: false,
      minSelect: 0,
      maxSelect: 1,
    },
    { name: "type", type: "select", required: true, maxSelect: 1, values: PAYMENT_TYPE_VALUES },
    // Kuruş cinsinden tamsayı (1.250,50 ₺ = 125050). Üst sınır lib/payments.ts → AMOUNT_MAX.
    { name: "amount", type: "number", required: true, min: 1, max: 1000000000, onlyInt: true },
    { name: "date", type: "date", required: true },
    { name: "method", type: "select", required: false, maxSelect: 1, values: PAYMENT_METHOD_VALUES },
    { name: "status", type: "select", required: true, maxSelect: 1, values: PAYMENT_STATUS_VALUES },
    { name: "note", type: "text", required: false, min: 0, max: 500, pattern: "", presentable: false },
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
}

export const PAYMENTS_INDEXES = [
  "CREATE INDEX `idx_payments_business_date` ON `buyur_payments` (`business`, `date`)",
  "CREATE INDEX `idx_payments_date` ON `buyur_payments` (`date`)",
];
