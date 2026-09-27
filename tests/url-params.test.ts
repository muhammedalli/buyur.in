import { describe, expect, it } from "vitest";
import {
  LEGACY_SECTION_ANCHORS,
  modernSectionAnchor,
  readParam,
  settingsHref,
  settingsTabFromParam,
  systemTabFromParam,
} from "@/lib/url-params";
import { sectionId, type LandingSection } from "@/lib/landing-sections";

// Adres çubuğundaki parametre ve çapaların sözleşmesi: yeni bağlantılar
// İngilizce üretilir, eski Türkçe bağlantılar okunmaya devam eder.

describe("readParam", () => {
  it("önce İngilizce adı, yoksa eski Türkçe adı okur", () => {
    expect(readParam({ status: "live", durum: "deleted" }, "status")).toBe("live");
    expect(readParam({ durum: "deleted" }, "status")).toBe("deleted");
    expect(readParam({ sekme: "ekip" }, "tab")).toBe("ekip");
    expect(readParam({ page: ["2", "3"] }, "page")).toBe("2");
    expect(readParam({}, "page")).toBeUndefined();
    expect(readParam({ q: "kafe" }, "q")).toBe("kafe");
  });
});

describe("panel ayarları sekmesi", () => {
  it("İngilizce değerleri ve eski Türkçe değerleri tanır", () => {
    expect(settingsTabFromParam("contact")).toBe("contact");
    expect(settingsTabFromParam("iletisim")).toBe("contact");
    expect(settingsTabFromParam("genel")).toBe("general");
    expect(settingsTabFromParam("tema")).toBe("theme");
    expect(settingsTabFromParam("sosyal")).toBe("social");
    expect(settingsTabFromParam("diller")).toBe("languages");
    expect(settingsTabFromParam("yazi")).toBe("marquee");
    expect(settingsTabFromParam("ozellik")).toBe("amenities");
    expect(settingsTabFromParam("panel")).toBe("panel");
    expect(settingsTabFromParam("bilinmeyen")).toBeNull();
    expect(settingsTabFromParam(null)).toBeNull();
    expect(settingsHref("contact")).toBe("/panel/settings?tab=contact");
  });

  it("yönetim sistem sekmesi eski değeri de tanır", () => {
    expect(systemTabFromParam("team")).toBe("team");
    expect(systemTabFromParam("ekip")).toBe("team");
    expect(systemTabFromParam(undefined)).toBe("settings");
  });
});

describe("tanıtım sayfası çapaları", () => {
  const sections: LandingSection[] = ["platform", "why", "liveMenu", "features", "panel", "analytics", "how", "customers", "pricing", "compare", "faq"];

  it("çapalar İngilizcedir (Türkçe karakter ya da Türkçe kelime yok)", () => {
    for (const section of sections) expect(sectionId(section)).toMatch(/^[a-z-]+$/);
    expect(sectionId("pricing")).toBe("pricing");
    expect(sectionId("faq")).toBe("faq");
  });

  it("her eski Türkçe çapa var olan bir İngilizce çapaya gider", () => {
    const current = new Set(sections.map((section) => sectionId(section)));
    for (const target of Object.values(LEGACY_SECTION_ANCHORS)) expect(current.has(target), target).toBe(true);
    expect(modernSectionAnchor("#fiyat")).toBe("pricing");
    expect(modernSectionAnchor("#sss")).toBe("faq");
    expect(modernSectionAnchor("#canli-menu")).toBe("live-demo");
    expect(modernSectionAnchor("#pricing")).toBeNull();
    expect(modernSectionAnchor("")).toBeNull();
  });
});
