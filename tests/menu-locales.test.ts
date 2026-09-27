import { describe, expect, it } from "vitest";
import {
  activeLocales,
  isRTLLocale,
  localeAiNames,
  localeCodes,
  localeLabels,
  localeNamesEn,
  localeNamesTr,
  localeTags,
  MAX_MENU_LOCALES,
  SUPPORTED_LOCALES,
  UI_STRINGS,
} from "@/lib/i18n";
import { allergenLabels, badgeLabels, highlightLabels } from "@/lib/labels";
import { HIGHLIGHT_VALUES, MENU_EXTRA_LANGUAGES_MAX, MENU_LOCALE_VALUES } from "@/scripts/storefront-schema.mjs";

// Menü dilleri sözleşmesi (docs/localization.md): desteklenen diller ve sırası,
// işletme başına en fazla 4 dil, her dilde eksiksiz arayüz metni ve şemanın
// uygulamayla aynı kalması. Mekân özelliklerinde seçim sınırı yoktur.

const PLACEHOLDER = /\{(\w+)\}/g;
const placeholders = (text: string) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

describe("menü dilleri", () => {
  it("yalnızca bu sekiz dil, bu sırayla", () => {
    expect([...SUPPORTED_LOCALES]).toEqual(["tr", "en", "de", "ar", "fr", "es", "it", "ru"]);
  });

  it("PocketBase seçenekleri ve ek dil sınırı uygulamayla aynı", () => {
    expect(MENU_LOCALE_VALUES).toEqual([...SUPPORTED_LOCALES]);
    expect(MAX_MENU_LOCALES).toBe(4);
    expect(MENU_EXTRA_LANGUAGES_MAX).toBe(MAX_MENU_LOCALES - 1);
  });

  it("yalnızca Arapça sağdan sola", () => {
    expect(SUPPORTED_LOCALES.filter(isRTLLocale)).toEqual(["ar"]);
  });

  it("her dil tablosunda her dilin kaydı var", () => {
    for (const table of [localeLabels, localeAiNames, localeTags, localeNamesTr, localeNamesEn, localeCodes]) {
      for (const locale of SUPPORTED_LOCALES) expect(table[locale], locale).toBeTruthy();
    }
  });
});

describe("işletme başına en fazla 4 dil", () => {
  it("ana dil ilk sırada, ek diller desteklenen sırayla", () => {
    expect(activeLocales({ main_language: "de", languages: ["ru", "tr"] })).toEqual(["de", "tr", "ru"]);
  });

  it("şema sınırı gevşek bir kayıtta bile 4 dili aşmaz", () => {
    const locales = activeLocales({ main_language: "tr", languages: ["en", "de", "ar", "fr", "es"] });
    expect(locales).toHaveLength(MAX_MENU_LOCALES);
    expect(locales[0]).toBe("tr");
  });

  it("dil ayarı hiç yapılmamış eski kayıt eski dört dili görür", () => {
    expect(activeLocales({})).toEqual(["tr", "en", "ar", "ru"]);
  });

  it("tanınmayan dil (ör. kaldırılmış bir seçenek) sessizce elenir", () => {
    expect(activeLocales({ main_language: "tr", languages: ["ku" as never, "en"] })).toEqual(["tr", "en"]);
  });
});

describe("müşteri menüsü metinleri", () => {
  it("her anahtarın her dilde metni var ve yer tutucular kaynakla aynı", () => {
    const problems: string[] = [];
    for (const [key, entry] of Object.entries(UI_STRINGS) as [string, Record<string, string>][]) {
      const source = placeholders(entry.tr);
      for (const locale of SUPPORTED_LOCALES) {
        const text = entry[locale];
        if (!text?.trim()) problems.push(`${key}.${locale}: boş`);
        else if (JSON.stringify(placeholders(text)) !== JSON.stringify(source)) problems.push(`${key}.${locale}: yer tutucu`);
      }
      const extra = Object.keys(entry).filter((locale) => !(SUPPORTED_LOCALES as readonly string[]).includes(locale));
      if (extra.length) problems.push(`${key}: desteklenmeyen dil ${extra.join(",")}`);
    }
    expect(problems).toEqual([]);
  });

  it("alerjen, rozet ve mekân özelliği etiketleri her dilde eksiksiz", () => {
    for (const table of [allergenLabels, badgeLabels, highlightLabels] as Record<string, Record<string, string>>[]) {
      const keys = Object.keys(table.tr);
      expect(Object.keys(table).sort()).toEqual([...SUPPORTED_LOCALES].sort());
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of keys) expect(table[locale][key]?.trim(), `${locale}.${key}`).toBeTruthy();
      }
    }
  });
});

describe("mekân özellikleri", () => {
  it("şemadaki seçenekler etiket tablosuyla aynı; seçim sınırı yok", () => {
    expect([...HIGHLIGHT_VALUES].sort()).toEqual(Object.keys(highlightLabels.tr).sort());
  });
});
