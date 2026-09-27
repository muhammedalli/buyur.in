// Ürün adından görsel arama sorgusu (yalnızca sunucu). Panel görsel ucu
// (/api/ai/images) ve yönetim asistanının toplu görsel araması aynı çeviriyi
// kullanır.

import { isGuardFailure, MENU_MODEL, openaiClient } from "@/lib/ai/guard";

const TRANSLATE_TIMEOUT_MS = 3500;

// Aynı ürün adı tekrar aranınca model çağrılmaz (süreç belleği, sınırlı).
const englishCache = new Map<string, string>();

/** Ürün adının kısa İngilizce yemek arama karşılığı. Çeviri arama kalitesi
 *  içindir, kullanıcıya gösterilmez; model yoksa/düşerse boş döner ve arama
 *  özgün adla sürer. */
export async function toEnglishFoodQuery(name: string): Promise<string> {
  const key = name.toLowerCase();
  const cached = englishCache.get(key);
  if (cached !== undefined) return cached;

  const client = openaiClient();
  if (isGuardFailure(client)) return "";
  try {
    const res = await client.chat.completions.create(
      {
        model: MENU_MODEL,
        temperature: 0,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content:
              "Bir restoran menüsündeki yemek/içecek adını, stok fotoğraf sitelerinde aranacak kısa İngilizce ifadeye çevir (2-4 kelime, yalnızca ifade, tırnak/nokta yok). Örn: 'Tavuk Şiş' -> 'chicken shish kebab'.",
          },
          { role: "user", content: name },
        ],
      },
      { timeout: TRANSLATE_TIMEOUT_MS }
    );
    const text = (res.choices[0]?.message?.content ?? "").trim().replace(/["'.]/g, "").slice(0, 80);
    if (englishCache.size > 500) englishCache.clear();
    englishCache.set(key, text);
    return text;
  } catch {
    return "";
  }
}
