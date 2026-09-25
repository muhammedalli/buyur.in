import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_VALUES, ADMIN_RULES, SERVICE_ROLE } from "../scripts/admin-schema.mjs";
import { BUSINESS_PROTECTED_FIELDS, BUSINESS_RULES, SUPPORT_LOCKED_FIELDS } from "../scripts/business-schema.mjs";
import { ADMIN_ROLES } from "@/lib/admin-roles";

// PocketBase kurallarının yazılı sözleşmesi. Panel yetki matrisi sunucuda
// uygulanır; bu kurallar admin token'ı bir şekilde sızarsa ikinci kilittir.
// Gerçek PocketBase'e karşı davranış scripts/migrate-admin.mjs ile doğrulanır.
describe("admin veritabanı kuralları", () => {
  it("servis rolü panele giriş yapabilen roller arasında değildir", () => {
    expect(ADMIN_ROLE_VALUES).toContain(SERVICE_ROLE);
    expect(ADMIN_ROLES).not.toContain(SERVICE_ROLE);
  });

  it("hiçbir admin kendi rolünü değiştiremez", () => {
    expect(ADMIN_RULES.updateRule).toContain("@request.body.role:isset = false");
    expect(ADMIN_RULES.createRule).toBeNull();
  });

  it("destek rolü plan ve menü sayacını yazamaz; bunlar korumalı alanlardır", () => {
    expect(SUPPORT_LOCKED_FIELDS).toEqual(expect.arrayContaining(["plan", "menu_views"]));
    for (const field of SUPPORT_LOCKED_FIELDS) {
      expect(BUSINESS_PROTECTED_FIELDS).toContain(field);
      expect(BUSINESS_RULES.updateRule).toContain(`@request.body.${field}:isset = false`);
    }
  });

  it("hesap açma, silme ve şifre yönetimi yalnızca super_admin ve servis hesabında", () => {
    for (const key of ["createRule", "manageRule"] as const) {
      expect(BUSINESS_RULES[key]).toContain('@request.auth.role = "super_admin"');
      expect(BUSINESS_RULES[key]).toContain(`@request.auth.role = "${SERVICE_ROLE}"`);
      expect(BUSINESS_RULES[key]).not.toContain("support");
    }
    // Sahip kendi hesabını silebilir; admin tarafında yalnızca güvenilir roller.
    expect(BUSINESS_RULES.deleteRule).toMatch(/^id = @request\.auth\.id \|\| \(/);
  });
});
