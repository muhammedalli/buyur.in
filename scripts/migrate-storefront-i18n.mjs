// Vitrin + menü dilleri göçü (sürüm 0.9.0):
//   1) buyur_businesses.main_language / languages seçeneklerine yeni diller
//      (de, fr, es, it) eklenir; ek dil sınırı 3'e ayarlanır (ana dil dahil
//      en fazla 4 dil — lib/i18n.ts → MAX_MENU_LOCALES).
//   2) highlights (mekân özellikleri) seçim sınırı kalkar: maxSelect = seçenek sayısı.
//   3) Kayan yazı, web sitesi yayını, panel dili ve kılavuz alanları eklenir
//      (scripts/storefront-schema.mjs → STOREFRONT_FIELDS).
//
// scripts/setup-pocketbase.mjs'in getOrCreate'i var olan alanın seçeneklerini
// güncellemez; bu yüzden ayrı bir göç. Seçenek SİLMEZ (şemada kalan eski bir
// seçenek zararsızdır: uygulama onu sunmaz, isSupportedLocale eler), alan ya da
// kayıt değerine dokunmaz.
//
// Eski kodla uyumludur (eski kod yeni alanları ve dilleri okumaz). Yeni kod ise
// alanlar yokken yazmaya çalışırsa PocketBase bilinmeyen alanı sessizce yok
// sayar — ayar kaydedilmiş gibi görünür ama kalıcı olmaz; yeni dil seçeneği
// yoksa kayıt 400 döner. Bu yüzden DEPLOY'DAN ÖNCE çalıştırılmalıdır.
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-storefront-i18n.mjs --dry-run
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-storefront-i18n.mjs
// Idempotent: her adım zaten uygulanmışsa atlanır.

import PocketBase from "pocketbase";
import { BUSINESS_COLLECTION } from "./business-schema.mjs";
import { HIGHLIGHT_VALUES, MENU_EXTRA_LANGUAGES_MAX, MENU_LOCALE_VALUES, STOREFRONT_FIELDS } from "./storefront-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

/** Select alanına eksik seçenekleri (sırayı koruyarak) ekler ve maxSelect'i
 *  verilen değere ayarlar. Var olan seçeneği kaldırmaz. */
function reshapeSelect(field, wanted, maxSelect) {
  const values = [...field.values];
  for (const value of wanted) if (!values.includes(value)) values.push(value);
  const changed = values.length !== field.values.length || maxSelect !== (field.maxSelect ?? 1);
  return { changed, next: { ...field, values, maxSelect } };
}

async function main() {
  const collection = await pb.collections.getOne(BUSINESS_COLLECTION);
  const changes = [];

  const plan = {
    main_language: [MENU_LOCALE_VALUES, 1],
    languages: [MENU_LOCALE_VALUES, MENU_EXTRA_LANGUAGES_MAX],
    highlights: [HIGHLIGHT_VALUES, HIGHLIGHT_VALUES.length],
  };

  const fields = collection.fields.map((field) => {
    const target = plan[field.name];
    if (!target || field.type !== "select") return field;
    const [wanted, maxSelect] = target;
    // Değer listesi göçten sonra genişleyebilir: highlights sınırı her zaman
    // o anki seçenek sayısıdır.
    const max = field.name === "highlights" ? Math.max(maxSelect, new Set([...field.values, ...wanted]).size) : maxSelect;
    const { changed, next } = reshapeSelect(field, wanted, max);
    if (changed) changes.push(`${field.name}: ${next.values.join(", ")} (en fazla ${next.maxSelect})`);
    return next;
  });

  const names = new Set(fields.map((field) => field.name));
  const missing = STOREFRONT_FIELDS.filter((field) => !names.has(field.name));
  if (missing.length > 0) changes.push(`alanlar: +${missing.map((field) => field.name).join(", ")}`);

  if (changes.length === 0) {
    console.log(`= ${BUSINESS_COLLECTION} zaten güncel.`);
    return;
  }

  if (DRY_RUN) {
    for (const change of changes) console.log(`~ ${BUSINESS_COLLECTION} DEĞİŞECEK — ${change}`);
    return;
  }

  await pb.collections.update(collection.id, { fields: [...fields, ...missing] });
  for (const change of changes) console.log(`~ ${BUSINESS_COLLECTION} güncellendi — ${change}`);
}

main().catch((err) => {
  console.error("Göç başarısız:", err?.response ?? err);
  process.exit(1);
});
