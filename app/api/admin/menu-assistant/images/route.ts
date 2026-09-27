import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { toStoredImage } from "@/lib/ai/image-source";
import { toEnglishFoodQuery } from "@/lib/ai/image-query";
import { buildImageQuery, configuredProviders, pickAutoImage, searchProductImages } from "@/lib/ai/images";

// Menü asistanının toplu görsel araması: taslaktaki tek bir ürün için en
// uygun, künye gerektirmeyen görseli döndürür. Kayda yazmaz; görsel ürünle
// birlikte aktarımda yazılır. Panel ucuyla (/api/ai/images) aynı arama ve
// seçim kuralları; fark yalnızca kimliktir (işletme değil yönetici).
// Ürün başına ayrı denetim kaydı yazılmaz: arama kayıt değiştirmez, sonucu
// aktarımın kaydında (category.import) görünür.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 150;

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req, { action: "business.content" });
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_QUERY_LENGTH) : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, MAX_QUERY_LENGTH) : "";
  if (!name) return NextResponse.json({ error: "Arama için ürün adı gerekli." }, { status: 400 });

  if (configuredProviders().length === 0) return NextResponse.json({ image: null, configured: false });
  try {
    const images = await searchProductImages(name, category, 8, await toEnglishFoodQuery(name));
    const best = pickAutoImage(images, buildImageQuery(name, category));
    return NextResponse.json({ image: best ? toStoredImage(best) : null, configured: true });
  } catch (error) {
    console.error("[admin/menu-assistant/images] hata", error);
    return NextResponse.json({ image: null, configured: true });
  }
}
