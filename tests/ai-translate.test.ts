import { describe, expect, it } from "vitest";
import {
  fillMissingTranslations,
  missingLocales,
  missingTranslations,
  normalizeLocaleKey,
  normalizeTranslationResult,
  resolveTargetLocales,
  sanitizeEntries,
} from "@/lib/ai/translate";

// AI çeviri sözleşmesi. Korunan en kritik kural: ÇEVİRİ YALNIZCA METNE DOKUNUR.
// Fiyat ve sayısal veri modele hiç gönderilmez (sanitizeEntries yalnızca
// çevrilebilir metin alanlarını geçirir) ve dönen çıktıdan da yalnızca bilinen
// metin alanları kabul edilir.

describe("sanitizeEntries", () => {
  it("yalnızca çevrilebilir metin alanlarını geçirir — fiyat ve sayı elenir", () => {
    const [entry] = sanitizeEntries([
      {
        id: "product:abc",
        kind: "product",
        fields: {
          name: "Adana Kebap",
          description: "Acılı",
          price: 320,
          calories: 850,
          allergens: ["gluten"],
        },
      },
    ]);

    expect(entry.fields).toEqual({ name: "Adana Kebap", description: "Acılı" });
    expect(entry.fields).not.toHaveProperty("price");
    expect(entry.fields).not.toHaveProperty("calories");
  });

  it("kimliksiz ya da metni olmayan kaydı listeye almaz", () => {
    expect(sanitizeEntries([{ id: "", fields: { name: "X" } }])).toHaveLength(0);
    expect(sanitizeEntries([{ id: "product:1", fields: { name: "   " } }])).toHaveLength(0);
    expect(sanitizeEntries([{ id: "product:1", fields: {} }])).toHaveLength(0);
  });

  it("bilinmeyen kind değerini ürün kabul eder", () => {
    const [entry] = sanitizeEntries([{ id: "x", kind: "uydurma", fields: { name: "Test" } }]);
    expect(entry.kind).toBe("product");
  });

  // Kampanya (popup) formu da form içi çeviri butonunu kullanır; kendi bağlam
  // etiketi olmazsa model kampanya metnini ürün adı sanıp kısaltıyordu.
  it("tanınan kind değerlerini olduğu gibi korur", () => {
    for (const kind of ["category", "product", "option", "popup", "business"] as const) {
      const [entry] = sanitizeEntries([{ id: "x", kind, fields: { name: "Test" } }]);
      expect(entry.kind).toBe(kind);
    }
  });

  it("beklenmeyen girdide boş liste döner", () => {
    expect(sanitizeEntries(null)).toHaveLength(0);
    expect(sanitizeEntries("olmaz")).toHaveLength(0);
    expect(sanitizeEntries([null, 3])).toHaveLength(0);
  });
});

describe("resolveTargetLocales", () => {
  it("ana dili hedeften çıkarır — ana metin çevrilip bozulmasın", () => {
    expect(resolveTargetLocales(["tr", "en", "ar"], "tr", ["tr", "en", "ar"])).toEqual(["en", "ar"]);
  });

  it("aktif olmayan dili eler", () => {
    expect(resolveTargetLocales(["en", "ru"], "tr", ["tr", "en"])).toEqual(["en"]);
  });

  it("desteklenmeyen dil kodunu eler", () => {
    expect(resolveTargetLocales(["en", "de", "zz"], "tr", ["tr", "en"])).toEqual(["en"]);
  });

  it("dil seçilmediyse tüm aktif dilleri hedefler", () => {
    expect(resolveTargetLocales(undefined, "tr", ["tr", "en", "ru"])).toEqual(["en", "ru"]);
  });

  it("yinelenen dilleri tekilleştirir", () => {
    expect(resolveTargetLocales(["en", "en", "ar"], "tr", ["tr", "en", "ar"])).toEqual(["en", "ar"]);
  });
});

