// Görsel alanları göçü (sürüm 0.12.0).
//
// Önce görseller MinIO'ya uygulama üzerinden yüklenip kayda yalnızca adresi
// yazılıyordu; ürünlerin çoğu da dış sağlayıcıya (Pexels, Wikimedia…) bağlıydı.
// Yeni model (scripts/image-schema.mjs):
//   · Elle yüklenen görsel → PocketBase dosya alanı (S3 deposu = MinIO). Alan
//     temizlenince ya da kayıt silinince dosya depodan da silinir.
//   · AI'ın bulduğu ürün görseli → bağlantı olarak `buyur_products.image_url`.
//
//   1) Dosya alanları ve ürün bağlantı alanı eklenir.
//   2) Yeni alanları boş, eski alanı dolu her kayıt için:
//        - eski adres MinIO'daysa (MINIO_ENDPOINT) dosya anahtarla okunur ve
//          dosya alanına yüklenir (bucket dışa kapalı: HTTP 403 döner);
//        - üründe dış sağlayıcı adresiyse olduğu gibi image_url'e yazılır
//          (indirilmez);
//        - diğerlerinde (logo/kapak/kategori/pop-up) dış adres indirilip yüklenir.
//      Sıralı yazılır; taşınamayanda eski adres yerinde kalır, sonda
//      "X taşındı, Y taşınamadı" yazılır.
//   3) --drop-legacy: taşınamayan kayıt yoksa dosyaya taşınmış görsellerin
//      MinIO'daki eski kopyaları silinir, ardından eski alanlar (logo_url,
//      cover_url, kategori/pop-up image_url, ürün images) kaldırılır. Ürünlerin
//      yeni image_url alanına dokunulmaz. Geri dönüşü yoktur; yeni kod yayına
//      alındıktan ve menüler kontrol edildikten SONRA.
//
// Sıra: 1–2 DEPLOY'DAN ÖNCE (yeni kod yeni alanları okur), yayından sonra 2'yi
// bir kez daha çalıştırın (arada eski kodla değişen görseller), en son 3.
//
// Kullanım (MINIO_ENDPOINT her adımda gerekli: hangi adresin eski yükleme
// olduğunu ayırır; anahtarlar dosya okuma/silme için):
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... MINIO_ENDPOINT=... MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... \
//       node scripts/migrate-image-files.mjs [--dry-run]
//   ... aynı değişkenlerle: node scripts/migrate-image-files.mjs --drop-legacy [--force] [--dry-run]
// Idempotent: her adım zaten uygulanmışsa atlanır.

