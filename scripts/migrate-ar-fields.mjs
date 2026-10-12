// WebAR (Artırılmış Gerçeklik) şema göçü.
//
// Mevcut bir PocketBase kurulumuna AR desteği kazandırır:
//   1) buyur_products koleksiyonuna ar_model_glb, ar_model_usdz, ar_enabled ve ar_scale alanlarını ekler.
//   2) buyur_events koleksiyonundaki 'type' select alanına 'product_ar_view' değerini ekler.
//   3) buyur_plans tablosunda Elite planının limits JSON'ına ar_menu: true ekler.
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-ar-fields.mjs
//   ya da PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/migrate-ar-fields.mjs
//
// Idempotent: Her adım zaten uygulanmışsa güvenle atlar.

import PocketBase from "pocketbase";

const PB_URL = process.env.POCKETBASE_API_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const PB_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!PB_URL) {
  console.error("❌ POCKETBASE_API_URL veya NEXT_PUBLIC_POCKETBASE_URL ortam değişkeni gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

async function auth() {
  if (PB_TOKEN) {
    pb.authStore.save(PB_TOKEN, null);
    return;
  }
  if (PB_EMAIL && PB_PASSWORD) {
    try {
      await pb.admins.authWithPassword(PB_EMAIL, PB_PASSWORD);
      return;
    } catch {
      // PocketBase v0.23+ superuser koleksiyonu desteği
      try {
        await pb.collection("_superusers").authWithPassword(PB_EMAIL, PB_PASSWORD);
        return;
      } catch (err) {
        console.error("❌ Admin girişi başarısız:", err?.message || err);
        process.exit(1);
      }
    }
  }
  console.error("❌ POCKETBASE_ADMIN_TOKEN ya da PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD gerekli.");
  process.exit(1);
}

async function migrateProducts() {
  console.log("🔍 buyur_products kontrol ediliyor...");
  const collection = await pb.collections.getOne("buyur_products");
  const existingNames = new Set(collection.fields.map((f) => f.name));

  const newFields = [
    {
      name: "ar_model_glb",
      type: "file",
      required: false,
      maxSelect: 1,
      maxSize: 50 * 1024 * 1024,
      mimeTypes: ["model/gltf-binary", "application/octet-stream", "model/gltf+json"],
      protected: false,
    },
    {
      name: "ar_model_usdz",
      type: "file",
      required: false,
      maxSelect: 1,
      mimeTypes: [
        "model/vnd.usdz+zip",
        "model/vnd.usdz",
        "model/vnd.pixar.usd",
        "model/usd",
        "application/octet-stream",
        "application/zip",
        "application/x-zip",
        "application/x-zip-compressed",
      ],
      protected: false,
    },
    {
      name: "ar_enabled",
      type: "bool",
      required: false,
    },
    {
      name: "ar_scale",
      type: "text",
      required: false,
      min: 0,
      max: 30,
    },
  ];

  let updatedSize = false;
  for (const field of collection.fields) {
    if (field.name === "ar_model_glb" || field.name === "ar_model_usdz") {
      if (field.maxSize !== 50 * 1024 * 1024) {
        field.maxSize = 50 * 1024 * 1024;
        updatedSize = true;
      }
    }
  }

  const toAdd = newFields.filter((f) => !existingNames.has(f.name));
  if (toAdd.length === 0 && !updatedSize) {
    console.log("  ✓ buyur_products AR alanları zaten güncel (50MB).");
    return;
  }

  if (toAdd.length > 0) {
    collection.fields.push(...toAdd);
  }

  await pb.collections.update(collection.id, collection);
  if (toAdd.length > 0) {
    console.log(`  + buyur_products koleksiyonuna ${toAdd.map((f) => f.name).join(", ")} eklendi.`);
  }
  if (updatedSize) {
    console.log("  + buyur_products AR model alanlarının limiti 50MB'a yükseltildi.");
  }
}

async function migrateEvents() {
  console.log("🔍 buyur_events kontrol ediliyor...");
  const collection = await pb.collections.getOne("buyur_events");
  const typeField = collection.fields.find((f) => f.name === "type");

  if (!typeField) {
    console.log("  ⚠️ buyur_events içinde type alanı bulunamadı.");
    return;
  }

  const values = Array.isArray(typeField.values) ? [...typeField.values] : [];
  if (values.includes("product_ar_view")) {
    console.log("  ✓ product_ar_view event tipi zaten mevcut.");
    return;
  }

  values.push("product_ar_view");
  typeField.values = values;
  await pb.collections.update(collection.id, collection);
  console.log("  + buyur_events.type alanına 'product_ar_view' eklendi.");
}

async function migratePlans() {
  console.log("🔍 buyur_plans kontrol ediliyor...");
  try {
    const plans = await pb.collection("buyur_plans").getFullList();
    const elitePlan = plans.find((p) => p.key === "elite");
    if (!elitePlan) {
      console.log("  ℹ️ Elite planı bulunamadı, plan adımı atlandı.");
      return;
    }

    const currentLimits = elitePlan.limits && typeof elitePlan.limits === "object" ? { ...elitePlan.limits } : {};
    if (currentLimits.ar_menu === true) {
      console.log("  ✓ Elite planında ar_menu zaten aktif.");
      return;
    }

    currentLimits.ar_menu = true;
    await pb.collection("buyur_plans").update(elitePlan.id, { limits: currentLimits });
    console.log("  + Elite planı limits nesnesine 'ar_menu: true' yazıldı.");
  } catch (err) {
    console.log("  ℹ️ buyur_plans güncellenemedi veya henüz kurulu değil:", err?.message || err);
  }
}

async function run() {
  await auth();
  await migrateProducts();
  await migrateEvents();
  await migratePlans();
  console.log("\n✨ WebAR şema göçü başarıyla tamamlandı!");
}

run().catch((err) => {
  console.error("❌ Göç sırasında hata oluştu:", err);
  process.exit(1);
});
