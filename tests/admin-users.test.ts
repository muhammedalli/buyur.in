import { describe, expect, it } from "vitest";
import { buildAdminAccountPatch, generateTemporaryPassword, parseNewAdmin, TEMP_PASSWORD_LENGTH } from "@/lib/admin-users";
import { canPerform } from "@/lib/admin-roles";

// Yönetici hesapları üzerindeki işlemlerin sözleşmesi. PocketBase kuralları
// (scripts/admin-schema.mjs) aynı kilitleri ikinci kez uygular.
describe("yönetici hesapları", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const actor = { id: "a1" };
  const target = { id: "a2", role: "support" as const, disabled_at: "" };

  it("yalnızca süper yönetici yönetir", () => {
    expect(canPerform("super_admin", "admins.manage")).toBe(true);
    expect(canPerform("support", "admins.manage")).toBe(false);
  });

  it("kimse kendi rolüne ya da erişimine dokunamaz (son süper yönetici kilidi)", () => {
    for (const kind of ["role_change", "disable", "enable"] as const) {
      expect(buildAdminAccountPatch(kind, { role: "support" }, { ...target, id: "a1" }, actor, now)).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("rol değiştirme: geçerli ve farklı rol; servis rolü verilemez", () => {
    expect(buildAdminAccountPatch("role_change", { role: "super_admin" }, target, actor, now)).toEqual({ ok: true, patch: { role: "super_admin" } });
    expect(buildAdminAccountPatch("role_change", { role: "support" }, target, actor, now)).toMatchObject({ ok: false });
    expect(buildAdminAccountPatch("role_change", { role: "service" }, target, actor, now)).toMatchObject({ ok: false });
  });

  it("erişim kapatma/açma durumla tutarlı olmalı", () => {
    expect(buildAdminAccountPatch("disable", {}, target, actor, now)).toEqual({ ok: true, patch: { disabled_at: now.toISOString() } });
    expect(buildAdminAccountPatch("enable", {}, target, actor, now)).toMatchObject({ ok: false });
    const disabled = { ...target, disabled_at: "2026-09-20 10:00:00.000Z" };
    expect(buildAdminAccountPatch("enable", {}, disabled, actor, now)).toEqual({ ok: true, patch: { disabled_at: "" } });
    expect(buildAdminAccountPatch("disable", {}, disabled, actor, now)).toMatchObject({ ok: false });
  });

  it("yeni hesap: e-posta küçük harfe, ad zorunlu, rol panele girebilen rollerden", () => {
    expect(parseNewAdmin({ email: " Ayse@Buyur.in ", name: " Ayşe ", role: "support" })).toEqual({
      ok: true,
      value: { email: "ayse@buyur.in", name: "Ayşe", role: "support" },
    });
    expect(parseNewAdmin({ email: "x@y.co", name: "", role: "support" })).toMatchObject({ ok: false });
    expect(parseNewAdmin({ email: "x@y.co", name: "X", role: "service" })).toMatchObject({ ok: false });
    expect(parseNewAdmin({ email: "olmaz", name: "X", role: "support" })).toMatchObject({ ok: false });
  });

  it("geçici şifre yeterince uzun ve karışabilecek karakter içermez", () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(password).not.toMatch(/[0O1lI]/);
    expect(generateTemporaryPassword()).not.toBe(password);
  });
});