import PocketBase from "pocketbase";
import { IMAGE_FIELDS, IMAGE_MAX_SIZE, IMAGE_PRESETS, imageField, imageFileName, imageUrlField, productImageLabel, sniffImageType } from "./image-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");
const DROP_LEGACY = process.argv.includes("--drop-legacy");
// Taşınamayan görsel (ör. kaynağı kalkmış dış bağlantı) olsa da eski alanları kaldırır.
const FORCE = process.argv.includes("--force");

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}
if (!process.env.MINIO_ENDPOINT) {
  // Olmadan eski MinIO yüklemeleri dış bağlantı sanılıp image_url'e yazılırdı.
  console.error("MINIO_ENDPOINT gerekli (ör. https://s3.harbidigital.com): eski yüklemeler buna göre ayrılır.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);
pb.autoCancellation(false);

const COLLECTIONS = [...new Set(IMAGE_FIELDS.map((spec) => spec.collection))];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function legacyUrl(record, spec) {
  const value = record[spec.legacy];
  if (spec.legacyArray) return Array.isArray(value) && typeof value[0] === "string" ? value[0].trim() : "";
  return typeof value === "string" ? value.trim() : "";
}

// Eski görseller MinIO'ya uygulama üzerinden yüklenmişti (`<uç>/<bucket>/<anahtar>`).
// Bucket artık dışa kapalı olabilir (PocketBase'e bağlanınca anonim okuma
// kalkar); bu dosyalar HTTP yerine erişim anahtarıyla okunur.
const MINIO_ORIGIN = process.env.MINIO_ENDPOINT ? new URL(process.env.MINIO_ENDPOINT).origin : null;
let minioClient = null;

async function getMinio() {
  if (!MINIO_ORIGIN || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) return null;
  if (minioClient) return minioClient;
  const { Client } = await import("minio");
  const url = new URL(process.env.MINIO_ENDPOINT);
  minioClient = new Client({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    useSSL: url.protocol === "https:",
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
  });
  return minioClient;
}

/** MinIO adresini { bucket, key }'e çözer; MinIO'ya ait değilse null. */
function minioObject(rawUrl) {
  if (!MINIO_ORIGIN) return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.origin !== MINIO_ORIGIN) return null;
  const [bucket, ...rest] = url.pathname.replace(/^\/+/, "").split("/");
  const key = decodeURIComponent(rest.join("/"));
  return bucket && key ? { bucket, key, firstSegment: rest[0] } : null;
}

async function readMinioObject(object) {
  const minio = await getMinio();
  const stream = await minio.getObject(object.bucket, object.key);
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > IMAGE_MAX_SIZE) {
      stream.destroy();
      return null;
    }
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Dosya alanını ekler ya da ayarlarını (boyut, tür, thumb) şemayla eşitler. */
async function ensureFields() {
  for (const name of COLLECTIONS) {
    const collection = await pb.collections.getOne(name);
    const specs = IMAGE_FIELDS.filter((spec) => spec.collection === name);
    let changed = false;
    const fields = [...collection.fields];
    for (const spec of specs) {
      const wanted = imageField(spec.field, spec.thumbs);
      const index = fields.findIndex((field) => field.name === spec.field);
      if (index === -1) {
        fields.push(wanted);
        console.log(`+ ${name}.${spec.field} (file) eklenecek`);
        changed = true;
        continue;
      }
      const current = fields[index];
      if (current.type !== "file") {
        throw new Error(`${name}.${spec.field} zaten var ama tipi "${current.type}" — elle bakılmalı.`);
      }
      const same =
        current.maxSelect === wanted.maxSelect &&
        current.maxSize === wanted.maxSize &&
        JSON.stringify(current.mimeTypes ?? []) === JSON.stringify(wanted.mimeTypes) &&
        JSON.stringify(current.thumbs ?? []) === JSON.stringify(wanted.thumbs) &&
        Boolean(current.protected) === wanted.protected;
      if (!same) {
        fields[index] = { ...current, ...wanted };
        console.log(`~ ${name}.${spec.field} ayarları şemayla eşitlenecek`);
        changed = true;
      }
    }
    for (const spec of specs.filter((item) => item.urlField)) {
      const current = fields.find((field) => field.name === spec.urlField);
      if (!current) {
        fields.push(imageUrlField(spec.urlField));
        console.log(`+ ${name}.${spec.urlField} (text, AI görsel bağlantısı) eklenecek`);
        changed = true;
      } else if (current.type !== "text") {
        throw new Error(`${name}.${spec.urlField} zaten var ama tipi "${current.type}" — elle bakılmalı.`);
      }
    }
    if (!changed) {
      console.log(`= ${name} dosya alanları güncel`);
      continue;
    }
    if (!DRY_RUN) await pb.collections.update(collection.id, { fields });
  }
}

/** Görseli indirir; yalnızca izinli türde ve 5MB altındaysa döner. */
async function download(url) {
  const object = minioObject(url);
  if (object && (await getMinio())) {
    try {
      const bytes = await readMinioObject(object);
      if (!bytes) return { error: "5MB üstü" };
      const type = sniffImageType(bytes);
      return type ? { bytes, type } : { error: "görsel değil ya da desteklenmeyen tür" };
    } catch (err) {
      return { error: `MinIO: ${err?.code ?? err?.message ?? err}` };
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      // Wikimedia kimliksiz isteği 403 ile geri çevirir.
      headers: { "User-Agent": "buyur-image-migration/1.0 (https://buyur.in)" },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > IMAGE_MAX_SIZE) return { error: `5MB üstü (${Math.round(bytes.length / 1024)} KB)` };
    const type = sniffImageType(bytes);
    if (!type) return { error: "görsel değil ya da desteklenmeyen tür" };
    return { bytes, type };
  } catch (err) {
    return { error: err?.name === "AbortError" ? "zaman aşımı" : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Eski yüklemeler küçültülmeden gitmişti: panelle aynı ölçülerle (IMAGE_PRESETS)
 *  WebP'ye küçültülür. sharp yoksa ya da GIF'se özgün dosya kalır; küçültülmüş
 *  dosya özgünden büyük çıkar ve özgün zaten sınırdaysa da özgün kalır. */
async function shrink(bytes, type, preset) {
  if (type === "image/gif") return { bytes, type };
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return { bytes, type };
  }
  const { maxEdge, quality } = IMAGE_PRESETS[preset];
  try {
    const meta = await sharp(bytes).metadata();
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: Math.round(quality * 100) })
      .toBuffer();
    const withinEdge = Math.max(meta.width ?? 0, meta.height ?? 0) <= maxEdge;
    if (withinEdge && out.length >= bytes.length) return { bytes, type };
    return { bytes: new Uint8Array(out), type: "image/webp" };
  } catch {
    return { bytes, type };
  }
}

async function uploadWithRetry(collection, id, field, file) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const form = new FormData();
      form.append(field, file);
      return await pb.collection(collection).update(id, form);
    } catch (err) {
      const status = err?.status ?? 0;
      if (attempt >= 4 || (status >= 400 && status < 500)) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}

