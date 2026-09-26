import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_VALUES, ADMIN_RULES, SERVICE_ROLE } from "../scripts/admin-schema.mjs";
import { AUDIT_ACTOR_TYPES as SCHEMA_ACTOR_TYPES, AUDIT_LOG_RULES } from "../scripts/audit-schema.mjs";
import { AUDIT_ACTOR_TYPES } from "@/lib/audit-log";
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

  it("hiçbir admin kendi rolünü ve erişimini değiştiremez", () => {
    // Kendi kaydı: rol ve erişim alanı gönderilemez; super_admin dalında da
    // kendine (id = auth.id) rol/erişim yazamaz.
    expect(ADMIN_RULES.updateRule).toMatch(/^\(id = @request\.auth\.id && @request\.body\.role:isset = false && @request\.body\.disabled_at:isset = false\)/);
    expect(ADMIN_RULES.updateRule).toContain("(id != @request.auth.id || (@request.body.role:isset = false && @request.body.disabled_at:isset = false))");
    expect(ADMIN_RULES.deleteRule).toContain("id != @request.auth.id");
  });

  it("yönetici hesabını yalnızca super_admin açar; servis hesabına kimse dokunamaz", () => {
    expect(ADMIN_RULES.createRule).toContain('@request.auth.role = "super_admin"');
    expect(ADMIN_RULES.createRule).toContain(`@request.body.role != "${SERVICE_ROLE}"`);
    for (const key of ["updateRule", "deleteRule", "manageRule"] as const) {
      expect(ADMIN_RULES[key]).toContain(`role != "${SERVICE_ROLE}"`);
    }
  });

  it("erişimi kapatılan yönetici ve silinen işletme giriş yapamaz", () => {
    expect(ADMIN_RULES.authRule).toBe('disabled_at = ""');
    expect(BUSINESS_RULES.authRule).toBe('deleted_at = ""');
    expect(BUSINESS_PROTECTED_FIELDS).toEqual(expect.arrayContaining(["deleted_at", "deletion_reason"]));
    expect(SUPPORT_LOCKED_FIELDS).toEqual(expect.arrayContaining(["deleted_at", "deletion_reason"]));
  });

  it("denetim kaydı yalnızca eklenir; yönetici başkası adına kayıt yazamaz", () => {
    expect(AUDIT_LOG_RULES.updateRule).toBeNull();
    expect(AUDIT_LOG_RULES.deleteRule).toBeNull();
    expect(AUDIT_LOG_RULES.createRule).toContain("@request.body.admin = @request.auth.id");
    // Başka aktör adına yalnızca servis hesabı yazar.
    expect(AUDIT_LOG_RULES.createRule).toContain(`@request.auth.role = "${SERVICE_ROLE}"`);
    expect(AUDIT_LOG_RULES.createRule).toContain('@request.body.actor_type = "admin"');
    expect(AUDIT_LOG_RULES.createRule).toContain("@request.body.actor_id = @request.auth.id");
    expect([...SCHEMA_ACTOR_TYPES]).toEqual([...AUDIT_ACTOR_TYPES]);
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
