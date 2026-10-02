// Demo işletmenin menüsünü buyur'un TÜM menü özelliklerini gösterecek biçimde
// doldurur: 14 kategori, ~60 ürün, yedi rozetin tamamı, on alerjen türü, kalori,
// hazırlanma süresi, varyant/seçenek grupları, indirim + kampanya etiketi,
// tükenen ürün, kategori açıklaması ve pop-up'lar.
//
// Neden ayrı bir script: satış görüşmesinde ve onboarding'de gösterilen menü,
// ürünün yapabildiklerinin vitrinidir. Elle doldurulan bir demo zamanla eksik
// kalıyor; burada tek komutla yeniden kurulabilir hâle getiriyoruz.
//
// Dil: demo işletmenin ana dili İngilizce (businesses.main_language = "en"),
// bu yüzden baz metinler İngilizce, Türkçe karşılıkları `translations.tr`
// altında yazılır. AR/RU için kategori adları doldurulur; ürün çevirileri
// panelden ya da scripts/seed-translations.mjs ile eklenebilir (çeviri yoksa
// müşteri menüsü ana dile düşer, boş görünmez).
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/seed-demo-menu.mjs [slug]
//   ... node scripts/seed-demo-menu.mjs vezirhan --reuse-images
//   ... bun scripts/seed-demo-menu.mjs vezirhan --find-images
//
// Bayraklar:
//   --find-images   Ürün adına göre ücretsiz sağlayıcılardan (Unsplash/Pexels/
//                   Pixabay) görsel arar — panelin AI aktarımıyla AYNI kaynağı
//                   (lib/ai/images.ts) kullanır, mock veri ile gerçek aktarım
//                   arasında görsel kalitesi ayrışmasın diye.
//                   `bun` ile çalıştırılmalı (TypeScript modülü içe aktarılır)
//                   ve en az bir sağlayıcı anahtarı tanımlı olmalı.
//                   Görsel bulunamazsa ürün görselsiz oluşturulur, akış durmaz.
//   --reuse-images  Görseli olmayan yeni ürüne, aynı kategorideki mevcut bir
//                   ürünün görselini kopyalar. YALNIZCA demo için: gerçek bir
//                   işletmede ürünle görseli eşleşmeyeceği için kullanmayın.
//   --dry           Hiçbir kayıt yazmaz, ne yapacağını listeler.
//
// Idempotent: aynı isimde kategori/ürün varsa yeniden oluşturmaz, atlar.

import PocketBase from "pocketbase";
import { DEMO_CATEGORIES, DEMO_POPUPS, DEMO_BUSINESS_SHOWCASE } from "./demo-menu-data.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;

const args = process.argv.slice(2);
const SLUG = args.find((arg) => !arg.startsWith("--")) ?? "vezirhan";
const REUSE_IMAGES = args.includes("--reuse-images");
const FIND_IMAGES = args.includes("--find-images");
const DRY = args.includes("--dry");

// Görsel arama yalnızca istendiğinde yüklenir: statik içe aktarma, bayraksız
// `node` çalıştırmalarını TypeScript modülü yüzünden kırardı.
let searchProductImages = null;
if (FIND_IMAGES) {
  try {
    ({ searchProductImages } = await import("../lib/ai/images.ts"));
  } catch {
    console.error("--find-images için scripti `bun` ile çalıştırın: bun scripts/seed-demo-menu.mjs");
    process.exit(1);
  }
}

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

/** {tr,ar,ru} kısayollarını PocketBase'in `translations` yapısına çevirir. */
function translationsOf(entry) {
  const out = {};
  for (const locale of ["tr", "ar", "ru"]) {
    const value = entry[locale];
    if (!value) continue;
    const fields = {};
    if (value.name) fields.name = value.name;
    if (value.description) fields.description = value.description;
    if (value.campaign_label) fields.campaign_label = value.campaign_label;
    if (value.group_name) fields.group_name = value.group_name;
    if (value.title) fields.title = value.title;
    if (value.message) fields.message = value.message;
    if (Object.keys(fields).length > 0) out[locale] = fields;
  }
  return out;
}