async function copyImages() {
  let moved = 0;
  let linked = 0;
  const failures = [];
  for (const spec of IMAGE_FIELDS) {
    const records = await pb.collection(spec.collection).getFullList({
      fields: ["id", "name", spec.field, spec.urlField, spec.legacy, spec.urlField ? "expand.category.name" : ""].filter(Boolean).join(","),
      ...(spec.urlField ? { expand: "category" } : {}),
      batch: 500,
    });
    const pending = records.filter(
      (record) => !record[spec.field] && !(spec.urlField && record[spec.urlField]) && legacyUrl(record, spec)
    );
    // AI görseli (MinIO dışı adres) üründe bağlantı olarak kalır, indirilmez.
    const asLink = (record) => Boolean(spec.urlField) && !minioObject(legacyUrl(record, spec));
    const links = pending.filter(asLink);
    const files = pending.filter((record) => !asLink(record));
    console.log(
      `${spec.collection}.${spec.legacy}: ${files.length} kayıt dosyaya (${spec.field})` +
        (spec.urlField ? `, ${links.length} kayıt bağlantıya (${spec.urlField})` : "") +
        " taşınacak"
    );
    if (DRY_RUN) continue;

    for (const record of links) {
      try {
        await pb.collection(spec.collection).update(record.id, { [spec.urlField]: legacyUrl(record, spec) });
        linked += 1;
      } catch (err) {
        failures.push({ spec, id: record.id, url: legacyUrl(record, spec), reason: `yazılamadı (${err?.status ?? "?"})` });
      }
    }

    for (const record of files) {
      const url = legacyUrl(record, spec);
      const result = await download(url);
      if (result.error) {
        failures.push({ spec, id: record.id, url, reason: result.error });
        continue;
      }
      const small = await shrink(result.bytes, result.type, spec.preset);
      const label = record.expand?.category ? productImageLabel(record.expand.category.name, record.name) : record.name;
      const file = new File([small.bytes], imageFileName(label, small.type, spec.field), { type: small.type });
      try {
        await uploadWithRetry(spec.collection, record.id, spec.field, file);
        moved += 1;
      } catch (err) {
        failures.push({ spec, id: record.id, url, reason: `yazılamadı (${err?.status ?? "?"})` });
      }
    }
  }
  if (DRY_RUN) return failures;
  console.log(`\n${moved} görsel dosyaya taşındı, ${linked} görsel bağlantı olarak yazıldı, ${failures.length} görsel taşınamadı.`);
  for (const failure of failures) {
    console.log(`  ! ${failure.spec.collection}/${failure.id} ${failure.spec.legacy}: ${failure.reason} — ${failure.url}`);
  }
  return failures;
}

