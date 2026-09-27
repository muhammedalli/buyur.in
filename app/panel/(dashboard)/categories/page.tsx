"use client";

import { useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { AiButton, Button, buttonClass, Card, EmptyState, FooterNote, PageHeader, UpdatedAt } from "@/components/panel/ui";
import { GripIcon } from "@/components/icons";
import { runPooled } from "@/lib/pb-retry";
import type { Category } from "@/lib/types";
import { useUiLocale } from "@/components/ui-locale-provider";

export default function CategoriesPage() {
  const { business, isLoading: businessLoading } = useBusiness();
  const { toast } = useToast();
  const { t } = useUiLocale();
  const [confirm, confirmDialog] = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  // Kategori başına ürün sayısı: listede gösterilir ve silme onayında
  // "kaç ürün etkilenir" bilgisi buradan gelir.
  const [productCounts, setProductCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!business) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  async function load() {
    if (!business) return;
    setLoading(true);
    try {
      // requestKey: null — efekt iki kez çalışınca SDK aynı isteği otomatik
      // iptal edip yakalanmamış hataya çeviriyordu.
      const [list, products] = await Promise.all([
        pb.collection("buyur_categories").getFullList<Category>({
          filter: pb.filter("business = {:id}", { id: business.id }),
          sort: "order,created",
          requestKey: null,
        }),
        pb.collection("buyur_products").getFullList<{ id: string; category: string }>({
          filter: pb.filter("business = {:id}", { id: business.id }),
          fields: "id,category",
          batch: 500,
          requestKey: null,
        }),
      ]);
      const counts = new Map<string, number>();
      for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
      setCategories(list);
      setProductCounts(counts);
    } catch {
      toast(t("Kategoriler yüklenemedi. Sayfayı yenileyip tekrar dene."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(category: Category) {
    const count = productCounts.get(category.id) ?? 0;
    const ok = await confirm({
      title: t("“{name}” kategorisi silinsin mi?", { name: category.name }),
      tone: "danger",
      confirmLabel: count > 0 ? t("Kategoriyi ve {count} ürünü sil", { count }) : t("Kategoriyi sil"),
      description:
        count > 0
          ? t("Ürünleri korumak istiyorsan önce başka bir kategoriye taşı ya da kategoriyi “Menüde göster” anahtarıyla gizle.")
          : undefined,
      details:
        count > 0
          ? [
            t("{count} ürün, varyant ve seçenekleriyle birlikte kalıcı olarak silinir.", { count }),
            t("Menüden hemen kalkar; bu işlem geri alınamaz."),
            t("Geçmiş analiz verileri raporlarda kalır."),
          ]
          : [t("Kategori boş; hiçbir ürün etkilenmez."), t("Bu işlem geri alınamaz.")],
    });
    if (!ok) return;

    try {
      await pb.collection("buyur_categories").delete(category.id);
      await load();
      toast(count > 0 ? t("Kategori ve {count} ürün silindi", { count }) : t("Kategori silindi"));
    } catch {
      toast(t("Kategori silinemedi"), "error");
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (index !== overIndex) setOverIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  async function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      handleDragEnd();
      return;
    }
    const next = [...categories];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setCategories(next);
    handleDragEnd();
    // Sıralama tek seferde onlarca güncelleme demek; hepsini aynı anda göndermek
    // sunucudan 503 döndürüyordu. Kuyruğa alınır, geçici hatalar yeniden denenir.
    const results = await runPooled(next, (c, i) =>
      pb.collection("buyur_categories").update(c.id, { order: i })
    );
    if (results.some((result) => result.error)) {
      toast(t("Sıralama kaydedilemedi, tekrar deneyin."), "error");
      load();
    }
  }

  if (businessLoading || loading) {
    return <p className="text-ink-soft">{t("Yükleniyor…")}</p>;
  }

  // Listedeki en yeni kayıt zamanı — sağ alttaki bilgi satırında gösterilir.
  const latestUpdate = categories.reduce<string | null>((max, item) => (!max || item.updated > max ? item.updated : max), null);

  return (
    <div>
      <PageHeader
        title={t("Kategoriler")}
        description={t("Menünü kategorilere ayır. Sırayı sürükleyerek değiştirebilirsin.")}
        action={
          <div className="flex flex-wrap gap-2" data-guide="categories">
            <Link href="/panel/products/import">
              <AiButton />
            </Link>
            <Link href="/panel/categories/new" className={buttonClass("primary")}>
              {t("+ Yeni kategori")}
            </Link>
          </div>
        }
      />

      {categories.length === 0 && (
        <EmptyState
          title={t("Henüz kategori yok")}
          description={t("İlk kategorini oluşturarak menünü kurmaya başla.")}
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/panel/products/import">
                <AiButton />
              </Link>
              <Link href="/panel/categories/new" className={buttonClass("primary")}>
                {t("+ Yeni kategori")}
              </Link>
            </div>
          }
        />
      )}

      <div className="space-y-3">
        {categories.map((cat, i) => {
          const count = productCounts.get(cat.id) ?? 0;
          return (
            <Card
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between gap-4 transition-colors ${dragIndex === i ? "opacity-40" : ""
                } ${overIndex === i && dragIndex !== null && dragIndex !== i ? "border-paprika" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="cursor-grab text-ink-soft/60 transition-colors hover:text-ink-soft active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <GripIcon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">
                    {cat.name}
                    {!cat.is_active && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t("(gizli)")}</span>
                    )}
                  </p>
                  <p className="text-sm text-ink-soft">
                    <span className={count === 0 ? "text-paprika" : ""}>
                      {count === 0 ? t("Ürün yok · menüde görünmez") : t("{count} ürün", { count })}
                    </span>
                    {cat.description ? ` · ${cat.description}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/panel/category/${cat.id}`} className={buttonClass("outline")}>
                  {t("Düzenle")}
                </Link>
                <Button variant="danger" onClick={() => handleDelete(cat)}>
                  {t("Sil")}
                </Button>
              </div>
            </Card>
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