async function findCategory(businessId, name) {
  try {
    return await pb
      .collection("buyur_categories")
      .getFirstListItem(pb.filter("business = {:b} && name = {:n}", { b: businessId, n: name }));
  } catch {
    return null;
  }
}

async function findProduct(businessId, name) {
  try {
    return await pb
      .collection("buyur_products")
      .getFirstListItem(pb.filter("business = {:b} && name = {:n}", { b: businessId, n: name }));
  } catch {
    return null;
  }
}

/** Kategorideki mevcut ürünlerin AI görsel bağlantıları — --reuse-images için. */
async function imagePool(categoryId) {
  const existing = await pb.collection("buyur_products").getFullList({
    filter: pb.filter("category = {:c} && image_url != ''", { c: categoryId }),
    fields: "image_url",
  });
  return existing.map((product) => product.image_url);
}

/** İşletmenin vitrin alanlarını tamamlar: BOŞ olanları doldurur, dolu olanlara
 *  dokunmaz. Özellik rozetleri (highlights) birleştirilir, silinmez. */
async function showcaseBusiness(business) {
  const patch = {};

  for (const [field, value] of Object.entries(DEMO_BUSINESS_SHOWCASE.fields)) {
    const current = business[field];
    if (current === undefined || current === null || current === "") patch[field] = value;
  }

  const highlights = new Set([...(business.highlights ?? []), ...DEMO_BUSINESS_SHOWCASE.highlights]);
  if (highlights.size !== (business.highlights ?? []).length) patch.highlights = [...highlights];

  if (Object.keys(patch).length === 0) {
    console.log("= işletme vitrin alanları zaten dolu.");
    return;
  }

  console.log(`~ işletme alanları tamamlanıyor: ${Object.keys(patch).join(", ")}`);
  if (!DRY) await pb.collection("buyur_businesses").update(business.id, patch);
}

async function seedProduct(business, category, spec, order, pool) {
  if (await findProduct(business.id, spec.name)) {
    console.log(`  = ${spec.name} zaten var, atlandı`);
    return 0;
  }

  const [prepMin, prepMax] = spec.prep ?? [0, 0];

  // Görsel kaynağı önceliği: gerçek arama → demo havuzu → görselsiz.
  // Arama hiçbir koşulda ürün oluşturmayı engellemez.
  // AI görseli panelde olduğu gibi bağlantı olarak yazılır (indirilmez).
  let imageUrl = "";
  if (searchProductImages && !DRY) {
    try {
      const found = await searchProductImages(spec.name, category.name, 1);
      if (found.length > 0) imageUrl = found[0].url;
    } catch {
      // Sağlayıcı hatası demo kurulumunu durdurmaz.
    }
  }
  if (!imageUrl && REUSE_IMAGES && pool.length > 0) {
    imageUrl = pool[order % pool.length];
  }

  const payload = {
    business: business.id,
    category: category.id,
    name: spec.name,
    description: spec.desc ?? "",
    price: spec.price,
    image_url: imageUrl,
    prep_time_min: prepMin,
    prep_time_max: prepMax,
    calories: spec.kcal ?? 0,
    allergens: spec.allergens ?? [],
    badges: spec.badges ?? [],
    // Tükenen ürün: menüde görünür ama "tükendi" rozetiyle — panelde tek tıkla
    // geri açılabildiğini göstermek için demoda bilinçli olarak birkaç tane var.
    is_available: spec.sold_out !== true,
    order,
    discount_percent: spec.sale?.percent ?? 0,
    campaign_label: spec.sale?.label ?? "",
    translations: translationsOf(spec),
  };

  if (DRY) {
    console.log(`  + (dry) ${spec.name}`);
    return 1;
  }

  const product = await pb.collection("buyur_products").create(payload);
  console.log(`  + ${spec.name}${spec.sale ? ` (−%${spec.sale.percent})` : ""}${spec.sold_out ? " [tükendi]" : ""}`);

  if (spec.options?.length) {
    let optionOrder = 0;
    for (const option of spec.options) {
      await pb.collection("buyur_product_options").create({
        product: product.id,
        group_name: option.group,
        name: option.name,
        price_delta: option.delta ?? 0,
        order: optionOrder++,
        translations: translationsOf(option),
      });
    }
    console.log(`    ↳ ${spec.options.length} seçenek`);
  }

  return 1;
}

