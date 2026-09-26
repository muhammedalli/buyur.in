// Merkezi denetim kaydı göçü. Mevcut bir kurulumu Super Admin paneline hazırlar:
//   1) buyur_admin_logs: aktör/işletme/meta alanlarını ekler, admin_email'i
//      zorunlu olmaktan çıkarır (işletme ve sistem kayıtlarında yönetici yok),
//      filtre indekslerini ve yazma kuralını kurar.
//   2) Eski kayıtları doldurur: aktör = kaydı yazan yönetici, işletme =
//      hedef işletme. Böylece işletme ve kullanıcı filtreleri eski kayıtları da bulur.
//   3) buyur_businesses: yumuşak silme alanları (deleted_at, deletion_reason),
//      bunları koruyan kurallar ve silinen hesabı girişe kapatan authRule.
//   4) buyur_admins: erişim kapatma alanı (disabled_at), panelden hesap
//      açma/rol değiştirme kuralları ve authRule.
//   5) buyur_categories / buyur_products: super_admin'in panelden içerik
//      ekleyebilmesi için createRule; buyur_product_options: yönetim okur,
//      super_admin (silme geri alınırken) ekleyebilir.
//
// SIRA: alanlar kurallardan önce eklenir (kural var olmayan alana bakamaz).
// Her adım eski kodla uyumludur: eski kod aktör alanı yazmaz (kural buna
// izin verir), hiçbir işletme/yönetici silinmiş ya da kapalı değildir. Bu
// yüzden deploy'dan ÖNCE çalıştırılabilir. PocketBase hook'u
// (pocketbase/pb_hooks) bu göçten sonra kurulmalı; önce kurulursa göç
// yapılana kadar kayıt yazmadan çalışır.
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-audit.mjs --dry-run
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-audit.mjs
// Önkoşul: scripts/migrate-admin.mjs daha önce çalışmış olmalı (servis rolü).
// Idempotent: her adım zaten uygulanmışsa atlanır.

import PocketBase from "pocketbase";
import { ADMIN_BYPASS, ADMIN_COLLECTION, ADMIN_RULES, SUPER_ADMIN } from "./admin-schema.mjs";
import { AUDIT_LOG_COLLECTION, AUDIT_LOG_INDEXES, AUDIT_LOG_NEW_FIELDS, AUDIT_LOG_RULES } from "./audit-schema.mjs";
import { BUSINESS_COLLECTION, BUSINESS_RULES } from "./business-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule", "manageRule", "authRule"];

const dateField = (name) => ({ name, type: "date", required: false });
const textField = (name, max) => ({ name, type: "text", required: false, min: 0, max, pattern: "", presentable: false });

/** Eksik alanları ekler, istenen alan ayarlarını (ör. required) eşitler. */
async function syncFields(collectionName, wanted, adjust = {}) {
  const collection = await pb.collections.getOne(collectionName);
  const names = new Set(collection.fields.map((f) => f.name));
  const missing = wanted.filter((f) => !names.has(f.name));
  const adjusted = [];
  const fields = collection.fields.map((field) => {
    const patch = adjust[field.name];
    if (!patch) return field;
    const differs = Object.entries(patch).some(([key, value]) => field[key] !== value);
    if (!differs) return field;
    adjusted.push(field.name);
    return { ...field, ...patch };
  });
  if (missing.length === 0 && adjusted.length === 0) {
    console.log(`= ${collectionName} alanları zaten güncel.`);
    return;
  }
  const summary = [
    missing.length ? `+${missing.map((f) => f.name).join(", ")}` : "",
    adjusted.length ? `~${adjusted.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (DRY_RUN) {
    console.log(`~ ${collectionName} alanları DEĞİŞECEK: ${summary}`);
    return;
  }
  await pb.collections.update(collection.id, { fields: [...fields, ...missing] });
  console.log(`~ ${collectionName} alanları güncellendi: ${summary}`);
}

async function syncRules(collectionName, rules) {
  const collection = await pb.collections.getOne(collectionName);
  const changes = {};
  for (const key of RULE_KEYS) {
    if (!(key in rules)) continue;
    const wanted = rules[key] ?? null;
    if (wanted !== (collection[key] ?? null)) changes[key] = wanted;
  }
  if (Object.keys(changes).length === 0) {
    console.log(`= ${collectionName} kuralları zaten güncel.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`~ ${collectionName} kuralları DEĞİŞECEK:`);
    for (const [key, wanted] of Object.entries(changes)) {
      console.log(`    ${key}\n      şu an: ${collection[key] ?? "null"}\n      olacak: ${wanted ?? "null"}`);
    }
    return;
  }
  await pb.collections.update(collection.id, changes);
  console.log(`~ ${collectionName} kuralları güncellendi: ${Object.keys(changes).join(", ")}`);
}

