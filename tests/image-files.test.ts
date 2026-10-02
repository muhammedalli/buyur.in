import { describe, expect, it } from "vitest";
import { IMAGE_FIELDS, IMAGE_MAX_SIZE, IMAGE_THUMBS, imageField, imageFileName, productImageLabel, sniffImageType } from "@/scripts/image-schema.mjs";
import { businessLogoUrl, categoryImageUrl, hasProductImage, pbFileUrl, productImageUrl } from "@/lib/files";
import { PB_URL } from "@/lib/pocketbase";
import { imagePatch, imagePreviewUrl, imageValueOf, restoreImageValue, stageImageFile } from "@/lib/image-value";
import { fitWithin, IMAGE_PRESETS, IMAGE_SOURCE_MAX_SIZE, mayHaveAlpha, preferOriginal } from "@/lib/image-resize";

// Elle yüklenen görsel PocketBase dosya alanında (MinIO), AI'ın bulduğu ürün
// görseli bağlantı olarak durur (scripts/image-schema.mjs). Bu dosya; şema ↔
// adres yardımcısı uyumunu, küçültme kurallarını ve panel formundaki görsel
// değerinin anlamlarını kilitler.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

describe("görsel alanları şeması", () => {
  it("her görsel alanı tek dosyalık, 5MB sınırlı, herkese açık bir dosya alanıdır", () => {
    for (const spec of IMAGE_FIELDS) {
      const field = imageField(spec.field, spec.thumbs);
      expect(field).toMatchObject({ type: "file", maxSelect: 1, maxSize: IMAGE_MAX_SIZE, protected: false });
      expect(field.mimeTypes).toEqual(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
    }
  });

  it("adres yardımcısının istediği küçük boylar alanda tanımlıdır (yoksa özgün dosya iner)", () => {
    const thumbsOf = (collection: string, field: string) =>
      IMAGE_FIELDS.find((spec) => spec.collection === collection && spec.field === field)?.thumbs ?? [];
    expect(thumbsOf("buyur_businesses", "logo")).toContain(IMAGE_THUMBS.logo);
    expect(thumbsOf("buyur_products", "image")).toContain(IMAGE_THUMBS.card);
    expect(thumbsOf("buyur_categories", "image")).toContain(IMAGE_THUMBS.card);
  });
});

describe("görsel adresi", () => {
  it("PocketBase dosya ucunu kurar; dosya yoksa boş döner", () => {
    expect(pbFileUrl("buyur_products", "abc", "kofte_x1.jpg")).toBe(`${PB_URL}/api/files/buyur_products/abc/kofte_x1.jpg`);
    expect(productImageUrl({ id: "abc", image: "", image_url: "" })).toBe("");
    expect(productImageUrl({ id: "abc", image: "k.jpg" }, "card")).toBe(`${PB_URL}/api/files/buyur_products/abc/k.jpg?thumb=${IMAGE_THUMBS.card}`);
    expect(categoryImageUrl({ id: "c1", image: "c.png" })).toContain(`?thumb=${IMAGE_THUMBS.card}`);
    expect(businessLogoUrl({ id: "b1", logo: "l.png" }, "small")).toBe(`${PB_URL}/api/files/buyur_businesses/b1/l.png?thumb=${IMAGE_THUMBS.logo}`);
  });
});

describe("dosya türü ve adı", () => {
  it("türü başlıktan değil baytlardan okur", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("<html><body>nope</body></html>"))).toBeNull();
  });

  it("okunaklı dosya adı üretir, Türkçe karakterleri sadeleştirir", () => {
    expect(imageFileName("Izgara Köfte & Pilav", "image/jpeg")).toBe("izgara-kofte-pilav.jpg");
    expect(imageFileName("Çiğ Börek", "image/webp")).toBe("cig-borek.webp");
    expect(imageFileName("***", "image/png", "logo")).toBe("logo.png");
    // Ürün görseli kategori + ürün adından adlandırılır (adres biçimi PocketBase'in).
    expect(imageFileName(productImageLabel("Ana Yemekler", "Izgara Köfte"), "image/webp")).toBe("ana-yemekler-izgara-kofte.webp");
    expect(productImageLabel("", "Ayran")).toBe("Ayran");
  });
});

