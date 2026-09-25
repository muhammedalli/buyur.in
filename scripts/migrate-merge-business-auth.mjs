// buyur_users (kimlik) + buyur_businesses (işletme) → TEK kimlik koleksiyonu
// buyur_businesses. "1 işletme hesabı = 1 işletme kaydı = 1 kimlik".
//
// Neden bu yön: PocketBase bir koleksiyonun tipini (base → auth) değiştirmeye
// izin vermez ve şifre özetlerini API'den dışarı vermez. Bu yüzden kimlik
// koleksiyonu (buyur_users) korunup işletme alanları ona taşınır ve koleksiyon
// buyur_businesses adını alır. Koleksiyon ve kayıt kimlikleri aynı kaldığı
// için ŞİFRELER ve AÇIK OTURUMLAR bozulmaz.
//
// Adımlar (her biri durumu kendisi tespit eder; yarıda kalırsa aynı komutu
// tekrar çalıştırmak güvenlidir):
//   0) Denetim: her işletmenin sahibi var mı, bir hesaba birden çok işletme
//      bağlı mı → sorun varsa HİÇBİR ŞEYE dokunmadan durur.
//   1) Yedek: PocketBase yedeği + yerel JSON anlık görüntüsü (kişi adları
//      dahil — yeni modelde ayrı kişi adı tutulmuyor).
//   2) Kimlik koleksiyonuna işletme alanları eklenir (+ contact_email).
//   3) Her işletmenin verisi sahibinin kaydına kopyalanır.
//   4) 8 bağlı koleksiyonun `business` ilişkisi yeni kayda taşınır
//      (PocketBase ilişkinin hedefini doğrudan değiştirmeye izin vermez:
//      yeni alan → değer kopyala → eskisini sil + yenisini adlandır).
//   5) Eski işletme tablosu `buyur_businesses_legacy` olur (yalnızca süper
//      kullanıcı erişir), kimlik koleksiyonu `buyur_businesses` adını alır.
//   6) Doğrulama: sayılar, slug'lar ve ilişkiler.
//
// GERİ DÖNÜŞ (--rollback): --drop-legacy çalıştırılmadığı sürece her şey eski
// modele API üzerinden geri çevrilir. Göçten sonra yapılan düzenlemeler ve
// yeni kayıtlar korunur. PocketBase yedeğini geri yüklemek tek başına güvenli
// DEĞİL: sunucu --automigrate ile çalışıyorsa (hazır ikilide varsayılan) göçün
// ürettiği pb_migrations dosyaları yeniden başlatmada tekrar uygulanır.
//
// ÖNEMLİ: Eski uygulama kodu bu göçten sonra çalışmaz (buyur_users ve `owner`
// kalmaz). Yeni sürümü hazır bekletip göçün hemen ardından yayına alın.
//
// Kullanım (POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN gerekli):
//   node scripts/migrate-merge-business-auth.mjs --dry-run      # yalnızca plan
//   node scripts/migrate-merge-business-auth.mjs                # göç
//   node scripts/migrate-merge-business-auth.mjs --rollback     # eski modele dön
//   node scripts/migrate-merge-business-auth.mjs --drop-legacy  # yayın doğrulandıktan sonra arşivi sil

import fs from "node:fs";
import path from "node:path";
import PocketBase from "pocketbase";
import { ADMIN_BYPASS, BUSINESS_COLLECTION, BUSINESS_RULES, rewriteOwnerRule } from "./business-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DROP_LEGACY = args.includes("--drop-legacy");
const ROLLBACK = args.includes("--rollback");
const SKIP_BACKUP = args.includes("--skip-backup");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);
pb.autoCancellation(false);

