// buyur merkezi denetim kaydının PocketBase tarafı (yardımcı modül).
// Kayıtlar: buyur_admin_logs. Next.js tarafındaki eşi lib/admin-audit.ts,
// eylem adları ve etiketleri lib/audit-log.ts (sözleşme:
// tests/audit-hook.test.ts).
//
// Neden PocketBase'de: işletme paneli tarayıcıdan doğrudan PocketBase'e yazar;
// Next.js sunucusu bu yazmaları hiç görmez. Kaydı burada, isteği işleyen
// sunucuda yazmak "kim ne yaptı" sorusunu istemcinin beyanına bırakmaz ve
// atlanamaz.
//
// Kim loglanır:
//   - İşletme hesabı (buyur_businesses) ve superuser (PocketBase paneli,
//     scriptler): her yazma, önce/sonra değerleriyle.
//   - Yönetici ve servis hesabı (buyur_admins) BURADA loglanmaz: yönetim
//     işlemleri gerekçesiyle Next.js katmanında yazılır (runAuditedUpdate);
//     servis hesabının yazmaları (menü sayacı, AI kotası) gürültüdür, anlamlı
//     olanları (kayıt, AI) ilgili route kendisi yazar.
//   - Girişsiz ziyaretçi (değerlendirme formu) loglanmaz.
//
// .pb.js olmayan bu dosya hook olarak yüklenmez; her handler require() ile
// çağırır (PocketBase handler'ları yalıtılmış çalışır, üst kapsamı görmez).

const LOG_COLLECTION = "buyur_admin_logs";

/** Koleksiyon → kayıttaki kaynak adı (eylem öneki). */
const RESOURCES = {
  buyur_businesses: "business",
  buyur_categories: "category",
  buyur_products: "product",
  buyur_product_options: "product_option",
  buyur_popups: "popup",
  buyur_qr_codes: "qr_code",
  buyur_plans: "plan",
  buyur_settings: "setting",
};

/** Kayda girmeyen alanlar: her yazımda değişen damgalar, sistem alanları ve
 *  panelin kendiliğinden yazdığı aktivasyon zaman damgaları (gürültü). */
const IGNORED_FIELDS = {
  created: true,
  updated: true,
  collectionId: true,
  collectionName: true,
  expand: true,
  activation: true,
  password: true,
  passwordConfirm: true,
  oldPassword: true,
  tokenKey: true,
};

/** Değişince eylemi "fiyat değişti" yapan ürün alanları. */
const PRICE_FIELDS = ["price", "discount_percent"];

/** Metin alanı kayıtta en fazla bu kadar yer tutar; çeviri gibi büyük JSON
 *  alanları yüzünden kayıt satırı şişmesin. */
const MAX_VALUE_CHARS = 4000;

function actorOf(e) {
  const auth = e.auth;
  if (!auth) return null;
  const name = auth.collection().name;
  if (name === "buyur_businesses") return { type: "business", id: auth.id, email: auth.email() };
  if (name === "_superusers") return { type: "superuser", id: auth.id, email: auth.email() };
  return null;
}

function clip(value) {
  if (typeof value === "string" && value.length > MAX_VALUE_CHARS) return value.slice(0, MAX_VALUE_CHARS) + "…";
  if (value && typeof value === "object") {
    const text = JSON.stringify(value);
    if (text.length > MAX_VALUE_CHARS) return text.slice(0, MAX_VALUE_CHARS) + "…";
  }
  return value;
}

/** Kaydın düz JS kopyası. Auth kayıtlarında e-posta görünürlüğü kapalı olsa
 *  da e-posta alınır: giriş adresinin değişmesi de bir değişikliktir. */
function snapshot(record) {
  if (!record) return null;
  if (record.collection().isAuth()) record.ignoreEmailVisibility(true);
  const data = JSON.parse(JSON.stringify(record));
  const out = {};
  for (const key of Object.keys(data)) {
    if (!IGNORED_FIELDS[key]) out[key] = data[key];
  }
  return out;
}

