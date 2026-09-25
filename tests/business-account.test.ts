import { describe, expect, it } from "vitest";
import { contactEmailPatch, isBusinessSetUp, publicContactEmail } from "@/lib/business-account";
import { initialPlanFields } from "@/lib/plan-period";
import {
  BUSINESS_PROTECTED_FIELDS,
  BUSINESS_RULES,
  rewriteOwnerRule,
} from "../scripts/business-schema.mjs";

// Birleşik model: 1 işletme hesabı = 1 buyur_businesses kaydı = 1 kimlik.
// Bu dosya modelin iş kurallarını sabitler.

describe("iletişim e-postası — tek kaynak", () => {
  it("giriş e-postasıyla aynı adres ikinci kez saklanmaz, yalnızca görünürlük açılır", () => {
    expect(contactEmailPatch("Sahip@Kafe.com ", "sahip@kafe.com")).toEqual({ contact_email: "", emailVisibility: true });
  });

  it("farklı adres ayrı alanda tutulur, giriş e-postası gizli kalır", () => {
    expect(contactEmailPatch("info@kafe.com", "sahip@kafe.com")).toEqual({
      contact_email: "info@kafe.com",
      emailVisibility: false,
    });
  });

  it("boş bırakılırsa menüde e-posta gösterilmez", () => {
    expect(contactEmailPatch("  ", "sahip@kafe.com")).toEqual({ contact_email: "", emailVisibility: false });
  });

  it("menüde gösterilen adres: önce iletişim adresi, sonra görünürse giriş e-postası", () => {
    expect(publicContactEmail({ contact_email: "info@kafe.com", email: "sahip@kafe.com", emailVisibility: true })).toBe(
      "info@kafe.com"
    );
    expect(publicContactEmail({ contact_email: "", email: "sahip@kafe.com", emailVisibility: true })).toBe("sahip@kafe.com");
    expect(publicContactEmail({ contact_email: "", email: "sahip@kafe.com", emailVisibility: false })).toBe("");
    // Herkese açık okumada görünürlük kapalıysa PocketBase e-postayı hiç göndermez.
    expect(publicContactEmail({ contact_email: "" })).toBe("");
  });
});

describe("kurulum durumu", () => {
  it("slug seçilene kadar hesap kurulmamış sayılır", () => {
    expect(isBusinessSetUp({ slug: "" })).toBe(false);
    expect(isBusinessSetUp(null)).toBe(false);
    expect(isBusinessSetUp({ slug: "kahve" })).toBe(true);
  });
});

describe("kayıtta plan alanları", () => {
  const now = new Date("2026-01-31T10:00:00Z");

  it("süreli varsayılan planda deneme penceresi kayıt anında sabitlenir", () => {
    const fields = initialPlanFields({ key: "freemium", trial_months: 1 }, now);
    expect(fields.plan).toBe("freemium");
    expect(fields.freemium_started_at).toBe(now.toISOString());
    // 31 Ocak + 1 ay → şubatın son günü (taşma yok)
    expect(fields.plan_expires_at.startsWith("2026-02-28")).toBe(true);
    expect(fields.menu_views).toBe(0);
  });

  it("plan kaydı okunamazsa freemium, süre yazılmaz", () => {
    expect(initialPlanFields(null, now)).toEqual({ plan: "freemium", freemium_started_at: "", plan_expires_at: "", menu_views: 0 });
  });
});

describe("erişim kuralları", () => {
  it("sahip plan ve sayaç alanlarını değiştiremez", () => {
    for (const field of ["plan", "plan_expires_at", "freemium_started_at", "menu_views", "ai_scans_used", "ai_scans_period"]) {
      expect(BUSINESS_PROTECTED_FIELDS).toContain(field);
      expect(BUSINESS_RULES.updateRule).toContain(`@request.body.${field}:isset = false`);
    }
  });

  it("kayıt tarayıcıdan açılamaz, kurulmamış hesap herkese görünmez", () => {
    expect(BUSINESS_RULES.createRule).toBe('@request.auth.collectionName = "buyur_admins"');
    expect(BUSINESS_RULES.listRule.startsWith("is_active = true")).toBe(true);
  });

  it("eski sahiplik ifadesi yeni modele çevrilir", () => {
    expect(rewriteOwnerRule("business.is_active = true || business.owner = @request.auth.id")).toBe(
      "business.is_active = true || business = @request.auth.id"
    );
    expect(rewriteOwnerRule("product.business.owner = @request.auth.id")).toBe("product.business = @request.auth.id");
    expect(rewriteOwnerRule(null)).toBeNull();
  });
});

describe("e-postadan hesap bulma", () => {
  it("filtre yerine listeden, büyük/küçük harf ve boşluk duyarsız bulur", async () => {
    const { findBusinessByEmail } = await import("@/lib/business-auth");
    const calls: unknown[] = [];
    const fake = {
      collection: () => ({
        getFullList: async (options: unknown) => {
          calls.push(options);
          return [
            { id: "a", email: "Sahip@Kafe.com", name: "Kafe" },
            { id: "b", email: "diger@kafe.com", name: "Diğer" },
          ];
        },
      }),
    } as unknown as Parameters<typeof findBusinessByEmail>[0];

    expect((await findBusinessByEmail(fake, "  sahip@kafe.COM "))?.id).toBe("a");
    expect(await findBusinessByEmail(fake, "yok@kafe.com")).toBeNull();
    expect(await findBusinessByEmail(fake, "")).toBeNull();
    // Görünürlüğü kapalı e-postalarda boş dönen `email = …` filtresi kullanılmıyor.
    expect(JSON.stringify(calls)).not.toContain("filter");
  });
});