const USERS = "buyur_users";
const LEGACY = "buyur_businesses_legacy";
const DEPENDENTS = [
  "buyur_categories",
  "buyur_products",
  "buyur_popups",
  "buyur_reviews",
  "buyur_qr_codes",
  "buyur_events",
  "buyur_sessions",
  "buyur_stats_daily",
];
/** Kuralları işletmeye dolaylı (ürün üzerinden) bakan koleksiyonlar. */
const INDIRECT = ["buyur_product_options"];
const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
/** Eski işletme kaydından kimlik kaydına aynen taşınmayan alanlar. `name`
 *  ayrıca yazılır (kişi adının yerine işletme adı), `email` iletişim
 *  e-postası olarak ayrı ele alınır. */
const NOT_COPIED = new Set(["id", "owner", "name", "email", "created", "updated"]);
const REF = "business_ref";
const MAP_FIELD = "legacy_business_id";
const NO_BUSINESS = "-";
const CONCURRENCY = 6;

/** Göç öncesi kurallar (geri dönüş için). scripts/setup-pocketbase.mjs'in
 *  birleşme öncesi hâliyle aynıdır. */
const PRE_MERGE_USER_RULES = {
  listRule: `id = @request.auth.id || ${ADMIN_BYPASS}`,
  viewRule: `id = @request.auth.id || ${ADMIN_BYPASS}`,
  createRule: ADMIN_BYPASS,
  updateRule: `id = @request.auth.id || ${ADMIN_BYPASS}`,
  deleteRule: `id = @request.auth.id || ${ADMIN_BYPASS}`,
  manageRule: ADMIN_BYPASS,
};
const PRE_MERGE_BUSINESS_RULES = {
  listRule: `is_active = true || owner = @request.auth.id || ${ADMIN_BYPASS}`,
  viewRule: `is_active = true || owner = @request.auth.id || ${ADMIN_BYPASS}`,
  createRule: "@request.auth.id != '' && owner = @request.auth.id",
  updateRule: `owner = @request.auth.id || ${ADMIN_BYPASS}`,
  deleteRule: `owner = @request.auth.id || ${ADMIN_BYPASS}`,
};
const PRE_MERGE_SLUG_INDEX = "CREATE UNIQUE INDEX `idx_businesses_slug` ON `buyur_businesses` (`slug`)";

/** Yeni modeldeki "kendi işletmesi" ifadesini eski modele çevirir. */
function restoreOwnerRule(rule) {
  if (typeof rule !== "string") return rule;
  return rule.replace(/\bbusiness = @request\.auth\.id/g, "business.owner = @request.auth.id");
}

const log = (...parts) => console.log(...parts);
const errorText = (err) => JSON.stringify(err?.response ?? err?.message ?? err);

async function withRetry(task, label, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (err) {
      const status = err?.status ?? 0;
      const transient = status === 0 || status === 429 || status >= 500;
      if (!transient || attempt >= attempts) throw new Error(`${label}: ${errorText(err)}`);
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
}

async function pool(items, worker) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (index < items.length) await worker(items[index++]);
    })
  );
}

async function collections() {
  const list = await pb.collections.getFullList({ requestKey: null });
  return new Map(list.map((collection) => [collection.name, collection]));
}

async function total(name) {
  return (await pb.collection(name).getList(1, 1, { fields: "id", requestKey: null })).totalItems;
}

