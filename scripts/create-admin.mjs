// Yönetim paneli hesabı açar (ilk super_admin'i kurmanın tek yolu: buyur_admins
// createRule kapalı, hesaplar API'den self-serve açılamaz). Şifre üretilir ve
// yalnızca bir kez ekrana yazılır; ilk girişte değiştirilmesi beklenir.
//
// Kullanım:
//   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... \
//     node scripts/create-admin.mjs --email ali@buyur.in --name "Ali Yılmaz" [--role support]
//
// Rol verilmezse super_admin. Var olan hesabın şifresini yenilemek için --reset.
// Idempotent: hesap zaten varsa dokunmadan çıkar (rolü de değiştirmez; rol
// değişikliği denetim kaydına düşsün diye panelden yapılır).

import PocketBase from "pocketbase";
import { randomBytes } from "node:crypto";

const PB_URL = process.env.POCKETBASE_API_URL;
const PB_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN;

if (!PB_URL || !PB_TOKEN) {
  console.error("POCKETBASE_API_URL ve POCKETBASE_ADMIN_TOKEN ortam değişkenleri gerekli.");
  process.exit(1);
}

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const EMAIL = arg("email")?.trim().toLowerCase();
const NAME = arg("name")?.trim();
const ROLE = arg("role") ?? "super_admin";
const RESET = process.argv.includes("--reset");

if (!EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(EMAIL)) {
  console.error('Geçerli bir --email gerekli. Örnek: --email ali@buyur.in --name "Ali Yılmaz"');
  process.exit(1);
}
if (!["super_admin", "support"].includes(ROLE)) {
  console.error("--role yalnızca super_admin ya da support olabilir.");
  process.exit(1);
}
// Servis hesabı insan değildir; bu script onu yönetici yapmamalı ya da şifresini
// değiştirip sunucuyu kilitlememeli.
if (process.env.PB_SERVICE_EMAIL && EMAIL === process.env.PB_SERVICE_EMAIL.trim().toLowerCase()) {
  console.error("Bu adres servis hesabına ait. Servis hesabı için scripts/create-service-account.mjs kullanın.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.authStore.save(PB_TOKEN, null);

async function main() {
  const password = randomBytes(18).toString("base64url");

  let existing = null;
  try {
    existing = await pb.collection("buyur_admins").getFirstListItem(pb.filter("email = {:email}", { email: EMAIL }));
  } catch (err) {
    if (err?.status !== 404) throw err;
  }

  if (existing && !RESET) {
    console.log(`= yönetici zaten var: ${EMAIL} (rol: ${existing.role}, id: ${existing.id})`);
    console.log("  Şifreyi bilmiyorsanız --reset ile yenileyin.");
    return;
  }

  if (existing) {
    await pb.collection("buyur_admins").update(existing.id, { password, passwordConfirm: password });
    console.log(`~ yöneticinin şifresi yenilendi: ${EMAIL}`);
  } else {
    if (!NAME) {
      console.error('Yeni hesap için --name gerekli. Örnek: --name "Ali Yılmaz"');
      process.exit(1);
    }
    await pb.collection("buyur_admins").create({
      name: NAME,
      email: EMAIL,
      emailVisibility: false,
      password,
      passwordConfirm: password,
      role: ROLE,
      verified: true,
    });
    console.log(`+ yönetici oluşturuldu: ${EMAIL} (rol: ${ROLE})`);
  }

  console.log(`\nGeçici şifre (bir kez gösterilir): ${password}\n`);
  console.log("Girişte e-postaya kod gider; BREVO_API_KEY ve ADMIN_SESSION_SECRET tanımlı olmalı.");
}

main().catch((err) => {
  console.error("Hata:", err?.response ?? err);
  process.exit(1);
});
