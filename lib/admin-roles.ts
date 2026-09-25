// Yönetim paneli yetki matrisi — hangi rolün hangi işlemi yapabildiğinin tek
// kaynağı. Sayfalar ve /api/admin uçları rol adına değil işleme bakar
// (`canPerform(role, "plans.edit")`); yeni bir rol ya da işlem eklendiğinde
// ekranlar değişmez, yalnızca bu tablo değişir. Sözleşme:
// tests/admin-roles.test.ts.
//
// Not: PocketBase kuralları (ADMIN_BYPASS) rol ayırmaz; buyur_plans dışında
// her admin her şeyi yazabilir. Bu yüzden admin token'ı tarayıcıya hiç
// verilmez (bkz. lib/admin-session.ts) ve buradaki matris sunucuda uygulanır.

import type { AdminRole } from "@/lib/types";

export const ADMIN_ROLES: readonly AdminRole[] = ["super_admin", "support"];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Süper yönetici",
  support: "Destek",
};

export const ADMIN_ACTIONS = [
  "logs.view",
  "business.view",
  "business.note",
  "business.password_reset",
  "business.trial_extend",
  "business.ai_quota_reset",
  "business.plan_assign",
  "business.suspend",
  "business.slug_change",
  "business.delete",
  "plans.edit",
  "admins.manage",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** Destek rolü müşteriye yardım eder ama gelir ve erişim kararı vermez:
 *  plan atama, askıya alma, silme ve fiyat değişikliği super_admin'dedir.
 *  Deneme uzatma ve AI kotası sıfırlama destek görüşmesinde anında
 *  gerekebildiği için destekte kalır. */
const SUPPORT_ACTIONS: ReadonlySet<AdminAction> = new Set<AdminAction>([
  "logs.view",
  "business.view",
  "business.note",
  "business.password_reset",
  "business.trial_extend",
  "business.ai_quota_reset",
]);

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Tanınmayan rol hiçbir şey yapamaz: şemaya yeni bir rol eklenip bu tablo
 *  güncellenmezse o rol yetki kazanmamalı. */
export function canPerform(role: unknown, action: AdminAction): boolean {
  if (role === "super_admin") return true;
  if (role === "support") return SUPPORT_ACTIONS.has(action);
  return false;
}
