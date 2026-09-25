"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { ProductForm } from "@/components/panel/product-form";
import { buttonClass, EmptyState, PageHeader } from "@/components/panel/ui";
import type { Category } from "@/lib/types";

export default function NewProductPage() {
  const { business, isLoading } = useBusiness();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    if (!business) return;
    pb.collection("buyur_categories")
      .getFullList<Category>({ filter: pb.filter("business = {:id}", { id: business.id }), sort: "order,created" })
      .then((list) => {
        setCategories(list);
        setLoadingCats(false);
      });
  }, [business]);

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