/** Taşınmış kayıtların eski dosyalarını (uygulamanın eskiden MinIO'ya
 *  doğrudan yüklediği, `<uç>/<bucket>/<anahtar>` adresli) siler. Yalnızca
 *  MINIO_ENDPOINT'e ait adresler ve yalnızca yeni alanı dolu kayıtlar. Eski
 *  dosyalar PocketBase'in kullandığı bucket'ta da durabilir: PocketBase'in
 *  kendi dosyaları `<koleksiyonId>/<kayıtId>/…` altındadır ve eski bir alan
 *  hiçbir zaman onları göstermez — yine de o önekler ayrıca korunur. */
async function purgeLegacyObjects() {
  const minio = await getMinio();
  if (!minio) {
    console.log("MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY yok: eski dosyalar silinmeden geçildi.");
    return;
  }
  const collectionIds = new Set();
  for (const name of COLLECTIONS) collectionIds.add((await pb.collections.getOne(name)).id);

  /** bucket → anahtarlar */
  const targets = new Map();
  for (const spec of IMAGE_FIELDS) {
    const records = await pb.collection(spec.collection).getFullList({ fields: `id,${spec.field},${spec.legacy}`, batch: 500 });
    for (const record of records) {
      if (!record[spec.field]) continue;
      const object = minioObject(legacyUrl(record, spec));
      if (!object || collectionIds.has(object.firstSegment)) continue;
      if (!targets.has(object.bucket)) targets.set(object.bucket, new Set());
      targets.get(object.bucket).add(object.key);
    }
  }
  const total = [...targets.values()].reduce((sum, keys) => sum + keys.size, 0);
  for (const [bucket, keys] of targets) console.log(`Eski dosya: ${bucket} bucket'ından ${keys.size} dosya silinecek`);
  if (DRY_RUN || total === 0) return;

  for (const [bucket, keys] of targets) {
    await minio.removeObjects(bucket, [...keys]);
    console.log(`- ${bucket}: ${keys.size} eski dosya silindi`);
  }
}

async function dropLegacyFields() {
  for (const name of COLLECTIONS) {
    const legacy = IMAGE_FIELDS.filter((spec) => spec.collection === name).map((spec) => spec.legacy);
    const collection = await pb.collections.getOne(name);
    const fields = collection.fields.filter((field) => !legacy.includes(field.name));
    if (fields.length === collection.fields.length) {
      console.log(`= ${name}: eski alan yok`);
      continue;
    }
    console.log(`- ${name}: ${legacy.filter((n) => collection.fields.some((f) => f.name === n)).join(", ")} kaldırılacak`);
    if (!DRY_RUN) await pb.collections.update(collection.id, { fields });
  }
}

async function main() {
  if (DRY_RUN) console.log("(kuru çalışma — hiçbir şey yazılmaz)\n");
  await ensureFields();
  const failures = await copyImages();

  if (!DROP_LEGACY) return;
  if (failures.length > 0 && !FORCE) {
    console.error("\nTaşınamayan görsel varken eski alanlar kaldırılmaz. Görselleri panelden yeniden yükleyin ya da (bu görselleri gözden çıkararak) --force ile çalıştırın.");
    process.exit(1);
  }
  await purgeLegacyObjects();
  await dropLegacyFields();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