async function seedPopups(business) {
  let added = 0;
  for (const popup of DEMO_POPUPS) {
    const existing = await pb.collection("buyur_popups").getList(1, 1, {
      filter: pb.filter("business = {:b} && title = {:t}", { b: business.id, t: popup.title }),
    });
    if (existing.totalItems > 0) {
      console.log(`= pop-up "${popup.title}" zaten var, atlandı`);
      continue;
    }
    if (!DRY) {
      await pb.collection("buyur_popups").create({
        business: business.id,
        title: popup.title,
        message: popup.message,
        is_active: popup.is_active !== false,
        starts_at: popup.starts_at ?? "",
        ends_at: popup.ends_at ?? "",
        translations: translationsOf(popup),
      });
    }
    console.log(`+ pop-up: ${popup.title}`);
    added++;
  }
  return added;
}

async function main() {
  const business = await pb
    .collection("buyur_businesses")
    .getFirstListItem(pb.filter("slug = {:slug}", { slug: SLUG }));
  console.log(`İşletme: ${business.name} (${business.slug}) — ana dil: ${business.main_language ?? "tr"}`);
  if (DRY) console.log("(dry çalıştırma — hiçbir kayıt yazılmayacak)\n");

  await showcaseBusiness(business);

  const existingCategories = await pb.collection("buyur_categories").getFullList({
    filter: pb.filter("business = {:id}", { id: business.id }),
  });
  let categoryOrder = existingCategories.length;
  let addedProducts = 0;

  for (const categorySpec of DEMO_CATEGORIES) {
    let category = await findCategory(business.id, categorySpec.name);

    if (!category) {
      const payload = {
        business: business.id,
        name: categorySpec.name,
        description: categorySpec.desc ?? "",
        order: categoryOrder++,
        is_active: true,
        translations: translationsOf(categorySpec),
      };
      category = DRY
        ? { id: `dry-${categorySpec.name}` }
        : await pb.collection("buyur_categories").create(payload);
      console.log(`\n+ Kategori: ${categorySpec.name}`);
    } else {
      console.log(`\n= Kategori: ${categorySpec.name} (mevcut)`);
      // Mevcut kategorinin açıklaması/çevirisi boşsa tamamla — demo menüde
      // kategori açıklamalarının nasıl göründüğü de anlatılmak isteniyor.
      const patch = {};
      if (!category.description && categorySpec.desc) patch.description = categorySpec.desc;
      if (Object.keys(category.translations ?? {}).length === 0) patch.translations = translationsOf(categorySpec);
      if (Object.keys(patch).length > 0 && !DRY) {
        await pb.collection("buyur_categories").update(category.id, patch);
        console.log(`  ~ kategori bilgileri tamamlandı: ${Object.keys(patch).join(", ")}`);
      }
    }

    const pool = REUSE_IMAGES && !DRY ? await imagePool(category.id) : [];
    const existingProducts = DRY
      ? []
      : await pb.collection("buyur_products").getFullList({ filter: pb.filter("category = {:c}", { c: category.id }) });
    let productOrder = existingProducts.length;

    for (const productSpec of categorySpec.products) {
      addedProducts += await seedProduct(business, category, productSpec, productOrder++, pool);
    }
  }

  console.log("");
  const popups = await seedPopups(business);

  console.log(`\nTamamlandı. ${addedProducts} ürün, ${popups} pop-up eklendi.`);
  if (!REUSE_IMAGES && !FIND_IMAGES) {
    console.log(
      "Not: yeni ürünler görselsiz eklendi. Ürün adına göre gerçek görsel için --find-images (bun ile), " +
        "hızlı demo için --reuse-images kullanın."
    );
  }
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