/** Tanımda olup koleksiyonda olmayan indeksleri ekler; var olanlara dokunmaz. */
async function syncIndexes(collectionName, wanted) {
  const collection = await pb.collections.getOne(collectionName);
  const nameOf = (sql) => sql.match(/INDEX\s+`([^`]+)`/i)?.[1];
  const existing = new Set((collection.indexes ?? []).map(nameOf));
  const missing = wanted.filter((sql) => !existing.has(nameOf(sql)));
  if (missing.length === 0) {
    console.log(`= ${collectionName} indeksleri zaten güncel.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`~ ${collectionName} indeksleri EKLENECEK: ${missing.map(nameOf).join(", ")}`);
    return;
  }
  await pb.collections.update(collection.id, { indexes: [...(collection.indexes ?? []), ...missing] });
  console.log(`~ ${collectionName} indeksleri eklendi: ${missing.map(nameOf).join(", ")}`);
}

/** Aktörü boş eski kayıtları doldurur. Superuser token'ı güncelleme kuralı
 *  kapalı koleksiyona yazabilir; kayıtların içeriği (ne, ne zaman, önce/sonra)
 *  değişmez, yalnızca zaten bilinen aktör ve işletme ayrı alana kopyalanır. */
async function backfillLogs() {
  const serviceEmail = process.env.PB_SERVICE_EMAIL?.trim().toLowerCase() ?? "";
  let done = 0;
  for (;;) {
    const page = await pb.collection(AUDIT_LOG_COLLECTION).getList(1, 200, {
      filter: 'actor_type = ""',
      sort: "created",
      requestKey: null,
    });
    if (page.items.length === 0) break;
    if (DRY_RUN) {
      console.log(`~ ${page.totalItems} eski kayıt DOLDURULACAK (aktör ve işletme).`);
      return;
    }
    // Sıralı: PocketBase ani yükte 503 verir (CLAUDE.md §3.7).
    for (const log of page.items) {
      const isService = serviceEmail && log.admin_email?.toLowerCase() === serviceEmail;
      await pb.collection(AUDIT_LOG_COLLECTION).update(
        log.id,
        {
          actor_type: isService ? "system" : "admin",
          actor_id: log.admin ?? "",
          actor_email: log.admin_email ?? "",
          business_id: log.target_collection === BUSINESS_COLLECTION ? log.target_id ?? "" : "",
        },
        { requestKey: null }
      );
      done += 1;
    }
  }
  console.log(done ? `~ ${done} eski kayıt dolduruldu.` : "= eski kayıtlar zaten dolu.");
}

async function main() {
  if (DRY_RUN) console.log("(kuru çalışma — hiçbir şey yazılmaz)\n");

  await syncFields(AUDIT_LOG_COLLECTION, AUDIT_LOG_NEW_FIELDS, { admin_email: { required: false } });
  await syncIndexes(AUDIT_LOG_COLLECTION, AUDIT_LOG_INDEXES);
  await syncRules(AUDIT_LOG_COLLECTION, AUDIT_LOG_RULES);
  if (DRY_RUN) {
    console.log("~ eski kayıtlar alanlar eklendikten sonra doldurulacak.");
  } else {
    await backfillLogs();
  }

  await syncFields(BUSINESS_COLLECTION, [dateField("deleted_at"), textField("deletion_reason", 500)]);
  await syncRules(BUSINESS_COLLECTION, BUSINESS_RULES);

  await syncFields(ADMIN_COLLECTION, [dateField("disabled_at")]);
  await syncRules(ADMIN_COLLECTION, ADMIN_RULES);

  const contentCreate = `business = @request.auth.id || ${SUPER_ADMIN}`;
  await syncRules("buyur_categories", { createRule: contentCreate });
  await syncRules("buyur_products", { createRule: contentCreate });
  const ownsOption = "product.business = @request.auth.id";
  await syncRules("buyur_product_options", {
    listRule: `product.business.is_active = true || ${ownsOption} || ${ADMIN_BYPASS}`,
    viewRule: `product.business.is_active = true || ${ownsOption} || ${ADMIN_BYPASS}`,
    createRule: `${ownsOption} || ${SUPER_ADMIN}`,
  });

  console.log(DRY_RUN ? "\nKuru çalışma bitti." : "\nGöç tamamlandı. Sıradaki adım: pocketbase/pb_hooks kurulumu (docs/audit-log.md).");
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
