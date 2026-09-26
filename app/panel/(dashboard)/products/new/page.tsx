"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { ProductForm } from "@/components/panel/product-form";
import { buttonClass, EmptyState, PageHeader } from "@/components/panel/ui";
import type { Category } from "@/lib/types";

export default function NewProductPage() {
  const { business, isLoading } = useBusiness();
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const businessId = business?.id;

  // İşletme kimliğine bağlı: kayıt tazelenince (sekmeye dönüş) liste yeniden
  // okunmaz. requestKey: null — StrictMode'un çift çalıştırması isteği SDK'ya
  // iptal ettirip yakalanmamış hata üretmesin; okunamazsa sayfa "yükleniyor"da
  // asılı kalmaz.
  useEffect(() => {
    if (!businessId) return;
    pb.collection("buyur_categories")
      .getFullList<Category>({ filter: pb.filter("business = {:id}", { id: businessId }), sort: "order,created", requestKey: null })
      .then(setCategories)
      .catch(() => toast("Kategoriler yüklenemedi, sayfayı yenileyin.", "error"))
      .finally(() => setLoadingCats(false));
  }, [businessId, toast]);

  if (isLoading || loadingCats || !business) {
    return <p className="text-ink-soft">Yükleniyor…</p>;
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        title="Önce bir kategori oluştur"
        description="Ürün eklemeden önce en az bir kategori gerekiyor."
        action={
          <Link href="/panel/categories" className={buttonClass("primary")}>
            Kategori oluştur
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader title="Yeni ürün" />
      <ProductForm
        business={business}
        categories={categories}
        onSaved={(product) => router.replace(`/panel/product/${product.id}`)}
        onCancel={() => router.back()}
      />
    </div>
  );
}
