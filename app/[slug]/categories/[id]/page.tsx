"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMenu } from "@/components/menu/menu-provider";
import { CategoryTabs } from "@/components/menu/category-tabs";
import { ProductCard } from "@/components/menu/product-card";

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { business, base, categories, products, categoriesLoading, addProduct, track, t, tf } = useMenu();
  const lastTracked = useRef<string | null>(null);

  const current = categories.find((c) => c.id === id);
  const categoryProducts = products.filter((p) => p.category === id);

  useEffect(() => {
    if (!current || lastTracked.current === current.id) return;
    lastTracked.current = current.id;
    track({ type: "category_view", target: current.id, label: current.name, categoryId: current.id });
  }, [current, track]);

  return (
    <div className="pb-6">
      <CategoryTabs activeId={id} />

      {/* Kategori başlığı */}
      {current && (
        <div className="px-4 pt-5 pb-1">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              {tf(current, "name")}
            </h1>
            <span className="font-display text-xs font-medium text-ink-soft">
              {t("productCount", { count: categoryProducts.length })}
            </span>
          </div>
          {tf(current, "description") && (
            <p className="mt-1 text-xs sm:text-sm leading-relaxed text-ink-soft">{tf(current, "description")}</p>
          )}
        </div>
      )}

      {/* Ürünler */}
      <div className="px-4 pt-4">
        {categoriesLoading ? (
          <p className="py-16 text-center text-ink-soft">{t("loading")}</p>
        ) : categoryProducts.length === 0 ? (
          <p className="py-16 text-center text-ink-soft">{t("noProductsInCategory")}</p>
        ) : (
          <div className={business.template === "grid" ? "grid grid-cols-2 gap-3.5" : "space-y-3"}>
            {categoryProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                template={business.template}
                onAdd={addProduct}
                onOpen={() => router.push(`${base}/products/${product.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
