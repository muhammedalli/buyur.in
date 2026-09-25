// buyur Pocketbase şema kurulumu.
// Kullanım: POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/setup-pocketbase.mjs
// Idempotent: koleksiyon zaten varsa dokunmadan atlar.
// --dry-run: hiçbir şey yazmaz; neyin oluşturulacağını/değişeceğini (kural
// farklarıyla) listeler. Canlıda çalıştırmadan önce buna bakın.
//
// Model: 1 işletme hesabı = 1 buyur_businesses kaydı = 1 kimlik (auth
// koleksiyonu). Ayrı bir kullanıcı tablosu yok. Birleşme öncesi bir kurulumu
// (buyur_users + buyur_businesses.owner) taşımak için:
// scripts/migrate-merge-business-auth.mjs

import PocketBase from "pocketbase";
import { ADMIN_BYPASS, BUSINESS_COLLECTION, BUSINESS_RULES } from "./business-schema.mjs";
import { ADMIN_ROLE_VALUES, ADMIN_RULES } from "./admin-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;

if (!PB_URL || !PB_TOKEN) {
  console.error(
    "POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli."
  );
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

const DRY_RUN = process.argv.includes("--dry-run");

const text = (name, opts = {}) => ({
  name,
  type: "text",
  required: opts.required ?? false,
  min: opts.min ?? 0,
  max: opts.max ?? 0,
  pattern: opts.pattern ?? "",
  presentable: opts.presentable ?? false,
});

const num = (name, opts = {}) => ({
  name,
  type: "number",
  required: opts.required ?? false,
  min: opts.min,
  max: opts.max,
  onlyInt: opts.onlyInt ?? false,
});

const boolField = (name) => ({ name, type: "bool" });

const json = (name) => ({ name, type: "json", maxSize: 2000000 });

const dateField = (name, opts = {}) => ({
  name,
  type: "date",
  required: opts.required ?? false,
});

const emailField = (name, opts = {}) => ({
  name,
  type: "email",
  required: opts.required ?? false,
  exceptDomains: null,
  onlyDomains: null,
});

const select = (name, values, opts = {}) => ({
  name,
  type: "select",
  required: opts.required ?? false,
  maxSelect: opts.maxSelect ?? 1,
  values,
});

const relation = (name, collectionId, opts = {}) => ({
  name,
  type: "relation",
  required: opts.required ?? false,
  collectionId,
  cascadeDelete: opts.cascadeDelete ?? false,
  minSelect: opts.minSelect ?? 0,
  maxSelect: opts.maxSelect ?? 1,
});

const autodate = (name, onCreate, onUpdate) => ({
  name,
  type: "autodate",
  onCreate,
  onUpdate,
});

const stamps = () => [autodate("created", true, false), autodate("updated", true, true)];

// Analitik sözlükleri — lib/analytics/events.ts ve lib/types.ts (StatDimension)
// ile birebir aynı kalmalı. Mevcut kurulumlarda select değerlerini genişletmek
// için scripts/migrate-analytics.mjs kullanılır (getOrCreate değer listesini güncellemez).
const EVENT_TYPES = [
  "page_view",
  "qr_scan",
  "session_start",
  "session_end",
  "category_view",
  "product_view",
  "product_detail_view",
  "add_to_cart",
  "remove_from_cart",
  "cart_view",
  "search",
  "campaign_view",
  "campaign_click",
  "language_change",
];

const STAT_DIMENSIONS = [
  "total",
  "hour",
  "weekday",
  "page",
  "product",
  "category",
  "source",
  "device",
  "country",
  "city",
  "qr",
  "campaign",
  "search",
  "funnel",
  "navigation",
];

// manageRule sadece auth tipi koleksiyonlarda anlamlı (users/admins) — diğerlerinde
// spec'te tanımlanmadığı için undefined ?? null === existing undefined ?? null olur,
// yani base koleksiyonlar için no-op kalır.
const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule", "manageRule"];

async function getOrCreate(spec) {
  let existing;
  try {
    existing = await pb.collections.getOne(spec.name);
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  if (!existing) {
    if (DRY_RUN) {
      console.log(`+ ${spec.name} OLUŞTURULACAK (${spec.fields.length} alan)`);
      // Sonraki koleksiyonların ilişki alanları bu kimliğe bakar; kuru çalışmada yer tutucu.
      return { id: `(yeni:${spec.name})`, fields: spec.fields };
    }
    const created = await pb.collections.create(spec);
    console.log(`+ ${spec.name} oluşturuldu (id: ${created.id})`);
    return created;
  }

  // Koleksiyon zaten varsa verilere dokunmuyoruz, ama spec'te olup canlıda
  // eksik olan alanları ekliyor ve API kurallarını spec ile eşitliyoruz.
  // Böylece script hem ilk kurulum hem de sonraki şema/kural güncellemeleri
  // için tekrar tekrar çalıştırılabilir kalıyor.
  const existingNames = new Set(existing.fields.map((f) => f.name));
  const missingFields = spec.fields.filter((f) => !existingNames.has(f.name));

  const ruleChanges = {};
  for (const key of RULE_KEYS) {
    const wanted = spec[key] ?? null;
    if (wanted !== (existing[key] ?? null)) ruleChanges[key] = wanted;
  }

  if (missingFields.length === 0 && Object.keys(ruleChanges).length === 0) {
    console.log(`= ${spec.name} zaten güncel, atlanıyor (id: ${existing.id})`);
    return existing;
  }

  if (DRY_RUN) {
    console.log(`~ ${spec.name} DEĞİŞECEK`);
    for (const field of missingFields) console.log(`    + alan: ${field.name} (${field.type})`);
    for (const [key, wanted] of Object.entries(ruleChanges)) {
      console.log(`    ${key}\n      şu an: ${existing[key] ?? "null (yalnızca superuser)"}\n      olacak: ${wanted ?? "null (yalnızca superuser)"}`);
    }
    return existing;
  }

  const updated = await pb.collections.update(existing.id, {
    ...ruleChanges,
    ...(missingFields.length > 0 ? { fields: [...existing.fields, ...missingFields] } : {}),
  });
  const parts = [];
  if (missingFields.length > 0) parts.push(`alanlar: ${missingFields.map((f) => f.name).join(", ")}`);
  if (Object.keys(ruleChanges).length > 0) parts.push(`kurallar: ${Object.keys(ruleChanges).join(", ")}`);
  console.log(`~ ${spec.name} güncellendi (${parts.join(" | ")})`);
  return updated;
}

async function main() {
  // Birleşme öncesi bir kurulumda bu betik yeni kuralları eski tablolara
  // yazarak canlıyı bozardı; önce göç çalıştırılmalı.
  const legacyUsers = await pb.collections.getOne("buyur_users").catch((err) => {
    if (err?.status === 404) return null;
    throw err;
  });
  if (legacyUsers) {
    console.error(
      "Bu kurulum birleşme öncesi modelde (buyur_users var). Önce scripts/migrate-merge-business-auth.mjs çalıştırın."
    );
    process.exit(2);
  }
  // Rol tabanlı kurallar servis hesabını "service" rolüyle tanır. Var olan bir
  // kurulumda rol listesi henüz genişlememişse servis hesabı hâlâ eski rolde
  // demektir; kuralları şimdi yazmak kayıt/sayaç/AI kotası yazımlarını durdurur.
  const existingAdmins = await pb.collections.getOne("buyur_admins").catch((err) => {
    if (err?.status === 404) return null;
    throw err;
  });
  const roleField = existingAdmins?.fields.find((f) => f.name === "role");
  if (roleField && !roleField.values.includes("service")) {
    console.error(
      "Servis hesabı henüz \"service\" rolüne taşınmamış. Önce scripts/migrate-admin.mjs çalıştırın (PB_SERVICE_EMAIL ile)."
    );
    process.exit(2);
  }
  const adminBypass = ADMIN_BYPASS;

  // 2) admins (auth) — buyur yönetim paneli hesapları (işletme sahiplerinden
  // ayrı bir auth koleksiyonu; role diğer koleksiyonların kurallarında
  // `@request.auth.collectionName = "buyur_admins"` ile ayırt edilir).
  const admins = await getOrCreate({
    name: "buyur_admins",
    type: "auth",
    // Kurallar ve roller scripts/admin-schema.mjs'te (göçle ortak).
    ...ADMIN_RULES,
    fields: [
      text("name", { required: true, max: 120 }),
      // Var olan kurulumda değer listesini scripts/migrate-admin.mjs genişletir.
      select("role", ADMIN_ROLE_VALUES, { required: true, maxSelect: 1 }),
      ...stamps(),
    ],
  });

  // 3) businesses — işletme hesapları (auth). Giriş e-postası/şifre PocketBase'in
  // auth alanlarında, işletmenin tüm bilgileri aynı kayıtta. Hesap kayıtta
  // (/api/auth/register) açılır; ad/slug kurulum ekranında doldurulana kadar
  // boştur ve kayıt yayında değildir (is_active = false). Kurallar ve sahibin
  // değiştiremeyeceği plan/sayaç alanları scripts/business-schema.mjs'te.
  const businesses = await getOrCreate({
    name: BUSINESS_COLLECTION,
    type: "auth",
    ...BUSINESS_RULES,
    fields: [
      text("name", { max: 120 }),
      text("slug", { max: 60, pattern: "^[a-z0-9-]+$" }),
      text("description", { max: 500 }),
      // Menüde görünen iletişim e-postası — giriş e-postasından farklıysa.
      // Aynıysa burada tutulmaz; emailVisibility ile giriş e-postası gösterilir.
      emailField("contact_email"),
      text("logo_url", { max: 500 }),
      text("cover_url", { max: 500 }),
      select("theme", [
        "paprika",
        "midnight",
        "emerald",
        "sunflower",
        "berry",
        "ocean",
        "forest",
        "plum",
        "copper",
        "slate",
      ], { maxSelect: 1 }),
      // Özel marka rengi (hex) — doluysa preset "theme" yerine kullanılır.
      text("theme_color", { max: 9 }),
      // Menü arka planı / yüzey tonu (lib/surfaces.ts anahtarı).
      text("menu_bg", { max: 20 }),
      // Menü yazı tipi (lib/fonts.ts anahtarı).
      text("font", { max: 20 }),
      select("template", ["liste", "grid"], { maxSelect: 1 }),
      text("phone", { max: 30 }),
      text("address", { max: 300 }),
      text("working_hours", { max: 500 }),
      select(
        "highlights",
        [
          "wifi",
          "vale",
          "otopark",
          "cocuk_oyun_alani",
          "evcil_hayvan_dostu",
          "teras",
          "canli_muzik",
          "rezervasyon",
          "kredi_karti",
          "engelli_erisimi",
          "sigara_alani",
          "kahvalti",
        ],
        { maxSelect: 3 }
      ),
      text("whatsapp", { max: 30 }),
      text("instagram", { max: 150 }),
      text("tiktok", { max: 150 }),
      text("youtube", { max: 200 }),
      text("facebook", { max: 150 }),
      text("google_maps_url", { max: 500 }),
      text("google_review_url", { max: 500 }),
      text("wifi_password", { max: 60 }),
      // Not: mevcut kurulumlarda bu alanın seçenek listesini scripts/migrate-plans.mjs
      // genişletip veriyi eşleyerek daraltıyor (getOrCreate var olan alanları güncellemez,
      // sadece eksik alan ekler) — burada yalnızca sıfırdan kurulum için nihai değerler.
      select("plan", ["freemium", "premium", "elite"], { maxSelect: 1 }),
      // Freemium kullanım takibi: başlangıç, bitiş ve menü görüntülenme sayacı.
      // Ücretli planlarda bu alanlar uygulanmaz (bkz. lib/entitlements.ts).
      dateField("freemium_started_at"),
      dateField("plan_expires_at"),
      num("menu_views", { min: 0, onlyInt: true }),
      // IANA saat dilimi — analitikteki gün/saat kırılımları buna göre hesaplanır.
      // Boşsa lib/analytics/time.ts'teki varsayılan (Europe/Istanbul) kullanılır.
      text("timezone", { max: 40 }),
      boolField("is_active"),
      // İşletmenin ana (baz) dili — ana metinler bu dilde tutulur.
      select("main_language", ["tr", "en", "ar", "ru"], { maxSelect: 1 }),
      // Ana dil dışındaki aktif ek diller.
      select("languages", ["tr", "en", "ar", "ru"], { maxSelect: 3 }),
      json("translations"),
      // Aktivasyon işaretleri (lib/activation.ts): sektör şablonu, ilk QR
      // indirme, kontrol listesinin tamamlanması. Aktivasyon metriği buradan okunur.
      json("activation"),
      // AI menü tarama kotası (lib/entitlements.ts → aiUsage). Sayaç dönemle
      // birlikte okunur; ay değişince okuma anında sıfır kabul edilir, bu
      // yüzden sıfırlama için ayrı bir cron gerekmez.
      num("ai_scans_used", { min: 0, onlyInt: true }),
      text("ai_scans_period", { max: 7 }),
      ...stamps(),
    ],
    // Kurulumu bitmemiş hesapların slug'ı boş: benzersizlik yalnızca dolu slug'lar için.
    indexes: ["CREATE UNIQUE INDEX `idx_business_account_slug` ON `buyur_businesses` (`slug`) WHERE `slug` != ''"],
  });

  // 4) categories — kategoriler
  const categories = await getOrCreate({
    name: "buyur_categories",
    type: "base",
    listRule: `business.is_active = true || business = @request.auth.id || ${adminBypass}`,
    viewRule: `business.is_active = true || business = @request.auth.id || ${adminBypass}`,
    createRule: "business = @request.auth.id",
    updateRule: `business = @request.auth.id || ${adminBypass}`,
    deleteRule: `business = @request.auth.id || ${adminBypass}`,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      text("name", { required: true, max: 120 }),
      text("description", { max: 300 }),
      text("image_url", { max: 500 }),
      num("order", { onlyInt: true }),
      boolField("is_active"),
      json("translations"),
      ...stamps(),
    ],
    indexes: ["CREATE INDEX `idx_categories_business` ON `buyur_categories` (`business`)"],
  });

  // 5) products — ürünler
  const products = await getOrCreate({
    name: "buyur_products",
    type: "base",
    listRule: `business.is_active = true || business = @request.auth.id || ${adminBypass}`,
    viewRule: `business.is_active = true || business = @request.auth.id || ${adminBypass}`,
    createRule: "business = @request.auth.id",
    updateRule: `business = @request.auth.id || ${adminBypass}`,
    deleteRule: `business = @request.auth.id || ${adminBypass}`,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      relation("category", categories.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      text("name", { required: true, max: 150 }),
      text("description", { max: 600 }),
      num("price", { required: true, min: 0 }),
      json("images"),
      // Otomatik bulunan görselin kaynağı/lisansı — telif denetimi için saklanır.
      json("image_source"),
      num("prep_time_min", { min: 0, onlyInt: true }),
      num("prep_time_max", { min: 0, onlyInt: true }),
      num("calories", { min: 0, onlyInt: true }),
      select(
        "allergens",
        [
          "gluten",
          "laktoz",
          "yumurta",
          "findik_fistik",
          "yer_fistigi",
          "soya",
          "balik",
          "kabuklu_deniz_urunu",
          "susam",
          "hardal",
          "kereviz",
          "sulfit",
        ],
        { maxSelect: 12 }
      ),
      select("badges", ["yeni", "sefin_onerisi", "populer", "vejetaryen", "vegan", "aci", "glutensiz"], {
        maxSelect: 7,
      }),
      boolField("is_available"),
      num("order", { onlyInt: true }),
      num("discount_percent", { min: 0, max: 100 }),
      text("campaign_label", { max: 60 }),
      json("translations"),
      ...stamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_products_business` ON `buyur_products` (`business`)",
      "CREATE INDEX `idx_products_category` ON `buyur_products` (`category`)",
    ],
  });

  // 6) product_options — varyant/seçenekler (Boy, Ekstra vb.)
  await getOrCreate({
    name: "buyur_product_options",
    type: "base",
    listRule: "product.business.is_active = true || product.business = @request.auth.id",
    viewRule: "product.business.is_active = true || product.business = @request.auth.id",
    createRule: "product.business = @request.auth.id",
    updateRule: "product.business = @request.auth.id",
    deleteRule: "product.business = @request.auth.id",
    fields: [
      relation("product", products.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      text("group_name", { required: true, max: 60 }),
      text("name", { required: true, max: 60 }),
      num("price_delta"),
      num("order", { onlyInt: true }),
      json("translations"),
      ...stamps(),
    ],
    indexes: ["CREATE INDEX `idx_product_options_product` ON `buyur_product_options` (`product`)"],
  });

  // 7) popups — menü açılışında duyuru/kampanya
  const popups = await getOrCreate({
    name: "buyur_popups",
    type: "base",
    listRule: "business.is_active = true || business = @request.auth.id",
    viewRule: "business.is_active = true || business = @request.auth.id",
    createRule: "business = @request.auth.id",
    updateRule: "business = @request.auth.id",
    deleteRule: "business = @request.auth.id",
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      text("title", { required: true, max: 120 }),
      text("message", { max: 400 }),
      text("image_url", { max: 500 }),
      boolField("is_active"),
      dateField("starts_at"),
      dateField("ends_at"),
      json("translations"),
      ...stamps(),
    ],
    indexes: ["CREATE INDEX `idx_popups_business` ON `buyur_popups` (`business`)"],
  });

  // 8) reviews — müşteri değerlendirme anketi (giriş gerektirmez, herkes gönderebilir).
  // update/delete kilitli: işletme sahibi dahil kimse API'den değiştiremez/silemez (salt görüntüleme).
  await getOrCreate({
    name: "buyur_reviews",
    type: "base",
    listRule: `business = @request.auth.id || ${adminBypass}`,
    viewRule: `business = @request.auth.id || ${adminBypass}`,
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      boolField("is_first_visit"),
      num("hygiene", { min: 0, max: 5, onlyInt: true }),
      num("satisfaction", { min: 0, max: 5, onlyInt: true }),
      num("revisit", { min: 0, max: 5, onlyInt: true }),
      text("comment", { max: 1000 }),
      ...stamps(),
    ],
    indexes: ["CREATE INDEX `idx_reviews_business` ON `buyur_reviews` (`business`)"],
  });

  // 8.5) qr_codes — etiketli QR'lar (masa/vitrin/Instagram…). Menü linkine
  // `?qr=<code>` olarak eklenir; ingestion bu kodu QR kaydına bağlar.
  const qrCodes = await getOrCreate({
    name: "buyur_qr_codes",
    type: "base",
    // Ziyaretçi tarafı QR kaydını okumaz (çözümlemeyi sunucu yapar); okuma
    // işletme sahibine ve admin'e açık.
    listRule: `business = @request.auth.id || ${adminBypass}`,
    viewRule: `business = @request.auth.id || ${adminBypass}`,
    createRule: `business = @request.auth.id || ${adminBypass}`,
    updateRule: `business = @request.auth.id || ${adminBypass}`,
    deleteRule: `business = @request.auth.id || ${adminBypass}`,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      text("name", { required: true, max: 60 }),
      text("code", { required: true, max: 40, pattern: "^[a-z0-9-]+$" }),
      select("placement", ["table", "counter", "window", "instagram", "campaign", "other"], { maxSelect: 1 }),
      boolField("is_active"),
      ...stamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_qr_business_code` ON `buyur_qr_codes` (`business`, `code`)"],
  });

  // 9) events — ham analitik event akışı. Artık ziyaretçi tarayıcısı değil,
  // /api/track (servis hesabı) yazar: oturum, kaynak, cihaz ve konum sunucuda
  // üretilir, böylece event'ler taklit edilemez (bkz. docs/analytics-architecture.md).
  // Okuma yalnızca işletme sahibine açık.
  //
  // NOT: select alanlarının değer listesi getOrCreate tarafından güncellenmez —
  // mevcut kurulumlarda EVENT_TYPES/QR/cihaz listeleri scripts/migrate-analytics.mjs
  // ile genişletilir. Buradaki liste lib/analytics/events.ts ile aynı kalmalı.
  await getOrCreate({
    name: "buyur_events",
    type: "base",
    listRule: `business = @request.auth.id || ${adminBypass}`,
    viewRule: `business = @request.auth.id || ${adminBypass}`,
    createRule: adminBypass,
    updateRule: null,
    deleteRule: adminBypass,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      select("type", EVENT_TYPES, { required: true, maxSelect: 1 }),
      text("target", { max: 120 }),
      text("label", { max: 200 }),
      text("session", { max: 40 }),
      text("visitor", { max: 40 }),
      relation("product", products.id, { maxSelect: 1 }),
      relation("category", categories.id, { maxSelect: 1 }),
      relation("popup", popups.id, { maxSelect: 1 }),
      relation("qr", qrCodes.id, { maxSelect: 1 }),
      text("source", { max: 40 }),
      text("medium", { max: 60 }),
      text("campaign", { max: 60 }),
      text("referrer_host", { max: 120 }),
      select("device", ["mobile", "tablet", "desktop"], { maxSelect: 1 }),
      text("country", { max: 2 }),
      text("city", { max: 80 }),
      text("locale", { max: 5 }),
      json("meta"),
      dateField("occurred_at"),
      ...stamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_events_business` ON `buyur_events` (`business`)",
      "CREATE INDEX `idx_events_business_time` ON `buyur_events` (`business`, `occurred_at`)",
      "CREATE INDEX `idx_events_business_type_time` ON `buyur_events` (`business`, `type`, `occurred_at`)",
      "CREATE INDEX `idx_events_business_session` ON `buyur_events` (`business`, `session`)",
      "CREATE INDEX `idx_events_business_product` ON `buyur_events` (`business`, `product`, `occurred_at`)",
    ],
  });

  // 9.1) sessions — oturum özeti. Unique ziyaretçi, süre, bounce ve yeni/dönen
  // oranı ham event taramadan buradan hesaplanır. Yalnızca servis hesabı yazar.
  await getOrCreate({
    name: "buyur_sessions",
    type: "base",
    listRule: `business = @request.auth.id || ${adminBypass}`,
    viewRule: `business = @request.auth.id || ${adminBypass}`,
    createRule: adminBypass,
    updateRule: adminBypass,
    deleteRule: adminBypass,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      text("key", { required: true, max: 40 }),
      text("visitor", { max: 40 }),
      dateField("started_at"),
      dateField("last_seen_at"),
      num("duration_sec", { min: 0, onlyInt: true }),
      num("events_count", { min: 0, onlyInt: true }),
      num("page_views", { min: 0, onlyInt: true }),
      num("product_views", { min: 0, onlyInt: true }),
      num("cart_adds", { min: 0, onlyInt: true }),
      text("source", { max: 40 }),
      text("medium", { max: 60 }),
      text("campaign", { max: 60 }),
      text("referrer_host", { max: 120 }),
      select("device", ["mobile", "tablet", "desktop"], { maxSelect: 1 }),
      text("country", { max: 2 }),
      text("city", { max: 80 }),
      text("locale", { max: 5 }),
      text("entry_path", { max: 200 }),
      text("exit_path", { max: 200 }),
      relation("qr", qrCodes.id, { maxSelect: 1 }),
      boolField("is_returning"),
      ...stamps(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_sessions_business_key` ON `buyur_sessions` (`business`, `key`)",
      "CREATE INDEX `idx_sessions_business_started` ON `buyur_sessions` (`business`, `started_at`)",
      "CREATE INDEX `idx_sessions_business_visitor` ON `buyur_sessions` (`business`, `visitor`)",
    ],
  });

  // 9.2) stats_daily — rollup çıktısı: gün × boyut × anahtar → metrikler.
  // Panel sorguları ham event yerine buradan beslenir.
  await getOrCreate({
    name: "buyur_stats_daily",
    type: "base",
    listRule: `business = @request.auth.id || ${adminBypass}`,
    viewRule: `business = @request.auth.id || ${adminBypass}`,
    createRule: adminBypass,
    updateRule: adminBypass,
    deleteRule: adminBypass,
    fields: [
      relation("business", businesses.id, { required: true, cascadeDelete: true, maxSelect: 1 }),
      // İşletmenin saat dilimine göre YYYY-MM-DD (metin: gün sınırı saat dilimiyle sabitlensin).
      text("date", { required: true, max: 10 }),
      select("dimension", STAT_DIMENSIONS, { required: true, maxSelect: 1 }),
      text("key", { max: 120 }),
      text("label", { max: 200 }),
      json("metrics"),
      ...stamps(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_stats_unique` ON `buyur_stats_daily` (`business`, `date`, `dimension`, `key`)",
      "CREATE INDEX `idx_stats_business_date` ON `buyur_stats_daily` (`business`, `date`)",
      "CREATE INDEX `idx_stats_business_dim_date` ON `buyur_stats_daily` (`business`, `dimension`, `date`)",
    ],
  });

  // 10) plans — abonelik paketleri (fiyat/özellik/limit). Landing sayfası ve
  // panel kayıt akışı bu koleksiyondan besleniyor; admin dışında kimse yazamaz.
  await getOrCreate({
    name: "buyur_plans",
    type: "base",
    listRule: `is_active = true || ${adminBypass}`,
    viewRule: `is_active = true || ${adminBypass}`,
    // Fiyat/limit yönetimi hassas — sadece super_admin yazabilir (panel tarafında
    // requireAdmin({ action: "plans.edit" }) zaten aynı kısıtı uyguluyor, bu DB
    // seviyesinde ikinci bir savunma katmanı).
    createRule: `${adminBypass} && @request.auth.role = "super_admin"`,
    updateRule: `${adminBypass} && @request.auth.role = "super_admin"`,
    deleteRule: `${adminBypass} && @request.auth.role = "super_admin"`,
    fields: [
      text("key", { required: true, max: 40, pattern: "^[a-z0-9_]+$" }),
      text("name", { required: true, max: 60 }),
      text("description", { max: 300 }),
      // Fiyatlandırma aylık kurgulanıyor: aylık ödemede aylık ücret ve yıllık
      // ödemedeki aylık eşdeğer (yıllık toplam = 12 katı). Eski price_6m/price_12m
      // alanları kaldırıldı.
      num("price_monthly", { min: 0 }),
      num("price_yearly_monthly", { min: 0 }),
      // Süreli (deneme) planın kaç ay sürdüğü; ücretli planlarda 0.
      num("trial_months", { min: 0, onlyInt: true }),
      json("features"),
      json("limits"),
      boolField("is_active"),
      boolField("is_default"),
      num("order", { onlyInt: true }),
      ...stamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_plans_key` ON `buyur_plans` (`key`)"],
  });

  // 11) otps — kayıt sırasında e-posta doğrulama kodları ve şifre sıfırlama
  // bağlantıları. Yalnızca servis hesabı okur/yazar; kod/belirteç düz metin
  // değil sha256 özeti olarak durur, böylece tablo sızsa bile bekleyen
  // kayıtlar ele geçirilemez. `purpose` iki akışı birbirinden ayırır (boş =
  // kayıt kodu; eski kayıtlar böyle kalır). Var olan kurulumda bu script
  // alanı kendisi ekler (getOrCreate eksik alanları tamamlar).
  await getOrCreate({
    name: "buyur_otps",
    type: "base",
    listRule: adminBypass,
    viewRule: adminBypass,
    createRule: adminBypass,
    updateRule: adminBypass,
    deleteRule: adminBypass,
    fields: [
      emailField("email", { required: true }),
      text("code_hash", { required: true, max: 64 }),
      dateField("expires_at", { required: true }),
      num("attempts", { min: 0, onlyInt: true }),
      // admin_login: yönetim paneli girişinin ikinci adımı (app/api/admin/auth).
      // Var olan kurulumda değer listesini scripts/migrate-admin.mjs genişletir.
      select("purpose", ["register", "password_reset", "admin_login"], { maxSelect: 1 }),
      ...stamps(),
    ],
    indexes: ["CREATE INDEX `idx_otps_email` ON `buyur_otps` (`email`)"],
  });

  // 12) admin_logs — yönetim paneli denetim kaydı (lib/admin-audit.ts).
  // Yalnızca eklenir: güncelleme ve silme kuralı yok (null = yalnızca
  // superuser), iz yöneticinin kendisi tarafından da silinemesin. Kaydı
  // yazan admin başkası adına kayıt atamaz (`@request.body.admin`). Admin
  // silinirse ilişki boşalır, kimin yaptığı admin_email'de kalır.
  await getOrCreate({
    name: "buyur_admin_logs",
    type: "base",
    listRule: adminBypass,
    viewRule: adminBypass,
    createRule: `${adminBypass} && @request.body.admin = @request.auth.id`,
    updateRule: null,
    deleteRule: null,
    fields: [
      text("op_id", { required: true, max: 36 }),
      relation("admin", admins.id, { maxSelect: 1 }),
      text("admin_email", { required: true, max: 200 }),
      text("action", { required: true, max: 60 }),
      text("target_collection", { max: 60 }),
      text("target_id", { max: 30 }),
      json("before"),
      json("after"),
      text("reason", { max: 500 }),
      text("ip", { max: 64 }),
      ...stamps(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_admin_logs_op` ON `buyur_admin_logs` (`op_id`)",
      "CREATE INDEX `idx_admin_logs_created` ON `buyur_admin_logs` (`created`)",
      "CREATE INDEX `idx_admin_logs_target` ON `buyur_admin_logs` (`target_collection`, `target_id`)",
      "CREATE INDEX `idx_admin_logs_admin` ON `buyur_admin_logs` (`admin`)",
    ],
  });

  console.log(DRY_RUN ? "\nKuru çalışma bitti — hiçbir şey yazılmadı." : "\nŞema kurulumu tamamlandı.");
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
