// Sistem ayarları koleksiyonunun (buyur_settings) şeması, kuralları ve tohum
// değerleri — scripts/setup-pocketbase.mjs (sıfırdan kurulum) ile
// scripts/migrate-settings.mjs (mevcut kurulumun göçü) aynı tanımı buradan okur.
//
// Uygulama tarafı lib/system-settings.ts'tir: ayarın adı, sınırları ve kayıt
// okunamazsa geçerli yedek değeri orada. Tohum değerler o yedekle aynı olmalı
// (tests/system-settings.test.ts kilitler).

import { SUPER_ADMIN } from "./admin-schema.mjs";

export const SETTINGS_COLLECTION = "buyur_settings";

/** Herkese okunur: fiyat sayfası ve işletme paneli yıllık fiyatı buradan
 *  hesaplar. Bu yüzden koleksiyona gizli bir değer YAZILMAZ. Yazma yalnızca
 *  super_admin'e açık (panelde de requireAdmin({ action: "settings.edit" })). */
export const SETTINGS_RULES = {
  listRule: "",
  viewRule: "",
  createRule: SUPER_ADMIN,
  updateRule: SUPER_ADMIN,
  deleteRule: SUPER_ADMIN,
};

export const SETTINGS_FIELDS = [
  { name: "key", type: "text", required: true, min: 1, max: 60, pattern: "^[a-z0-9_]+$", presentable: true },
  // Değer tipi ayar tanımında (lib/system-settings.ts); JSON sayı/metin taşır.
  { name: "value", type: "json", maxSize: 2000 },
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

export const SETTINGS_INDEXES = ["CREATE UNIQUE INDEX `idx_settings_key` ON `buyur_settings` (`key`)"];

/** Yeni kurulumun ilk değerleri. Var olan bir ayarın değerine göç dokunmaz. */
export const SETTING_SEEDS = [
  // Yıllık ödemede aylık fiyattan düşülen oran (%). Önceki ilan fiyatları
  // (249 → 199,20 · 749 → 599,20) tam olarak bu orandan geliyordu.
  { key: "yearly_discount_percent", value: 20 },
];
