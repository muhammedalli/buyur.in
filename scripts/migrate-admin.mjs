// Yönetim paneli göçü. Mevcut bir kurulumu admin paneline hazırlar:
//   1) buyur_otps.purpose listesine "admin_login" ekler (admin giriş kodu).
//   2) buyur_admins.role listesine "service" ekler.
//   3) Servis hesabını (PB_SERVICE_EMAIL) "service" rolüne taşır.
//   4) buyur_admins ve buyur_businesses kurallarını sıkılaştırır: destek rolü
//      plan/sayaç yazamaz, hiçbir admin kendi rolünü değiştiremez.
//   5) buyur_admin_logs'un kurulu ve yalnızca eklenebilir olduğunu doğrular.
//
// SIRA ÖNEMLİ: 4. adım servis hesabını rolüne göre tanır. 3. adım olmadan
// uygulanırsa kayıt, menü sayacı ve AI kotası yazımları durur. Bu yüzden
// kurallar setup-pocketbase.mjs'ten önce burada, rol taşındıktan sonra yazılır.
// Her adım eski kodla da uyumludur; deploy'dan önce ya da sonra çalışabilir.
//
// Kullanım (canlı için önerilen sıra):
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... PB_SERVICE_EMAIL=... \
//     node scripts/migrate-admin.mjs --dry-run   # önce bak
//   ... node scripts/migrate-admin.mjs            # 1–4
//   ... node scripts/setup-pocketbase.mjs          # buyur_admin_logs'u kurar
//   ... node scripts/migrate-admin.mjs            # hepsi "= güncel" demeli
// Idempotent: her adım zaten uygulanmışsa atlanır.

import PocketBase from "pocketbase";
import { ADMIN_COLLECTION, ADMIN_ROLE_VALUES, ADMIN_RULES, SERVICE_ROLE } from "./admin-schema.mjs";
import { BUSINESS_COLLECTION, BUSINESS_RULES } from "./business-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const SERVICE_EMAIL = process.env.PB_SERVICE_EMAIL?.trim().toLowerCase();
const DRY_RUN = process.argv.includes("--dry-run");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

const OTP_PURPOSES = ["register", "password_reset", "admin_login"];
const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule", "manageRule"];

/** Bir select alanının değer listesini genişletir (eski değerler korunur:
 *  bekleyen kayıtlar geçersiz olmasın). getOrCreate bunu yapmaz. */
async function widenSelect(collectionName, fieldName, wanted) {
  const collection = await pb.collections.getOne(collectionName);
  const field = collection.fields.find((f) => f.name === fieldName);
  if (!field) {
    throw new Error(`${collectionName} içinde '${fieldName}' alanı yok. Önce scripts/setup-pocketbase.mjs çalıştırın.`);
  }
  const missing = wanted.filter((value) => !field.values.includes(value));
  if (missing.length === 0) {
    console.log(`= ${collectionName}.${fieldName} zaten güncel.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`~ ${collectionName}.${fieldName} GENİŞLETİLECEK: +${missing.join(", ")}`);
    return;
  }
  const values = Array.from(new Set([...field.values, ...wanted]));
  await pb.collections.update(collection.id, {
    fields: collection.fields.map((f) => (f.name === fieldName ? { ...f, values } : f)),
  });
  console.log(`~ ${collectionName}.${fieldName} genişletildi: +${missing.join(", ")}`);
}

/** Servis hesabını "service" rolüne taşır. Hesap bulunamazsa kurallar
 *  UYGULANMAZ: yanlış e-postayla çalıştırılan göç sunucuyu kilitlemesin. */
async function moveServiceAccount() {
  if (!SERVICE_EMAIL) {
    console.error("! PB_SERVICE_EMAIL verilmedi; servis hesabı bulunamadan kurallar sıkılaştırılmaz.");
    return false;
  }
  let account;
  try {
    account = await pb.collection(ADMIN_COLLECTION).getFirstListItem(pb.filter("email = {:email}", { email: SERVICE_EMAIL }));
  } catch (err) {
    if (err?.status !== 404) throw err;
    console.error(`! Servis hesabı bulunamadı: ${SERVICE_EMAIL}. Kurallar sıkılaştırılmadı.`);
    return false;
  }
  if (account.role === SERVICE_ROLE) {
    console.log(`= servis hesabı zaten "${SERVICE_ROLE}" rolünde.`);
    return true;
  }
  if (DRY_RUN) {
    console.log(`~ servis hesabı "${account.role}" → "${SERVICE_ROLE}" TAŞINACAK.`);
    return true;
  }
  await pb.collection(ADMIN_COLLECTION).update(account.id, { role: SERVICE_ROLE });
  console.log(`~ servis hesabı "${account.role}" → "${SERVICE_ROLE}" taşındı.`);
  return true;
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

async function checkAdminLogs() {
  const collection = await pb.collections.getOne("buyur_admin_logs").catch((err) => {
    if (err?.status === 404) return null;
    throw err;
  });
  if (!collection) {
    console.log("! buyur_admin_logs henüz yok → şimdi scripts/setup-pocketbase.mjs çalıştırın.");
    return;
  }
  // Güncelleme/silme kuralı açılmışsa kayıt artık kanıt değildir.
  if (collection.updateRule !== null || collection.deleteRule !== null) {
    console.error("! buyur_admin_logs güncellenebilir ya da silinebilir durumda. scripts/setup-pocketbase.mjs kuralları geri yazar.");
    process.exitCode = 2;
    return;
  }
  console.log("= buyur_admin_logs kurulu ve yalnızca eklenebilir.");
}

async function main() {
  if (DRY_RUN) console.log("(kuru çalışma — hiçbir şey yazılmaz)\n");
  await widenSelect("buyur_otps", "purpose", OTP_PURPOSES);
  await widenSelect(ADMIN_COLLECTION, "role", ADMIN_ROLE_VALUES);
  const serviceReady = await moveServiceAccount();
  if (serviceReady) {
    await syncRules(ADMIN_COLLECTION, ADMIN_RULES);
    await syncRules(BUSINESS_COLLECTION, BUSINESS_RULES);
  } else {
    process.exitCode = 2;
  }
  await checkAdminLogs();
  console.log(DRY_RUN ? "\nKuru çalışma bitti." : "\nGöç tamamlandı.");
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
