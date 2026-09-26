import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/admin/button-link";
import { ContentManager, type ContentCategory, type ContentProduct } from "@/components/admin/content-manager";
import { PageHeader } from "@/components/panel/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { canPerform } from "@/lib/admin-roles";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { isDeleted } from "@/lib/business-deletion";
import { getServicePB } from "@/lib/pocketbase-server";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

// Bir işletmenin menü içeriği. Destek görür, düzenlemeyi super_admin yapar
// (business.content). Okuma servis hesabıyla tek turda paralel; yazma
// yöneticinin kendi yetkisiyle API ucunda.

export default async function AdminBusinessMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ admin }, { id }] = await Promise.all([requireAdmin({ action: "business.view" }), params]);
  const service = await getServicePB();
  const byBusiness = service.filter("business = {:id}", { id });

  let business: Pick<Business, "id" | "name" | "slug" | "deleted_at">;
  try {
    business = await service.collection(BUSINESS_COLLECTION).getOne(id, { fields: "id,name,slug,deleted_at", requestKey: null });
  } catch (err) {
    if ((err as { status?: number })?.status === 404) notFound();
    throw err;
  }
  const [categories, products] = await Promise.all([
    service.collection("buyur_categories").getFullList<ContentCategory>({
      filter: byBusiness,
      sort: "order,created",
      fields: "id,name,description,is_active",
      requestKey: null,
    }),
    service.collection("buyur_products").getFullList<ContentProduct>({
      filter: byBusiness,
      sort: "order,created",
      fields: "id,name,description,category,price,is_available,discount_percent,campaign_label",
      batch: 1000,
      requestKey: null,
    }),
  ]);

  const deleted = isDeleted(business);
  const canEdit = canPerform(admin.role, "business.content") && !deleted;

  return (
    <>
      <PageHeader
        title={`${business.name || "Adsız hesap"} · Menü`}
        description={`${categories.length} kategori · ${products.length} ürün${canEdit ? "" : " · salt okunur"}`}
        action={
          <>
            <ButtonLink href={`/admin/businesses/${id}`} variant="ghost" size="sm">
              İşletmeye dön
            </ButtonLink>
            <ButtonLink href={`/admin/logs?isletme=${id}&kaynak=buyur_products`} size="sm">
              Ürün geçmişi
            </ButtonLink>
          </>
        }
      />
      {deleted && (
        <p role="status" className="mb-6 rounded-md border border-ink/30 bg-ink/10 px-4 py-3 text-sm text-ink">
          İşletme silinmiş; içerik düzenlenemez. Önce silmeyi geri alın.
        </p>
      )}
      <ContentManager businessId={id} categories={categories} products={products} canEdit={canEdit} />
    </>
  );
}
