// Yönetici hesapları (buyur_admins) üzerindeki işlemlerin SAF kuralları:
// hesap açma, rol değiştirme, erişimi kapatma/açma. Ağ yok; sözleşmesi
// tests/admin-users.test.ts. Uygulama: app/api/admin/admins.
//
// Kilitler (PocketBase kuralları da aynısını uygular, bkz.
// scripts/admin-schema.mjs):
//   - Kimse kendi rolünü ve erişimini değiştiremez. Bu, "son süper yönetici
//     kendini düşürürse panel sahipsiz kalır" durumunu da kapatır: işlemi
//     yapan her zaman aktif bir super_admin'dir ve kendisine dokunamaz.
//   - Servis hesabı listede görünmez ve hedef alınamaz; kimse servis rolüne
//     alınamaz (sunucunun kimliği bozulursa kayıt/sayaç/AI yazımları durur).
//   - Hesap silinmez, erişimi kapatılır: denetim kaydındaki izleri ona bağlı
//     kalır ve erişim geri açılabilir.

import { ADMIN_ROLES, isAdminRole } from "@/lib/admin-roles";
import { isValidEmail, normalizeEmail } from "@/lib/otp-client";
import type { Admin, AdminRole } from "@/lib/types";

export type AdminAccountActionKind = "role_change" | "disable" | "enable";

export const ADMIN_ACCOUNT_ACTIONS: Record<AdminAccountActionKind, { logAction: string; label: string }> = {
  role_change: { logAction: "admin.role_change", label: "Rolü değiştir" },
  disable: { logAction: "admin.disable", label: "Erişimi kapat" },
  enable: { logAction: "admin.enable", label: "Erişimi aç" },
};

export function isAdminAccountActionKind(value: unknown): value is AdminAccountActionKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ADMIN_ACCOUNT_ACTIONS, value);
}

export const ADMIN_NAME_MAX = 120;
/** Geçici şifre uzunluğu. Yönetici ilk girişte değiştirir (Hesabım). */
export const TEMP_PASSWORD_LENGTH = 16;

export function isDisabled(admin: Pick<Admin, "disabled_at"> | null | undefined): boolean {
  return Boolean(admin?.disabled_at?.trim());
}

type Result = { ok: true; patch: Record<string, unknown> } | { ok: false; error: string; status?: number };

export function buildAdminAccountPatch(
  kind: AdminAccountActionKind,
  input: { role?: unknown },
  target: Pick<Admin, "id" | "role" | "disabled_at">,
  actor: Pick<Admin, "id">,
  now: Date = new Date()
): Result {
  if (target.id === actor.id) return { ok: false, error: "Kendi rolünü ya da erişimini değiştiremezsin.", status: 403 };
  switch (kind) {
    case "role_change": {
      if (!isAdminRole(input.role)) return { ok: false, error: "Geçerli bir rol seç." };
      if (input.role === target.role) return { ok: false, error: "Yönetici zaten bu rolde." };
      return { ok: true, patch: { role: input.role } };
    }
    case "disable":
      if (isDisabled(target)) return { ok: false, error: "Erişim zaten kapalı." };
      return { ok: true, patch: { disabled_at: now.toISOString() } };
    case "enable":
      if (!isDisabled(target)) return { ok: false, error: "Erişim zaten açık." };
      return { ok: true, patch: { disabled_at: "" } };
  }
}

export interface NewAdminInput {
  email: string;
  name: string;
  role: AdminRole;
}

export function parseNewAdmin(input: { email?: unknown; name?: unknown; role?: unknown }):
  | { ok: true; value: NewAdminInput }
  | { ok: false; error: string } {
  if (!isValidEmail(input.email)) return { ok: false, error: "Geçerli bir e-posta adresi gir." };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "Ad boş olamaz." };
  if (name.length > ADMIN_NAME_MAX) return { ok: false, error: `Ad en fazla ${ADMIN_NAME_MAX} karakter olabilir.` };
  if (!isAdminRole(input.role)) return { ok: false, error: "Geçerli bir rol seç." };
  return { ok: true, value: { email: normalizeEmail(input.email), name, role: input.role } };
}

/** Karışabilecek karakterler (0/O, 1/l/I) yok: şifre telefonda okunabilsin. */
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(TEMP_PASSWORD_LENGTH);
  // Modulo yanlılığı 256/55 düzeyinde; geçici şifre için önemsiz, yine de
  // her karakter kriptografik kaynaktan gelir.
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

export { ADMIN_ROLES };
