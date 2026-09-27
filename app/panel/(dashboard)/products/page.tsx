"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { AiButton, Button, buttonClass, Card, EmptyState, FooterNote, PageHeader, UpdatedAt } from "@/components/panel/ui";
import type { Category, Product } from "@/lib/types";
import { useUiLocale } from "@/components/ui-locale-provider";

export default function ProductsPage() {
  const { business, isLoading: businessLoading } = useBusiness();
  const { toast } = useToast();
  const { t } = useUiLocale();
  const [confirm, confirmDialog] = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  async function load() {
    if (!business) return;
    setLoading(true);
    try {
      // requestKey: null — efekt iki kez çalışınca (StrictMode, işletme tazelenmesi)
      // SDK aynı isteği otomatik iptal edip yakalanmamış hataya çeviriyordu.
      const [cats, prods] = await Promise.all([
        pb.collection("buyur_categories").getFullList<Category>({
          filter: pb.filter("business = {:id}", { id: business.id }),
          sort: "order,created",
          requestKey: null,
        }),
        pb.collection("buyur_products").getFullList<Product>({
          filter: pb.filter("business = {:id}", { id: business.id }),
          sort: "order,created",
          requestKey: null,
        }),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch {
      toast(t("Ürünler yüklenemedi. Sayfayı yenileyip tekrar dene."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailable(product: Product) {
    const next = !product.is_available;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_available: next } : p)));
    await pb.collection("buyur_products").update(product.id, { is_available: next });
    toast(next ? t("Ürün satışa açıldı") : t("Ürün satıştan kaldırıldı"));
  }

  async function handleDelete(product: Product) {
    // Silinecek bağımlılıklar: ürünün varyant/seçenekleri (cascade).
    let optionCount = 0;
    try {
      const options = await pb.collection("buyur_product_options").getList(1, 1, {
        filter: pb.filter("product = {:id}", { id: product.id }),
        fields: "id",
        requestKey: null,
      });
      optionCount = options.totalItems;
    } catch {
      /* sayı alınamazsa onay genel metinle devam eder */
    }

    const ok = await confirm({
      title: t("“{name}” silinsin mi?", { name: product.name }),
      tone: "danger",
      confirmLabel: t("Ürünü sil"),
      description: product.is_available
        ? t("Geçici olarak kaldırmak istiyorsan silmek yerine “Satışta” anahtarını kapat; ürün menüden kalkar ama bilgileri durur.")
        : undefined,
      details: [
        t("Menüden hemen kalkar; bu işlem geri alınamaz."),
        ...(optionCount > 0 ? [t("{count} varyant/seçenek de silinir.", { count: optionCount })] : []),
        t("Müşterilerin sepetindeki bu ürün bir sonraki açılışta görünmez."),
        t("Geçmiş analiz verileri raporlarda kalır."),
      ],
    });
    if (!ok) return;

    try {
      await pb.collection("buyur_products").delete(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast(t("Ürün silindi"));
    } catch {
      toast(t("Ürün silinemedi"), "error");
    }
  }

  if (businessLoading || loading) {
    return <p className="text-ink-soft">{t("Yükleniyor…")}</p>;
  }

  if (categories.length === 0) {
    return (
      <div>
        <PageHeader title={t("Ürünler")} />
        <EmptyState
          title={t("Önce bir kategori oluştur")}
          description={t("Ürün eklemeden önce en az bir kategori gerekiyor.")}
          action={
            <div className="flex flex-wrap gap-2" data-guide="products">
              <Link href="/panel/products/import">
                <AiButton />
              </Link>
              <Link href="/panel/categories" className={buttonClass("primary")}>
                {t("Kategori oluştur")}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  // Listedeki en yeni kayıt zamanı — sağ alttaki bilgi satırında gösterilir.
  const latestUpdate = products.reduce<string | null>((max, item) => (!max || item.updated > max ? item.updated : max), null);

  return (
    <div>
      <PageHeader
        title={t("Ürünler")}
        description={t("Fiyat, görsel, rozet ve daha fazlasını yönet.")}
        action={
          <div className="flex flex-wrap gap-2" data-guide="products">
            <Link href="/panel/products/import">
              <AiButton />
            </Link>
            <Link href="/panel/products/new" className={buttonClass("primary")}>
              {t("+ Yeni ürün")}
            </Link>
          </div>
        }
      />

      {products.length === 0 && (
        <EmptyState
          title={t("Henüz ürün yok")}
          description={t("İlk ürününü ekleyerek menünü canlandır.")}
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/panel/products/import">
                <AiButton />
              </Link>
              <Link href="/panel/products/new" className={buttonClass("primary")}>
                {t("+ Yeni ürün")}
              </Link>
            </div>
          }
        />
      )}

      <div className="space-y-10">
        {categories.map((cat) => {
          const items = products.filter((p) => p.category === cat.id);
          if (items.length === 0) return null;
          return (
            <div key={cat.id}>
              <h2 className="mb-3 font-mono text-[13px] uppercase tracking-wider text-ink-soft">{cat.name}</h2>
              <div className="space-y-3">
                {items.map((product) => (
                  <Card key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-crema">
                      {product.images?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-bold">{product.name}</p>
                      <p className="font-mono text-sm text-ink-soft">
                        {product.price}₺
                        {product.discount_percent > 0 && (
                          <span className="ml-2 text-herb">{t("%{percent} indirim", { percent: product.discount_percent })}</span>
                        )}
                      </p>
                    </div>
                    {/* Mobilde ikinci satıra iner; masaüstünde satırın sağında durur. */}
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-4">
                      <label className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
                        <input type="checkbox" checked={product.is_available} onChange={() => toggleAvailable(product)} />
                        {t("Satışta")}
                      </label>
                      <div className="flex shrink-0 gap-2">
                        <Link href={`/panel/product/${product.id}`} className={buttonClass("outline")}>
                          {t("Düzenle")}
                        </Link>
                        <Button variant="danger" onClick={() => handleDelete(product)}>
                          {t("Sil")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <FooterNote>
        <UpdatedAt at={latestUpdate} />
      </FooterNote>

      {confirmDialog}
    </div>
  );
}