describe("küçültme", () => {
  it("en uzun kenarı sınıra indirir, oranı korur, küçük görseli büyütmez", () => {
    expect(fitWithin(4032, 3024, IMAGE_PRESETS.product.maxEdge)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3024, 4032, IMAGE_PRESETS.product.maxEdge)).toEqual({ width: 900, height: 1200 });
    expect(fitWithin(400, 300, IMAGE_PRESETS.product.maxEdge)).toEqual({ width: 400, height: 300 });
  });

  it("amaca göre boy: logo küçük, kapak geniş", () => {
    expect(IMAGE_PRESETS.logo.maxEdge).toBeLessThan(IMAGE_PRESETS.product.maxEdge);
    expect(IMAGE_PRESETS.cover.maxEdge).toBeGreaterThan(IMAGE_PRESETS.product.maxEdge);
  });

  it("küçültülmüş dosya büyük çıkarsa sınırlar içindeki özgün dosya kalır", () => {
    expect(preferOriginal({ size: 80_000, width: 800, height: 600 }, 120_000, 1200)).toBe(true);
    expect(preferOriginal({ size: 80_000, width: 4000, height: 3000 }, 120_000, 1200)).toBe(false);
    expect(preferOriginal({ size: 900_000, width: 800, height: 600 }, 120_000, 1200)).toBe(false);
  });

  it("saydamlık taşıyabilen kaynak JPEG'e çevrilmez", () => {
    expect(mayHaveAlpha("image/png")).toBe(true);
    expect(mayHaveAlpha("image/jpeg")).toBe(false);
  });
});

describe("ürün görseli: yüklenen dosya ya da AI bağlantısı", () => {
  it("dosya varsa dosya, yoksa AI bağlantısı; küçük boy yalnızca dosyada", () => {
    const ai = "https://images.pexels.com/photos/1/a.jpeg?w=940";
    expect(productImageUrl({ id: "p", image: "", image_url: ai }, "card")).toBe(ai);
    expect(productImageUrl({ id: "p", image: "k.webp", image_url: "" }, "card")).toContain("?thumb=");
    expect(hasProductImage({ image: "", image_url: ai })).toBe(true);
    expect(hasProductImage({ image: "", image_url: "" })).toBe(false);
    expect(imageValueOf("k.webp", "")).toBe("k.webp");
    expect(imageValueOf("", ai)).toBe(ai);
  });
});

describe("panel formunda görsel değeri", () => {
  it("değişmeyen görsel gönderilmez; kaldırılan görsel boşaltılır (PocketBase dosyayı depodan siler)", () => {
    expect(imagePatch("kofte_x1.webp", "Köfte", "image", "image_url")).toEqual({});
    expect(imagePatch("", "Köfte", "image", "image_url")).toEqual({ image: "", image_url: "" });
    expect(imagePatch("", "Logo", "logo")).toEqual({ logo: "" });
  });

  it("AI görseli indirilmez, bağlantı olarak yazılır; varsa yüklenmiş dosya kalkar", () => {
    const ai = "https://images.pexels.com/photos/1/a.jpeg";
    expect(imagePatch(ai, "Köfte", "image", "image_url")).toEqual({ image: "", image_url: ai });
    // Bağlantı alanı olmayan görselde (logo, kategori…) dış adres yazılmaz.
    expect(imagePatch(ai, "Logo", "logo")).toEqual({});
  });

  it("seçilen dosya kaydet'e kadar bekler, ürün adıyla adlandırılır, bağlantıyı temizler", async () => {
    const staged = await stageImageFile(new File([JPEG], "IMG_0001.JPG", { type: "image/jpeg" }), "product");
    expect("value" in staged).toBe(true);
    if (!("value" in staged)) return;
    const patch = imagePatch(staged.value, "Izgara Köfte", "image", "image_url");
    expect(patch.image).toBeInstanceOf(File);
    expect((patch.image as File).name).toBe("izgara-kofte.jpg");
    expect(patch.image_url).toBe("");
    expect(imagePreviewUrl(staged.value, () => "kayitli")).toBe(staged.value);
  });

  it("izinsiz tür ve küçültmeye giremeyecek kadar büyük dosya forma alınmaz", async () => {
    expect("error" in (await stageImageFile(new File(["x"], "a.svg", { type: "image/svg+xml" }), "product"))).toBe(true);
    expect("error" in (await stageImageFile(new File([new Uint8Array(IMAGE_SOURCE_MAX_SIZE + 1)], "a.jpg", { type: "image/jpeg" }), "product"))).toBe(true);
  });

  it("önceki oturumdan kalan taslaktaki ölü dosya kayıtlı görseli silmez", () => {
    const dead = "blob:http://localhost/olu";
    expect(restoreImageValue(dead, "kayitli.jpg")).toBe("kayitli.jpg");
    expect(imagePatch(dead, "x", "image", "image_url")).toEqual({});
    expect(imagePreviewUrl(dead, () => "kayitli")).toBe("");
  });
});
