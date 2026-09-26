/// <reference path="../pb_data/types.d.ts" />

// buyur merkezi denetim kaydı — kurulum ve gerekçe: docs/audit-log.md.
// Mantık buyur_audit.js'te; handler'lar yalıtılmış çalıştığı için her biri
// modülü kendisi require() eder. Koleksiyon listesi lib/audit-log.ts →
// AUDITED_COLLECTIONS ile aynı kalmalı (tests/audit-hook.test.ts kilitler).

onRecordCreateRequest(
  (e) => {
    require(`${__hooks}/buyur_audit.js`).handleWrite(e, "create");
  },
  "buyur_businesses",
  "buyur_categories",
  "buyur_products",
  "buyur_product_options",
  "buyur_popups",
  "buyur_qr_codes",
  "buyur_plans",
  "buyur_settings"
);

onRecordUpdateRequest(
  (e) => {
    require(`${__hooks}/buyur_audit.js`).handleWrite(e, "update");
  },
  "buyur_businesses",
  "buyur_categories",
  "buyur_products",
  "buyur_product_options",
  "buyur_popups",
  "buyur_qr_codes",
  "buyur_plans",
  "buyur_settings"
);

onRecordDeleteRequest(
  (e) => {
    require(`${__hooks}/buyur_audit.js`).handleWrite(e, "delete");
  },
  "buyur_businesses",
  "buyur_categories",
  "buyur_products",
  "buyur_product_options",
  "buyur_popups",
  "buyur_qr_codes",
  "buyur_plans",
  "buyur_settings"
);

onRecordAuthWithPasswordRequest((e) => {
  require(`${__hooks}/buyur_audit.js`).handlePasswordAuth(e);
}, "buyur_businesses");

// Hesap kapatıldığında (işletme silindi / yönetici erişimi kaldırıldı) eldeki
// oturumlar da düşsün. authRule yalnızca giriş ve yenilemede bakılır; zaten
// alınmış bir token süresi dolana kadar diğer isteklerde geçerli kalırdı.
// tokenKey yenilenince o hesabın bütün token'ları geçersizleşir.
onRecordUpdateRequest(
  (e) => {
    const field = e.record.collection().name === "buyur_admins" ? "disabled_at" : "deleted_at";
    if (!e.record.original().getString(field) && e.record.getString(field)) e.record.refreshTokenKey();
    e.next();
  },
  "buyur_businesses",
  "buyur_admins"
);