describe("normalizeTranslationResult", () => {
  const allowed = new Set(["product:1"]);

  it("istenmeyen dili kabul etmez", () => {
    const result = normalizeTranslationResult(
      { items: [{ id: "product:1", translations: { en: { name: "Lentil Soup" }, ru: { name: "Суп" } } }] },
      ["en"],
      allowed
    );
    expect(result.get("product:1")).toEqual({ en: { name: "Lentil Soup" } });
  });

  it("gönderilmemiş kimliği kabul etmez — model uydurursa yazılmaz", () => {
    const result = normalizeTranslationResult(
      { items: [{ id: "product:99", translations: { en: { name: "Hayalet" } } }] },
      ["en"],
      allowed
    );
    expect(result.size).toBe(0);
  });

  it("tanınmayan alanı ve boş çeviriyi eler", () => {
    const result = normalizeTranslationResult(
      {
        items: [
          {
            id: "product:1",
            translations: { en: { name: "Soup", price: 120, description: "   ", uydurma: "x" } },
          },
        ],
      },
      ["en"],
      allowed
    );
    expect(result.get("product:1")).toEqual({ en: { name: "Soup" } });
  });

  it("hiç geçerli alan kalmazsa kaydı sonuca koymaz", () => {
    const result = normalizeTranslationResult(
      { items: [{ id: "product:1", translations: { en: { name: "  " } } }] },
      ["en"],
      allowed
    );
    expect(result.size).toBe(0);
  });

  it("beklenmeyen girdide çökmez", () => {
    expect(normalizeTranslationResult(null, ["en"], allowed).size).toBe(0);
    expect(normalizeTranslationResult({ items: "olmaz" }, ["en"], allowed).size).toBe(0);
    expect(normalizeTranslationResult({ items: [null, 5] }, ["en"], allowed).size).toBe(0);
    expect(normalizeTranslationResult("metin", ["en"], allowed).size).toBe(0);
  });

  // Modelin ara sıra yaptığı biçim sapmaları, içerik doğruyken kullanıcıya
  // "çeviri üretilemedi" diye dönüyordu.
  it("biçim sapmalarını tolere eder: çıplak dizi, kökte tek öğe, büyük harfli anahtar", () => {
    const expected = { en: { name: "Soup", description: "Hot" } };
    expect(
      normalizeTranslationResult([{ id: "product:1", translations: { en: { name: "Soup", description: "Hot" } } }], ["en"], allowed).get("product:1")
    ).toEqual(expected);
    expect(
      normalizeTranslationResult({ id: "product:1", translations: { en: { name: "Soup", description: "Hot" } } }, ["en"], allowed).get("product:1")
    ).toEqual(expected);
    expect(
      normalizeTranslationResult({ items: [{ id: "product:1", translations: { EN: { Name: "Soup", DESCRIPTION: "Hot" } } }] }, ["en"], allowed).get(
        "product:1"
      )
    ).toEqual(expected);
  });

  it("kimlik kuralı gevşemez: kökteki tek öğe de kimliksizse yazılmaz", () => {
    expect(normalizeTranslationResult({ translations: { en: { name: "Soup" } } }, ["en"], allowed).size).toBe(0);
  });
});

describe("missingLocales", () => {
  it("istenip hiç üretilmeyen dilleri söyler", () => {
    const result = normalizeTranslationResult(
      { items: [{ id: "form", translations: { en: { name: "Soup" }, ar: { name: " " } } }] },
      ["en", "ar", "ru"],
      new Set(["form"])
    );
    expect(missingLocales(result, ["en", "ar", "ru"])).toEqual(["ar", "ru"]);
  });

  it("her dil geldiyse boş döner", () => {
    const result = normalizeTranslationResult(
      { items: [{ id: "form", translations: { en: { name: "Soup" }, ru: { name: "Суп" } } }] },
      ["en", "ru"],
      new Set(["form"])
    );
    expect(missingLocales(result, ["en", "ru"])).toEqual([]);
  });
});