function sameValue(a, b) {
  const empty = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  if (empty(a) && empty(b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Yalnızca değişen alanlar; ikisi de null değilse güncellemedir. */
function diff(before, after) {
  const b = {};
  const a = {};
  const keys = {};
  for (const key of Object.keys(before || {})) keys[key] = true;
  for (const key of Object.keys(after || {})) keys[key] = true;
  for (const key of Object.keys(keys)) {
    const x = before ? before[key] : undefined;
    const y = after ? after[key] : undefined;
    if (sameValue(x, y)) continue;
    b[key] = x === undefined ? null : clip(x);
    a[key] = y === undefined ? null : clip(y);
  }
  return { before: b, after: a, changed: Object.keys(a) };
}

function clipAll(data) {
  if (!data) return null;
  const out = {};
  for (const key of Object.keys(data)) out[key] = clip(data[key]);
  return out;
}

/** Kaydın insan okur adı: kayıt sonradan silinse de logda ne olduğu bilinsin. */
function labelOf(data) {
  if (!data) return "";
  return String(data.name || data.title || data.code || data.key || data.email || "").slice(0, 200);
}

function businessIdOf(app, collectionName, data) {
  if (!data) return "";
  if (collectionName === "buyur_businesses") return data.id || "";
  if (collectionName === "buyur_product_options") {
    if (!data.product) return "";
    try {
      return app.findRecordById("buyur_products", data.product).getString("business");
    } catch (_) {
      return "";
    }
  }
  return typeof data.business === "string" ? data.business : "";
}

function requestMeta(e) {
  const meta = {};
  try {
    const info = e.requestInfo();
    const agent = info.headers["user_agent"];
    if (agent) meta.user_agent = String(agent).slice(0, 300);
    meta.method = info.method;
  } catch (_) {}
  meta.source = "pocketbase";
  return meta;
}

function realIP(e) {
  try {
    return String(e.realIP()).slice(0, 64);
  } catch (_) {
    return "";
  }
}

/** Kayıt koleksiyonu göçten önceki hâlindeyse (aktör alanları yok) kayıt
 *  yazılmaz: hook, göçten önce kurulsa bile işletmelerin yazmasını
 *  durdurmasın. Göç: scripts/migrate-audit.mjs. */
function logCollection(app) {
  const collection = app.findCollectionByNameOrId(LOG_COLLECTION);
  if (!collection.fields.getByName("actor_type")) {
    app.logger().warn("buyur_audit: buyur_admin_logs göç edilmemiş, kayıt yazılmadı (scripts/migrate-audit.mjs).");
    return null;
  }
  return collection;
}

function write(app, entry) {
  const collection = logCollection(app);
  if (!collection) return;
  const record = new Record(collection);
  record.set("op_id", $security.randomString(24));
  record.set("actor_type", entry.actor.type);
  record.set("actor_id", entry.actor.id || "");
  record.set("actor_email", String(entry.actor.email || "").slice(0, 200));
  record.set("action", entry.action);
  record.set("business_id", entry.businessId || "");
  record.set("target_collection", entry.collection || "");
  record.set("target_id", entry.targetId || "");
  record.set("before", entry.before || null);
  record.set("after", entry.after || null);
  record.set("ip", entry.ip || "");
  record.set("meta", entry.meta || null);
  app.save(record);
}

/** Giriş gibi geri alınacak bir değişikliği olmayan olaylar: kayıt yazılamazsa
 *  işlem sürer (kayıt koleksiyonundaki bir arıza kimseyi dışarıda bırakmasın). */
function writeSafe(app, entry) {
  try {
    write(app, entry);
  } catch (err) {
    app.logger().error("buyur_audit: kayıt yazılamadı", "action", entry.action, "error", String(err));
  }
}

/** Oluşturma / güncelleme / silme isteğini kayıtla birlikte TEK transaction'da
 *  işler: kayıt yazılamazsa değişiklik de yazılmaz. Kaydı olmayan bir
 *  değişiklik "kim yaptı" sorusunu cevapsız bırakırdı. */
function handleWrite(e, op) {
  const actor = actorOf(e);
  if (!actor) {
    e.next();
    return;
  }
  const collectionName = e.record.collection().name;
  const resource = RESOURCES[collectionName] || collectionName;
  const before = op === "create" ? null : snapshot(op === "delete" ? e.record : e.record.original());
  let passwordChange = false;
  try {
    const body = e.requestInfo().body;
    passwordChange = op === "update" && body && body.password !== undefined && body.password !== "";
  } catch (_) {}
  const meta = requestMeta(e);
  const ip = realIP(e);

  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();

    const after = op === "delete" ? null : snapshot(e.record);
    const current = after || before;
    let action = resource + "." + op;
    let logBefore = before;
    let logAfter = after;

    if (op === "update") {
      const changes = diff(before, after);
      if (changes.changed.length === 0 && !passwordChange) return;
      logBefore = changes.before;
      logAfter = changes.after;
      if (passwordChange && changes.changed.length === 0) action = resource + ".password_change";
      else if (resource === "product" && PRICE_FIELDS.some((f) => changes.changed.indexOf(f) >= 0)) action = "product.price_change";
    } else {
      logBefore = clipAll(before);
      logAfter = clipAll(after);
    }

    meta.label = labelOf(current);
    write(txApp, {
      actor: actor,
      action: action,
      businessId: businessIdOf(txApp, collectionName, current),
      collection: collectionName,
      targetId: current ? current.id : "",
      before: logBefore,
      after: logAfter,
      ip: ip,
      meta: meta,
    });
  });
}

/** İşletme girişi. Başarısız deneme de yazılır (kaba kuvvet izi); yazılan
 *  e-posta, girilen metindir. */
function handlePasswordAuth(e) {
  const meta = requestMeta(e);
  meta.auth_method = "password";
  const ip = realIP(e);
  try {
    e.next();
  } catch (err) {
    const record = e.record;
    writeSafe(e.app, {
      actor: { type: "business", id: record ? record.id : "", email: String(e.identity || "") },
      action: "business.login_failed",
      businessId: record ? record.id : "",
      collection: "buyur_businesses",
      targetId: record ? record.id : "",
      ip: ip,
      meta: meta,
    });
    throw err;
  }
  const record = e.record;
  meta.label = record ? record.getString("name") : "";
  writeSafe(e.app, {
    actor: { type: "business", id: record ? record.id : "", email: record ? record.email() : String(e.identity || "") },
    action: "business.login",
    businessId: record ? record.id : "",
    collection: "buyur_businesses",
    targetId: record ? record.id : "",
    ip: ip,
    meta: meta,
  });
}

module.exports = {
  RESOURCES,
  LOG_COLLECTION,
  handleWrite,
  handlePasswordAuth,
  diff,
};
