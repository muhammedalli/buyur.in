import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// /api/ai/translate uçtan uca: kimlik ve OpenAI sahtedir, aradaki her şey
// (hedef dil çözümü, prompt, model çıktısının süzülmesi, hata yanıtları)
// gerçektir. Model yanıtları canlıda görülen sapmalardan alındı.

const modelReply = vi.hoisted(() => ({ output_text: "{}", status: "completed" as string, prompt: "" }));

vi.mock("@/lib/ai/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/guard")>();
  return {
    ...actual,
    guardAiRequest: vi.fn(async () => ({
      ok: true,
      business: { id: "biz1", main_language: "tr", languages: ["en", "ar"], plan: "elite" },
      userId: "biz1",
      pb: {},
    })),
    openaiClient: () => ({
      responses: {
        create: async (params: { input: { role: string; content: string }[] }) => {
          modelReply.prompt = params.input[0].content;
          return { output_text: modelReply.output_text, status: modelReply.status, usage: null };
        },
      },
    }),
  };
});

vi.mock("@/lib/system-audit", () => ({ recordAiAction: vi.fn(), aiTokenUsage: () => ({}) }));

const { POST } = await import("@/app/api/ai/translate/route");

function call(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/ai/translate", {
      method: "POST",
      headers: { authorization: "token", "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const popup = { businessId: "biz1", locales: ["en", "ar"], entries: [{ id: "form", kind: "popup", fields: { title: "Hafta sonu", message: "Tatlılar %20 indirimli" } }] };

beforeEach(() => {
  modelReply.status = "completed";
  modelReply.output_text = "{}";
});

describe("/api/ai/translate", () => {
  it("kampanya çevirisinde modele title/message şeması gösterilir", async () => {
    modelReply.output_text = JSON.stringify({
      items: [{ id: "form", translations: { en: { title: "Weekend", message: "Desserts 20% off" }, ar: { title: "عطلة" } } }],
    });
    const res = await call(popup);
    const data = await res.json();

    expect(modelReply.prompt).toContain('"title": "string", "message": "string"');
    expect(res.status).toBe(200);
    expect(data.items[0].translations).toEqual({ en: { title: "Weekend", message: "Desserts 20% off" }, ar: { title: "عطلة" } });
    expect(data.missing).toEqual([]);
  });

  it("dil adıyla ve kimlik sözlüğüyle dönen yanıt da okunur", async () => {
    modelReply.output_text = JSON.stringify({ form: { English: { title: "Weekend" } } });
    const data = await (await call(popup)).json();
    expect(data.items[0].translations).toEqual({ en: { title: "Weekend" } });
    expect(data.missing).toEqual(["ar"]);
  });

  it("gönderilmeyen alana uydurulan çeviri yanıta girmez", async () => {
    modelReply.output_text = JSON.stringify({
      items: [{ id: "form", translations: { en: { name: "Tea", description: "Invented" } } }],
    });
    const data = await (
      await call({ businessId: "biz1", locales: ["en"], entries: [{ id: "form", kind: "product", fields: { name: "Çay" } }] })
    ).json();
    expect(data.items[0].translations).toEqual({ en: { name: "Tea" } });
  });

  it("fiyat modele gönderilmez", async () => {
    modelReply.output_text = JSON.stringify({ items: [{ id: "form", translations: { en: { name: "Tea" } } }] });
    await call({ businessId: "biz1", locales: ["en"], entries: [{ id: "form", kind: "product", fields: { name: "Çay", price: 40 } }] });
    expect(modelReply.prompt).not.toContain("40");
  });

  it("geçersiz JSON yeniden denenebilir hata döner", async () => {
    modelReply.output_text = "not json";
    const res = await call(popup);
    expect(res.status).toBe(502);
    expect((await res.json()).retryable).toBe(true);
  });

  it("hiç çeviri çıkmazsa 422 ve Türkçe mesaj döner", async () => {
    modelReply.output_text = JSON.stringify({ items: [{ id: "baska", translations: { en: { title: "X" } } }] });
    const res = await call(popup);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/çeviri üretemedi/);
  });

  it("ana dil dışında açık dil yoksa 400 döner", async () => {
    const res = await call({ ...popup, locales: ["tr"] });
    expect(res.status).toBe(400);
  });
});
