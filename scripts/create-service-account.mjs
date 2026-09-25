// Next sunucusunun PocketBase'e yazmak için kullandığı servis hesabını oluşturur.
// Bu hesap buyur_admins koleksiyonunda durur (koleksiyon kuralları admin'e açık),
// event/oturum/agregat yazma işlerini yapar. Kimlik bilgileri yalnızca sunucu
// ortamına konur — NEXT_PUBLIC_ öneki ASLA kullanılmamalı.
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/create-service-account.mjs
//
// Var olan hesabın şifresini yenilemek için:
//   ... node scripts/create-service-account.mjs --reset
//
// Çıktıdaki iki satırı .env.local (ve prod ortam değişkenlerine) ekleyin.

import PocketBase from "pocketbase";
import { randomBytes } from "node:crypto";
import { SERVICE_ROLE } from "./admin-schema.mjs";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

const EMAIL = process.env.PB_SERVICE_EMAIL ?? "analytics@buyur.in";
const RESET = process.argv.includes("--reset");

function generatePassword() {
  return randomBytes(24).toString("base64url");
}

async function main() {
  const password = generatePassword();

  let existing = null;
  try {
    existing = await pb
      .collection("buyur_admins")
      .getFirstListItem(pb.filter("email = {:email}", { email: EMAIL }));
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  if (existing && !RESET) {
    console.log(`= servis hesabı zaten var: ${EMAIL} (id: ${existing.id})`);
    console.log("  Şifreyi bilmiyorsanız --reset ile yenileyin.");
    return;
  }

  if (existing) {
    await pb.collection("buyur_admins").update(existing.id, {
      password,
      passwordConfirm: password,
    });
    console.log(`~ servis hesabının şifresi yenilendi: ${EMAIL}`);
  } else {
    await pb.collection("buyur_admins").create({
      name: "Analytics Service",
      email: EMAIL,
      emailVisibility: false,
      password,
      passwordConfirm: password,
      // Panele giremez ama plan/sayaç alanlarını yazar (bkz. scripts/admin-schema.mjs).
      role: SERVICE_ROLE,
      verified: true,
    });
    console.log(`+ servis hesabı oluşturuldu: ${EMAIL}`);
  }

  console.log("\nOrtam değişkenleri (.env.local ve prod ortamına ekleyin):\n");
  console.log(`PB_SERVICE_EMAIL=${EMAIL}`);
  console.log(`PB_SERVICE_PASSWORD=${password}\n`);
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
