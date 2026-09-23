"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { useMenu } from "@/components/menu/menu-provider";
import { trackEvent } from "@/lib/analytics/track-client";
import { ProductCard } from "@/components/menu/product-card";
import type { Locale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

const LOCALE_TAG: Record<Locale, string> = { tr: "tr-TR", en: "en-US", ar: "ar-SA", ru: "ru-RU" };

export default function SearchPage() {
  const router = useRouter();
  const { business, base, addProduct, locale, t, tf } = useMenu();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    pb.collection("buyur_products")
      .getFullList<Product>({
        filter: pb.filter("business = {:id} && is_available = true", { id: business.id }),
        requestKey: null,
        sort: "order,created",
      })
      .then((prods) => {
        if (cancelled) return;
        setProducts(prods);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  const results = useMemo(() => {
    const tag = LOCALE_TAG[locale];
    const q = query.trim().toLocaleLowerCase(tag);
    if (!q) return [];
    return products.filter((p) => {
      const name = tf(p, "name").toLocaleLowerCase(tag);
      const description = tf(p, "description").toLocaleLowerCase(tag);
      return name.includes(q) || description.includes(q);
    });
  }, [products, query, locale, tf]);

  // Arama analitiği: her tuş vuruşu değil, kullanıcı yazmayı bıraktıktan sonra
  // tek event. Sonuçsuz aramalar (results = 0) eksik ürün talebini gösterdiği
  // için ayrıca meta'da işaretleniyor.
  useEffect(() => {
    const term = query.trim();
    if (loading || term.length < 2) return;

    const timer = setTimeout(() => {
      trackEvent(business.slug, {
        type: "search",
        target: term.slice(0, 60).toLocaleLowerCase(LOCALE_TAG[locale]),
        label: term.slice(0, 60),
        locale,
        meta: { results: results.length, no_result: results.length === 0 },
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [query, results.length, loading, locale, business.slug]);

  return (
    <div className="px-4 pb-6 pt-5">
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="w-full rounded-2xl border border-line/60 bg-crema/40 px-5 py-3.5 text-base text-ink outline-none shadow-xs transition-colors focus:border-[var(--brand)] focus:bg-crema/60"
      />

      <div className="mt-5">
        {loading ? (
          <p className="py-12 text-center text-ink-soft">{t("loading")}</p>
        ) : query.trim() === "" ? (
          <p className="py-12 text-center text-sm text-ink-soft">{t("searchHint")}</p>
        ) : results.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-soft">{t("noSearchResults", { query })}</p>
        ) : (
          <div className="space-y-3">
            {results.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                template="liste"
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
