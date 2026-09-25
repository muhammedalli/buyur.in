import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TTL_MS,
  isSameOrigin,
  openAdminCookie,
  readSessionSecret,
  sealAdminCookie,
} from "@/lib/admin-session";

// Admin oturum çerezinin sözleşmesi: PocketBase token'ı tarayıcıda okunamaz,
// "kod bekleniyor" çerezi oturum yerine geçemez, süre ve sır zorunludur.
describe("admin oturum çerezi", () => {
  const secret = "s".repeat(40);
  const now = 1_800_000_000_000;
  const payload = { token: "pb.jwt.token", email: "ali@buyur.in", exp: now + ADMIN_SESSION_TTL_MS };

  it("token'ı düz metin taşımaz ve aynı sırla geri açılır", () => {
    const sealed = sealAdminCookie("session", payload, secret);
    expect(sealed).not.toContain("pb.jwt.token");
    expect(Buffer.from(sealed.replace(/\./g, ""), "base64url").toString("utf8")).not.toContain("ali@buyur.in");
    expect(openAdminCookie("session", sealed, secret, now)).toEqual(payload);
  });

  it("kod bekleniyor çerezi oturum çerezi olarak açılamaz (ve tersi)", () => {
    const pending = sealAdminCookie("pending", payload, secret);
    expect(openAdminCookie("session", pending, secret, now)).toBeNull();
    const session = sealAdminCookie("session", payload, secret);
    expect(openAdminCookie("pending", session, secret, now)).toBeNull();
  });

  it("süresi dolmuş, başka sırla şifrelenmiş ya da bozulmuş çerezi reddeder", () => {
    const sealed = sealAdminCookie("session", payload, secret);
    expect(openAdminCookie("session", sealed, secret, payload.exp)).toBeNull();
    expect(openAdminCookie("session", sealed, "x".repeat(40), now)).toBeNull();
    const [iv, body, tag] = sealed.split(".");
    const flipped = body.startsWith("A") ? `B${body.slice(1)}` : `A${body.slice(1)}`;
    expect(openAdminCookie("session", [iv, flipped, tag].join("."), secret, now)).toBeNull();
    for (const junk of [undefined, null, "", "abc", "a.b", "a.b.c.d"]) {
      expect(openAdminCookie("session", junk, secret, now)).toBeNull();
    }
  });

  it("sır tanımlı değilse ya da kısaysa admin girişi kapalı kalır", () => {
    expect(readSessionSecret(undefined)).toBeNull();
    expect(readSessionSecret("")).toBeNull();
    expect(readSessionSecret("kisa-sir")).toBeNull();
    expect(readSessionSecret("k".repeat(32))).toBe("k".repeat(32));
  });

  it("başka siteden gelen isteği ayırt eder", () => {
    expect(isSameOrigin("https://admin.buyur.in", "admin.buyur.in")).toBe(true);
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(isSameOrigin("https://kotu.example", "admin.buyur.in")).toBe(false);
    // Kök alan adı ya da işletme alt alanı admin ucuna istek atamaz.
    expect(isSameOrigin("https://buyur.in", "admin.buyur.in")).toBe(false);
    expect(isSameOrigin("https://kafe.buyur.in", "admin.buyur.in")).toBe(false);
    expect(isSameOrigin("bozuk", "admin.buyur.in")).toBe(false);
    expect(isSameOrigin(null, "admin.buyur.in")).toBe(true);
  });
});
