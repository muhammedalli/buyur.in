import { NextResponse, type NextRequest } from "next/server";
import type PocketBase from "pocketbase";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { CONTENT_LIMITS } from "@/lib/admin-content";
import { buildImportPlan, type ExistingCategory, type ExistingProduct } from "@/lib/ai/import-plan";
import { normalizeDraft, type DraftCategory, type DraftProduct } from "@/lib/ai/menu-assistant";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { isDeleted } from "@/lib/business-deletion";
import { withRetry } from "@/lib/pb-retry";
import { getServicePB } from "@/lib/pocketbase-server";
import { auditRequestContext } from "@/lib/system-audit";
import type { Business } from "@/lib/types";

// Yönetim panelinden bir işletmenin menüsüne TEK KATEGORİ aktarır (kategori +
// ürünleri). İstemci kategorileri sırayla gönderir; böylece her istek kısa
// sürer ve ilerleme gösterilebilir.
//
// Kurallar panel aktarımıyla aynı (components/panel/ai/menu-import.tsx):
//  - idempotent: menünün mevcut hâli okunur, yalnızca eksikler yazılır
//    (lib/ai/import-plan.ts); yarıda kalan aktarım tekrarlanınca çift kayıt olmaz
//  - sıralı yazım, 503'te tekrar denemeden önce kaydın var olup olmadığına bakılır
//  - fiyatı olmayan ürün yazılmaz (yönetici önizlemede doldurur)
// Yazma yöneticinin KENDİ token'ıyla; hook yönetici yazmalarını kaydetmez, bu
// yüzden aktarım tek bir denetim kaydı (category.import) olarak yazılır. Kayıt
// yazılamazsa bu istekte oluşturulanlar silinir (CLAUDE.md §3.10).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findByName(pb: PocketBase, collection: string, businessId: string, name: string) {
  return pb
    .collection(collection)
    .getFirstListItem<{ id: string }>(pb.filter("business = {:business} && name = {:name}", { business: businessId, name }), {
      fields: "id",
      requestKey: null,
    })
    .catch(() => null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAdminRequest(req, { action: "business.content" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;
  const { id: businessId } = await params;

  let body: { category?: unknown; publish?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  // Taslak kuralları (uzunluk, fiyat sınırı, görsel adresi) sunucuda yeniden uygulanır.
  const [category] = normalizeDraft({ categories: [body.category] }).categories;
  if (!category) return NextResponse.json({ error: "Aktarılacak ürün yok." }, { status: 400 });
  if (category.name.length > CONTENT_LIMITS.categoryName) {
    return NextResponse.json({ error: `Kategori adı en fazla ${CONTENT_LIMITS.categoryName} karakter olabilir.` }, { status: 400 });
  }
  const missing = category.products.filter((product) => product.price === null).length;
  if (missing > 0) {
    return NextResponse.json({ error: `"${category.name}" kategorisinde ${missing} ürünün fiyatı eksik.` }, { status: 400 });
  }
  const publish = body.publish !== false;

  const service = await getServicePB();
  const byBusiness = service.filter("business = {:id}", { id: businessId });
  let business: Pick<Business, "id" | "name" | "deleted_at">;
  let existingCategories: ExistingCategory[];
  let existingProducts: ExistingProduct[];
  try {
    [business, existingCategories, existingProducts] = await Promise.all([
      service.collection(BUSINESS_COLLECTION).getOne<Business>(businessId, { fields: "id,name,deleted_at", requestKey: null }),
      service.collection("buyur_categories").getFullList<ExistingCategory>({ filter: byBusiness, fields: "id,name,order", requestKey: null }),
      service.collection("buyur_products").getFullList<ExistingProduct>({ filter: byBusiness, fields: "category,name,order", requestKey: null }),
    ]);
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return NextResponse.json({ error: "İşletme bulunamadı." }, { status: 404 });
    throw err;
  }
  if (isDeleted(business)) return NextResponse.json({ error: "İşletme silinmiş. Önce silmeyi geri alın." }, { status: 409 });

  const plan = buildImportPlan<DraftProduct, DraftCategory>([category], existingCategories, existingProducts);
  const planned = plan.categories[0];
  if (!planned || planned.newProducts.length === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: planned?.skippedNames.length ?? 0, failed: 0 });
  }

  const createdProducts: string[] = [];
  let createdCategory: string | null = null;
  let categoryId = planned.existingId;
  let failed = 0;
  try {
    if (!categoryId) {
      const record = await withRetry(
        () =>
          pb.collection("buyur_categories").create<{ id: string }>(
            { business: businessId, name: category.name, description: "", order: planned.order, is_active: publish },
            { requestKey: null }
          ),
        { verify: () => findByName(pb, "buyur_categories", businessId, category.name) }
      );
      categoryId = record.id;
      createdCategory = record.id;
    }
  } catch (error) {
    console.error("[admin/import] kategori açılamadı", error);
    return NextResponse.json({ error: `"${category.name}" kategorisi açılamadı. Tekrar deneyin.` }, { status: 502 });
  }

  // Sıralı: toplu create yok (CLAUDE.md §3.7).
  for (const [index, product] of planned.newProducts.entries()) {
    try {
      const record = await withRetry(
        () =>
          pb.collection("buyur_products").create<{ id: string }>(
            {
              business: businessId,
              category: categoryId,
              name: product.name,
              description: product.description,
              price: product.price ?? 0,
              // AI görseli bağlantı olarak kalır (izinli sağlayıcı: normalizeDraft).
              image_url: product.image_url,
              image_source: product.image_url ? product.image_source : null,
              // Ayrıntılar normalizeDraft'ta şemadaki anahtarlara ve sınırlara
              // indirildi; bilinmeyen sayı 0 ("girilmemiş") yazılır.
              allergens: product.allergens,
              badges: product.badges,
              calories: product.calories ?? 0,
              prep_time_min: product.prep_time_min ?? 0,
              prep_time_max: product.prep_time_max ?? 0,
              is_available: publish,
              order: planned.productOrderStart + index,
            },
            { requestKey: null }
          ),
        { verify: () => findByName(pb, "buyur_products", businessId, product.name) }
      );
      createdProducts.push(record.id);
    } catch (error) {
      failed += 1;
      console.error("[admin/import] ürün yazılamadı", product.name, error);
    }
  }

  const context = auditRequestContext(req);
  try {
    await recordAdminAction(pb, {
      admin,
      action: "category.import",
      targetCollection: "buyur_categories",
      targetId: categoryId ?? "",
      businessId,
      before: null,
      after: {
        name: category.name,
        products: createdProducts.length,
        new_category: Boolean(createdCategory),
        published: publish,
        product_names: planned.newProducts.slice(0, 60).map((product) => product.name),
      },
      reason: "Menü aktarımı (yönetim paneli)",
      ip: context.ip,
      meta: { ...context.meta, skipped: planned.skippedNames.length, failed },
    });
  } catch (logError) {
    // Kaydı olmayan toplu yazım kalmaz: bu istekte açılanlar geri alınır.
    console.error("[admin/import] denetim kaydı yazılamadı, aktarım geri alınıyor", logError);
    for (const id of [...createdProducts].reverse()) {
      await pb.collection("buyur_products").delete(id, { requestKey: null }).catch(() => undefined);
    }
    if (createdCategory) await pb.collection("buyur_categories").delete(createdCategory, { requestKey: null }).catch(() => undefined);
    return NextResponse.json({ error: "Denetim kaydı yazılamadığı için aktarım geri alındı. Biraz sonra tekrar deneyin." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: createdProducts.length, skipped: planned.skippedNames.length, failed });
}