// Dil kodu sapmaları: model "en-US" / "EN" / "en_GB" döndürdüğünde çeviri
// sessizce elenip kullanıcıya "üretilemedi" denmemeli.
describe("normalizeLocaleKey", () => {
  it("bölge ve büyük harf farklarını sistem koduna indirger", () => {
    expect(normalizeLocaleKey("en-US")).toBe("en");
    expect(normalizeLocaleKey("en_GB")).toBe("en");
    expect(normalizeLocaleKey(" EN ")).toBe("en");
    expect(normalizeLocaleKey("ar-SA")).toBe("ar");
  });

  it("desteklenmeyen dili tanımaz", () => {
    expect(normalizeLocaleKey("de")).toBeNull();
    expect(normalizeLocaleKey("english")).toBeNull();
  });

  it("çıktıdaki bölgeli dil kodu doğru dile yazılır", () => {
    const result = normalizeTranslationResult(
      { items: [{ id: "form", translations: { "en-US": { name: "Soup" } } }] },
      ["en"],
      new Set(["form"])
    );
    expect(result.get("form")).toEqual({ en: { name: "Soup" } });
  });
});

// "AI ile tamamla" sözleşmesi: yalnızca BOŞ çeviriler üretilir ve yazılır.
// Elle girilmiş ya da onaylanmış bir çeviri, başka bir dilin ya da alanın
// tamamlanması sırasında asla ezilmez.
describe("missingTranslations", () => {
  it("ana dilde metni olup hedefte boş kalan alanları dil dil döndürür", () => {
    const missing = missingTranslations(
      { name: "Çorba", description: "Sıcak" },
      { en: { name: "Soup" }, ru: {} },
      ["en", "ru"]
    );
    expect(missing).toEqual({ en: ["description"], ru: ["name", "description"] });
  });

  it("ana dilde boş olan alan çeviri beklemez", () => {
    expect(missingTranslations({ name: "Çorba", description: "  " }, {}, ["en"])).toEqual({ en: ["name"] });
  });

  it("her şey doluysa boş döner", () => {
    expect(missingTranslations({ name: "Çorba" }, { en: { name: "Soup" } }, ["en"])).toEqual({});
  });

  it("yalnızca boşluktan oluşan çeviri boş sayılır", () => {
    expect(missingTranslations({ name: "Çorba" }, { en: { name: "   " } }, ["en"])).toEqual({ en: ["name"] });
  });
});

describe("fillMissingTranslations", () => {
  it("dolu çevirinin üzerine yazmaz, yalnızca boş alanı doldurur", () => {
    const { merged, applied } = fillMissingTranslations(
      { en: { name: "", description: "Elle yazıldı" } },
      { en: { name: "Soup", description: "AI metni" } }
    );
    expect(merged.en).toEqual({ name: "Soup", description: "Elle yazıldı" });
    expect(applied).toEqual({ en: { name: "Soup" } });
  });

  it("diller birbirini ezmez: bir dilin tamamlanması diğerine dokunmaz", () => {
    const { merged } = fillMissingTranslations(
      { en: { name: "Soup", description: "Manual" }, ru: { name: "Суп" } },
      { ar: { name: "حساء", description: "ساخن" } }
    );
    expect(merged).toEqual({
      en: { name: "Soup", description: "Manual" },
      ru: { name: "Суп" },
      ar: { name: "حساء", description: "ساخن" },
    });
  });

  it("istek sürerken elle doldurulan alan korunur ve özetten çıkar", () => {
    // Tıklama anında boştu; yanıt gelene kadar kullanıcı yazdı.
    const latest = { en: { name: "Kullanıcının yazdığı" } };
    const { merged, applied } = fillMissingTranslations(latest, { en: { name: "AI" } });
    expect(merged.en?.name).toBe("Kullanıcının yazdığı");
    expect(applied).toEqual({});
  });

  it("boş ve desteklenmeyen dil çıktısını yazmaz", () => {
    const { merged, applied } = fillMissingTranslations({}, {
      en: { name: "  " },
      de: { name: "Suppe" },
    } as never);
    expect(merged).toEqual({});
    expect(applied).toEqual({});
  });
});
