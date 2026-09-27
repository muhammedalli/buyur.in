// Ödemeler göçü (sürüm 0.9.0): buyur_payments koleksiyonunu oluşturur.
// Şema ve kurallar scripts/payments-schema.mjs'te. Yeni bir koleksiyon eklediği
// için eski kodla uyumludur; yeni kod koleksiyon yokken Ödemeler ekranında
// "kayıtlar okunamadı" der — deploy'dan ÖNCE çalıştırın.
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-payments.mjs --dry-run
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-payments.mjs
// Idempotent: koleksiyon varsa yalnızca kuralları ve eksik alanları eşitler.

import PocketBase from "pocketbase";
import { BUSINESS_COLLECTION } from "./business-schema.mjs";
import { PAYMENTS_COLLECTION, PAYMENTS_INDEXES, PAYMENTS_RULES, paymentFields } from "./payments-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

async function main() {
  const businesses = await pb.collections.getOne(BUSINESS_COLLECTION);
  const fields = paymentFields(businesses.id);

  let existing = null;
  try {
    existing = await pb.collections.getOne(PAYMENTS_COLLECTION);
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  if (!existing) {
    if (DRY_RUN) {
      console.log(`+ ${PAYMENTS_COLLECTION} OLUŞTURULACAK — alanlar: ${fields.map((f) => f.name).join(", ")}`);
      return;
    }
    await pb.collections.create({
      name: PAYMENTS_COLLECTION,
      type: "base",
      ...PAYMENTS_RULES,
      fields,
      indexes: PAYMENTS_INDEXES,
    });
    console.log(`+ ${PAYMENTS_COLLECTION} oluşturuldu.`);
    return;
  }

  const changes = [];
  const ruleDiff = Object.entries(PAYMENTS_RULES).filter(([key, rule]) => existing[key] !== rule);
  if (ruleDiff.length > 0) changes.push(`kurallar: ${ruleDiff.map(([key]) => key).join(", ")}`);
  const names = new Set(existing.fields.map((field) => field.name));
  const missing = fields.filter((field) => !names.has(field.name));
  if (missing.length > 0) changes.push(`alanlar: +${missing.map((field) => field.name).join(", ")}`);

  if (changes.length === 0) {
    console.log(`= ${PAYMENTS_COLLECTION} zaten güncel.`);
    return;
  }
  if (DRY_RUN) {
    for (const change of changes) console.log(`~ ${PAYMENTS_COLLECTION} DEĞİŞECEK — ${change}`);
    return;
  }
  await pb.collections.update(existing.id, { ...PAYMENTS_RULES, fields: [...existing.fields, ...missing] });
  for (const change of changes) console.log(`~ ${PAYMENTS_COLLECTION} güncellendi — ${change}`);
}

main().catch((err) => {
  console.error("Göç başarısız:", err?.response ?? err);
  process.exit(1);
});
