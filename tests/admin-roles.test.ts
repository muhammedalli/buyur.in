import { describe, expect, it } from "vitest";
import { ADMIN_ACTIONS, canPerform, isAdminRole, type AdminAction } from "@/lib/admin-roles";

// Yönetim paneli yetki matrisinin yazılı sözleşmesi. Bir rolün yetkisi
// değişiyorsa önce bu test değişir.
describe("admin yetki matrisi", () => {
  const supportCan: AdminAction[] = [
    "logs.view",
    "business.view",
    "business.note",
    "business.password_reset",
    "business.trial_extend",
    "business.ai_quota_reset",
  ];
  const superOnly: AdminAction[] = [
    "business.plan_assign",
    "business.suspend",
    "business.slug_change",
    "business.delete",
    "plans.edit",
    "admins.manage",
  ];

  it("matris bütün işlemleri kapsar", () => {
    expect([...supportCan, ...superOnly].sort()).toEqual([...ADMIN_ACTIONS].sort());
  });

  it("super_admin her işlemi yapabilir", () => {
    for (const action of ADMIN_ACTIONS) expect(canPerform("super_admin", action)).toBe(true);
  });

  it("destek müşteriye yardım eder ama gelir ve erişim kararı veremez", () => {
    for (const action of supportCan) expect(canPerform("support", action)).toBe(true);
    for (const action of superOnly) expect(canPerform("support", action)).toBe(false);
  });

  it("tanınmayan ya da boş rol hiçbir şey yapamaz", () => {
    for (const role of [undefined, null, "", "admin", "SUPER_ADMIN", "owner"]) {
      for (const action of ADMIN_ACTIONS) expect(canPerform(role, action)).toBe(false);
      expect(isAdminRole(role)).toBe(false);
    }
    expect(isAdminRole("support")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });
});