async function backup(label, data) {
  if (SKIP_BACKUP) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `buyur-${label}-${stamp.slice(0, 19)}.zip`.toLowerCase();
  await pb.backups.create(backupName);
  log(`+ PocketBase yedeği: ${backupName}`);
  const dir = path.resolve("merge-snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), ...data }, null, 2));
  log(`+ Yerel anlık görüntü (kişisel veri içerir, güvenli saklayın): ${file}`);
}

/** Bağlı koleksiyonun `business` ilişkisini başka bir koleksiyona taşır.
 *  `idMap`: eski kimlik → yeni kimlik. `rewrite`: kural dönüştürücü. */
async function repoint(name, targetCollectionId, idMap, rewrite) {
  let col = await pb.collections.getOne(name);
  const current = col.fields.find((field) => field.name === "business");
  const hasRef = col.fields.some((field) => field.name === REF);
  if (current?.collectionId === targetCollectionId && !hasRef) {
    log(`= ${name}: zaten taşınmış`);
    return;
  }

  if (!hasRef) {
    await pb.collections.update(col.id, {
      fields: [
        ...col.fields,
        {
          name: REF,
          type: "relation",
          collectionId: targetCollectionId,
          maxSelect: 1,
          minSelect: 0,
          cascadeDelete: current.cascadeDelete,
          required: false,
        },
      ],
    });
    col = await pb.collections.getOne(name);
  }

  let moved = 0;
  for (;;) {
    const page = await pb.collection(name).getList(1, 500, { filter: `${REF} = ""`, fields: "id,business", requestKey: null });
    if (page.items.length === 0) break;
    const missing = page.items.filter((item) => !idMap.has(item.business));
    if (missing.length > 0) {
      throw new Error(`${name}: eşlemesi olmayan kayıt var (${missing.slice(0, 3).map((item) => `${item.id}→${item.business}`).join(", ")})`);
    }
    await pool(page.items, (item) =>
      withRetry(() => pb.collection(name).update(item.id, { [REF]: idMap.get(item.business) }), `${name}/${item.id}`)
    );
    moved += page.items.length;
  }

  // Eski alan silinir, yenisi "business" olur. İndeks cümleleri sütun adı
  // aynı kaldığı için değişmeden geçerlidir.
  const fields = col.fields
    .filter((field) => field.name !== "business")
    .map((field) =>
      field.name === REF ? { ...field, name: "business", required: current.required, cascadeDelete: current.cascadeDelete } : field
    );
  const rules = Object.fromEntries(RULE_KEYS.map((key) => [key, rewrite(col[key])]));
  await pb.collections.update(col.id, { fields, indexes: col.indexes, ...rules });
  log(`+ ${name}: ${moved} kayıt taşındı`);
}

async function rewriteIndirectRules(rewrite) {
  for (const name of INDIRECT) {
    const col = await pb.collections.getOne(name);
    const patch = {};
    for (const key of RULE_KEYS) {
      const next = rewrite(col[key]);
      if (next !== col[key]) patch[key] = next;
    }
    if (Object.keys(patch).length > 0) {
      await pb.collections.update(col.id, patch);
      log(`~ ${name}: kurallar güncellendi`);
    }
  }
}

// ─── Göç ───────────────────────────────────────────────────────────────

async function migrate() {
  let cols = await collections();
  if (cols.get(BUSINESS_COLLECTION)?.type === "auth" && !cols.has(USERS)) {
    log("= Göç zaten tamamlanmış. Geri dönmek için --rollback, arşivi silmek için --drop-legacy.");
    return;
  }

  const users = cols.get(USERS);
  const legacyCol = cols.get(BUSINESS_COLLECTION)?.type === "base" ? cols.get(BUSINESS_COLLECTION) : cols.get(LEGACY);
  if (!users || users.type !== "auth" || !legacyCol) {
    console.error("Beklenen yapı bulunamadı (buyur_users auth + buyur_businesses base).");
    process.exit(2);
  }

  // 0) Denetim
  const [accounts, businesses] = await Promise.all([
    pb.collection(USERS).getFullList({ batch: 500, requestKey: null }),
    pb.collection(legacyCol.name).getFullList({ batch: 500, requestKey: null }),
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const byOwner = new Map();
  for (const business of businesses) byOwner.set(business.owner, [...(byOwner.get(business.owner) ?? []), business]);
  const duplicates = [...byOwner.entries()].filter(([, list]) => list.length > 1);
  const orphans = businesses.filter((business) => !accountById.has(business.owner));
  if (duplicates.length > 0 || orphans.length > 0) {
    for (const [owner, list] of duplicates) console.error(`✗ Hesap ${owner} birden çok işletmeye sahip: ${list.map((b) => b.slug).join(", ")}`);
    for (const business of orphans) console.error(`✗ Sahibi olmayan işletme: ${business.slug} (${business.id})`);
    console.error("Göç yapılmadı. Bu kayıtlar yönetimden düzeltilmeli.");
    process.exit(2);
  }
  const legacyToAccount = new Map(businesses.map((business) => [business.id, business.owner]));
  const withoutBusiness = accounts.filter((account) => !byOwner.has(account.id));
  const counts = {};
  for (const name of DEPENDENTS) counts[name] = await total(name);
  log(`Hesap: ${accounts.length}, işletme: ${businesses.length}, kurulumu yarım hesap: ${withoutBusiness.length}`);
  log("Bağlı kayıtlar:", JSON.stringify(counts));

  if (DRY_RUN) {
    log("\n(kuru çalıştırma) Yapılacaklar:");
    log("  1) PocketBase yedeği + yerel JSON anlık görüntüsü");
    log(`  2) ${USERS}'a işletme alanları eklenecek`);
    log(`  3) ${businesses.length} işletme sahibinin kaydına kopyalanacak (kurulumsuz ${withoutBusiness.length} hesap boş işletme olacak)`);
    log(`  4) ${DEPENDENTS.length} koleksiyonda ${Object.values(counts).reduce((a, b) => a + b, 0)} kaydın işletme bağı taşınacak`);
    log(`  5) ${legacyCol.name} → ${LEGACY}, ${USERS} → ${BUSINESS_COLLECTION}`);
    return;
  }

  // 1) Yedek
  await backup("pre-merge", {
    accounts: accounts.map(({ id, email, name, created }) => ({ id, email, name, created })),
    businesses,
    counts,
  });

  // 2) Kimlik koleksiyonuna işletme alanları
  {
    const fresh = await pb.collections.getOne(users.id);
    const existing = new Set(fresh.fields.map((field) => field.name));
    const added = legacyCol.fields
      .filter((field) => !NOT_COPIED.has(field.name) && !existing.has(field.name))
      // Kurulumu yarım hesaplarda bu alanlar boştur; zorunluluk uygulamada.
      .map(({ id, ...field }) => ({ ...field, required: false }));
    if (!existing.has("contact_email")) {
      added.push({ name: "contact_email", type: "email", required: false, exceptDomains: null, onlyDomains: null });
    }
    if (!existing.has(MAP_FIELD)) added.push({ name: MAP_FIELD, type: "text", required: false, hidden: true, max: 30 });

    const slugIndex = `CREATE UNIQUE INDEX \`idx_business_account_slug\` ON \`${USERS}\` (\`slug\`) WHERE \`slug\` != ''`;
    const hasSlugIndex = fresh.indexes.some((index) => index.includes("idx_business_account_slug"));
    if (added.length > 0 || !hasSlugIndex) {
      await pb.collections.update(users.id, {
        fields: [...fresh.fields.map((field) => (field.name === "name" ? { ...field, required: false } : field)), ...added],
        indexes: hasSlugIndex ? fresh.indexes : [...fresh.indexes, slugIndex],
      });
      log(`+ ${USERS}: ${added.length} alan eklendi (${added.map((field) => field.name).join(", ")})`);
    }
  }

  // 3) İşletme verisini sahibin kaydına kopyala. Atlama yok: yeniden
  //    adlandırmadan önce eski tablo tek doğru kaynaktır; tekrar çalıştırmada
  //    (ya da geri dönüşten sonra yeniden göçte) güncel hâli yeniden yazılır.
  {
    const copyFields = legacyCol.fields.map((field) => field.name).filter((name) => !NOT_COPIED.has(name));
    let copied = 0;
    for (const business of businesses) {
      const account = accountById.get(business.owner);
      const patch = Object.fromEntries(copyFields.map((name) => [name, business[name]]));
      // İletişim e-postası giriş e-postasıyla aynıysa ikinci kez yazılmaz:
      // tek kaynak giriş e-postasıdır, menüde gösterilmesi emailVisibility ile seçilir.
      const contact = (business.email ?? "").trim();
      const sameAsLogin = contact !== "" && contact.toLowerCase() === String(account.email).toLowerCase();
      Object.assign(patch, {
        name: business.name,
        contact_email: sameAsLogin ? "" : contact,
        emailVisibility: sameAsLogin,
        [MAP_FIELD]: business.id,
      });
      await withRetry(() => pb.collection(USERS).update(business.owner, patch), `kopyalama ${business.slug}`);
      copied += 1;
    }
    for (const account of withoutBusiness) {
      await withRetry(
        () => pb.collection(USERS).update(account.id, { name: "", slug: "", is_active: false, [MAP_FIELD]: NO_BUSINESS }),
        `kurulumsuz hesap ${account.id}`
      );
      copied += 1;
    }
    log(`+ ${copied} hesap güncellendi`);
  }

  // 4) Bağlı koleksiyonlar (önce dolaylı kurallar: yeni ifade her iki durumda da geçerli)
  await rewriteIndirectRules(rewriteOwnerRule);
  for (const name of DEPENDENTS) await repoint(name, users.id, legacyToAccount, rewriteOwnerRule);

  // 5) Eski tabloyu kenara al, kimlik koleksiyonunu buyur_businesses yap
  cols = await collections();
  const legacyNow = cols.get(BUSINESS_COLLECTION)?.type === "base" ? cols.get(BUSINESS_COLLECTION) : null;
  if (legacyNow) {
    // İndeks cümleleri eski tablo adını taşıyor; ad yeni koleksiyona geçince
    // yanlış tabloya uygulanmasınlar diye arşivde kaldırılır.
    await pb.collections.update(legacyNow.id, {
      name: LEGACY,
      indexes: [],
      ...Object.fromEntries(RULE_KEYS.map((key) => [key, null])),
    });
    log(`~ ${BUSINESS_COLLECTION} (eski) → ${LEGACY} (yalnızca süper kullanıcı)`);
  }
  if (cols.has(USERS)) {
    const fresh = await pb.collections.getOne(users.id);
    const indexes = fresh.indexes.map((index) => index.replaceAll(`\`${USERS}\``, `\`${BUSINESS_COLLECTION}\``));
    await pb.collections.update(users.id, { name: BUSINESS_COLLECTION, indexes, ...BUSINESS_RULES });
    log(`~ ${USERS} → ${BUSINESS_COLLECTION} (kimlik + işletme, yeni kurallar)`);
  }

  // 6) Doğrulama
  const merged = await pb.collection(BUSINESS_COLLECTION).getFullList({ batch: 500, fields: "id,slug", requestKey: null });
  const problems = [];
  if (merged.length < accounts.length) problems.push(`hesap sayısı ${accounts.length} → ${merged.length}`);
  const mergedById = new Map(merged.map((record) => [record.id, record]));
  for (const business of businesses) {
    if (mergedById.get(business.owner)?.slug !== business.slug) problems.push(`slug eşleşmedi: ${business.slug}`);
  }
  for (const name of DEPENDENTS) {
    const now = await total(name);
    if (now < counts[name]) problems.push(`${name}: ${counts[name]} → ${now}`);
    const col = await pb.collections.getOne(name);
    if (col.fields.find((field) => field.name === "business")?.collectionId !== users.id) problems.push(`${name}: ilişki taşınmadı`);
  }
  if (problems.length > 0) {
    console.error("\n✗ Doğrulama sorunları:\n  " + problems.join("\n  "));
    process.exit(3);
  }
  log("\n✓ Göç tamamlandı ve doğrulandı. Yeni sürümü şimdi yayına alın.");
  log("  Sorun olursa: --rollback. Yayın doğrulandıktan sonra: --drop-legacy.");
}

// ─── Geri dönüş ────────────────────────────────────────────────────────

async function rollback() {
  let cols = await collections();
  if (cols.has(USERS) && cols.get(BUSINESS_COLLECTION)?.type === "base" && !cols.has(LEGACY)) {
    log("= Zaten eski modelde. Yarım kalmış eşleme temizliği tamamlanıyor.");
    if (!DRY_RUN) await clearMappings();
    return;
  }
  const accountsCol = cols.get(BUSINESS_COLLECTION)?.type === "auth" ? cols.get(BUSINESS_COLLECTION) : cols.get(USERS);
  const legacyCol = cols.get(LEGACY) ?? (cols.get(BUSINESS_COLLECTION)?.type === "base" ? cols.get(BUSINESS_COLLECTION) : null);
  if (!accountsCol || accountsCol.type !== "auth" || !legacyCol) {
    console.error("Geri dönülecek yapı bulunamadı (arşiv tablosu silinmiş olabilir: --drop-legacy sonrası geri dönüş yok).");
    process.exit(2);
  }
  const accountFields = new Set(accountsCol.fields.map((field) => field.name));
  if (!accountFields.has(MAP_FIELD)) {
    console.error(`${MAP_FIELD} alanı yok; bu kurulum göçle oluşturulmamış, geri dönüş yapılamaz.`);
    process.exit(2);
  }

  const [accounts, legacyRows] = await Promise.all([
    pb.collection(accountsCol.name).getFullList({ batch: 500, requestKey: null }),
    pb.collection(legacyCol.name).getFullList({ batch: 500, requestKey: null }),
  ]);
  const legacyById = new Map(legacyRows.map((row) => [row.id, row]));
  const setUp = accounts.filter((account) => account.slug);
  const created = setUp.filter((account) => !legacyById.has(account[MAP_FIELD]));
  log(`Hesap: ${accounts.length}, kurulu işletme: ${setUp.length}, göçten sonra açılan: ${created.length}`);

  if (DRY_RUN) {
    log("(kuru çalıştırma) Güncel işletme bilgileri arşiv tablosuna yazılacak, ilişkiler ona geri taşınacak,");
    log(`koleksiyon adları eski hâline dönecek (${BUSINESS_COLLECTION} → ${USERS}, ${LEGACY} → ${BUSINESS_COLLECTION}).`);
    return;
  }
  await backup("pre-rollback", { accounts, legacyRows });

  // R1) Güncel işletme bilgisini arşiv satırlarına geri yaz; göçten sonra
  //     açılan işletmelere arşivde satır aç.
  const legacyFieldNames = legacyCol.fields.map((field) => field.name).filter((name) => !["id", "created", "updated"].includes(name));
  const accountToLegacy = new Map();
  for (const account of setUp) {
    const patch = Object.fromEntries(
      legacyFieldNames.filter((name) => name in account && !NOT_COPIED.has(name)).map((name) => [name, account[name]])
    );
    Object.assign(patch, {
      owner: account.id,
      name: account.name,
      email: account.contact_email || (account.emailVisibility ? account.email : ""),
    });
    const legacyId = account[MAP_FIELD];
    if (legacyById.has(legacyId)) {
      await withRetry(() => pb.collection(legacyCol.name).update(legacyId, patch), `arşiv ${account.slug}`);
      accountToLegacy.set(account.id, legacyId);
    } else {
      const row = await withRetry(() => pb.collection(legacyCol.name).create(patch), `arşive ekle ${account.slug}`);
      await withRetry(() => pb.collection(accountsCol.name).update(account.id, { [MAP_FIELD]: row.id }), `eşleme ${account.slug}`);
      accountToLegacy.set(account.id, row.id);
    }
  }
  log(`+ ${setUp.length} işletme arşiv tablosuna yazıldı`);

  // R2) Bağlı koleksiyonları arşiv tablosuna geri taşı. Kurulumu yarım
  //     hesabın bağlı kaydı olamaz; olursa eşleme hatasıyla durur.
  const counts = {};
  for (const name of DEPENDENTS) counts[name] = await total(name);
  for (const name of DEPENDENTS) await repoint(name, legacyCol.id, accountToLegacy, restoreOwnerRule);
  await rewriteIndirectRules(restoreOwnerRule);

  // R3) Adları ve kuralları eski hâline döndür
  cols = await collections();
  if (cols.get(BUSINESS_COLLECTION)?.type === "auth") {
    const fresh = await pb.collections.getOne(accountsCol.id);
    const indexes = fresh.indexes
      .filter((index) => !index.includes("idx_business_account_slug"))
      .map((index) => index.replaceAll(`\`${BUSINESS_COLLECTION}\``, `\`${USERS}\``));
    await pb.collections.update(accountsCol.id, { name: USERS, indexes, ...PRE_MERGE_USER_RULES });
    log(`~ ${BUSINESS_COLLECTION} → ${USERS}`);
  }
  if (cols.has(LEGACY)) {
    await pb.collections.update(legacyCol.id, { name: BUSINESS_COLLECTION, indexes: [PRE_MERGE_SLUG_INDEX], ...PRE_MERGE_BUSINESS_RULES });
    log(`~ ${LEGACY} → ${BUSINESS_COLLECTION}`);
  }

  await clearMappings();

  for (const name of DEPENDENTS) {
    if ((await total(name)) < counts[name]) {
      console.error(`✗ ${name}: kayıt sayısı azaldı`);
      process.exit(3);
    }
  }
  log("\n✓ Geri dönüş tamamlandı: eski model (buyur_users + buyur_businesses.owner) yeniden etkin.");
  log("  Eski uygulama sürümünü yayına alın. Göçü sonra yeniden çalıştırmak güvenlidir.");
}

/** R4) Eşleme işaretleri temizlenir. Eski kodda `name` kişi adıdır; boş
 *  kalanlara e-posta öneki yazılır (kişi adları pre-merge anlık
 *  görüntüsünde durur). */
async function clearMappings() {
  const accounts = await pb.collection(USERS).getFullList({ batch: 500, fields: `id,email,name,${MAP_FIELD}`, requestKey: null });
  await pool(
    accounts.filter((account) => account[MAP_FIELD] || !account.name),
    (account) =>
      withRetry(
        () =>
          pb.collection(USERS).update(account.id, {
            [MAP_FIELD]: "",
            ...(account.name ? {} : { name: String(account.email).split("@")[0] }),
          }),
        `hesap ${account.id}`
      )
  );
}

// ─── Arşivi silme ──────────────────────────────────────────────────────

async function dropLegacy() {
  const cols = await collections();
  const account = cols.get(BUSINESS_COLLECTION);
  if (!account || account.type !== "auth" || cols.has(USERS)) {
    console.error("Göç tamamlanmamış görünüyor; önce göçü çalıştırın.");
    process.exit(2);
  }
  if (DRY_RUN) {
    log(`~ (kuru) ${LEGACY} silinecek ve ${MAP_FIELD} alanı kaldırılacaktı. Bundan sonra --rollback mümkün olmaz.`);
    return;
  }
  if (cols.has(LEGACY)) {
    await pb.collections.delete(LEGACY);
    log(`- ${LEGACY} silindi.`);
  }
  const fresh = await pb.collections.getOne(account.id);
  if (fresh.fields.some((field) => field.name === MAP_FIELD)) {
    await pb.collections.update(account.id, { fields: fresh.fields.filter((field) => field.name !== MAP_FIELD) });
    log(`- ${MAP_FIELD} alanı kaldırıldı.`);
  }
  log("Arşiv temizliği tamamlandı.");
}

const task = DROP_LEGACY ? dropLegacy : ROLLBACK ? rollback : migrate;
task().catch((err) => {
  console.error("Hata:", err?.message ?? err);
  console.error("İşlem yarıda kaldıysa sorunu giderip aynı komutu tekrar çalıştırın; tamamlanan adımlar atlanır.");
  process.exit(1);
});
