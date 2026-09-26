// Sistem ayarları göçü: buyur_settings koleksiyonunu kurar ve eksik ayarları
// tohum değerleriyle ekler (scripts/settings-schema.mjs).
//
// Eski kodla uyumludur: eski kod bu koleksiyonu hiç okumaz. Yeni kod ise
// koleksiyon yoksa yedek değerle (%20) çalışır ama tarayıcıda 404 isteği
// görünür; bu yüzden deploy'dan ÖNCE çalıştırılmalıdır. Var olan bir ayarın
// değerine dokunmaz (değerler yönetim panelinden değişir).
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-settings.mjs --dry-run
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-settings.mjs
// Önkoşul: scripts/migrate-admin.mjs daha önce çalışmış olmalı (super_admin rolü).
// Idempotent: her adım zaten uygulanmışsa atlanır.

import PocketBase from "pocketbase";
import {
  SETTINGS_COLLECTION,
  SETTINGS_FIELDS,
  SETTINGS_INDEXES,
  SETTINGS_RULES,
  SETTING_SEEDS,
} from "./settings-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];

/** Koleksiyonu kurar ya da var olanın kurallarını/alanlarını/indeksini eşitler. */
async function ensureCollection() {
  const existing = await pb.collections.getOne(SETTINGS_COLLECTION).catch((err) => {
    if (err?.status === 404) return null;
    throw err;
  });

  if (!existing) {
    if (DRY_RUN) {
      console.log(`+ ${SETTINGS_COLLECTION} OLUŞTURULACAK`);
      return false;
    }
    await pb.collections.create({
      name: SETTINGS_COLLECTION,
      type: "base",
      ...SETTINGS_RULES,
      fields: SETTINGS_FIELDS,
      indexes: SETTINGS_INDEXES,
    });
    console.log(`+ ${SETTINGS_COLLECTION} oluşturuldu.`);
    return true;
  }

  const names = new Set(existing.fields.map((f) => f.name));
  const missing = SETTINGS_FIELDS.filter((f) => !names.has(f.name));
  const ruleChanges = {};
  for (const key of RULE_KEYS) {
    const wanted = SETTINGS_RULES[key] ?? null;
    if (wanted !== (existing[key] ?? null)) ruleChanges[key] = wanted;
  }
  const nameOf = (sql) => sql.match(/INDEX\s+`([^`]+)`/i)?.[1];
  const indexNames = new Set((existing.indexes ?? []).map(nameOf));
  const missingIndexes = SETTINGS_INDEXES.filter((sql) => !indexNames.has(nameOf(sql)));

  if (missing.length === 0 && Object.keys(ruleChanges).length === 0 && missingIndexes.length === 0) {
    console.log(`= ${SETTINGS_COLLECTION} zaten güncel.`);
    return true;
  }
  const summary = [
    missing.length ? `alanlar: +${missing.map((f) => f.name).join(", ")}` : "",
    Object.keys(ruleChanges).length ? `kurallar: ${Object.keys(ruleChanges).join(", ")}` : "",
    missingIndexes.length ? `indeks: +${missingIndexes.map(nameOf).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  if (DRY_RUN) {
    console.log(`~ ${SETTINGS_COLLECTION} DEĞİŞECEK (${summary})`);
    return true;
  }
  await pb.collections.update(existing.id, {
    ...ruleChanges,
    ...(missing.length ? { fields: [...existing.fields, ...missing] } : {}),
    ...(missingIndexes.length ? { indexes: [...(existing.indexes ?? []), ...missingIndexes] } : {}),
  });
  console.log(`~ ${SETTINGS_COLLECTION} güncellendi (${summary})`);
  return true;
}

/** Eksik ayarları tohum değeriyle ekler; var olanın değerine dokunmaz. */
async function seedSettings(collectionExists) {
  for (const seed of SETTING_SEEDS) {
    const found = collectionExists
      ? await pb
          .collection(SETTINGS_COLLECTION)
          .getFirstListItem(pb.filter("key = {:key}", { key: seed.key }))
          .catch((err) => {
            if (err?.status === 404) return null;
            throw err;
          })
      : null;
    if (found) {
      console.log(`= ${seed.key} zaten var (değer: ${JSON.stringify(found.value)}), dokunulmadı.`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`+ ${seed.key} = ${JSON.stringify(seed.value)} EKLENECEK`);
      continue;
    }
    await pb.collection(SETTINGS_COLLECTION).create(seed);
    console.log(`+ ${seed.key} = ${JSON.stringify(seed.value)} eklendi.`);
  }
}

async function main() {
  const exists = await ensureCollection();
  await seedSettings(exists);
  console.log(DRY_RUN ? "\nKuru çalışma bitti — hiçbir şey yazılmadı." : "\nSistem ayarları göçü tamamlandı.");
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
