"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ErrorText, Input, Label, Modal, Select, Switch, Textarea } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { REASON_MAX, REASON_MIN } from "@/lib/admin-business-actions";
import { CONTENT_LIMITS, type ContentOp, type ContentResource } from "@/lib/admin-content";
import { formatPrice } from "@/lib/format";

// Yönetim panelinden bir işletmenin kategori ve ürünlerini düzenleme ekranı.
// Her işlem gerekçe ister ve denetim kaydına önce/sonra değerleriyle yazılır
// (app/api/admin/businesses/[id]/content). Kapsam bilerek dar; görsel,
// seçenek ve çeviri işletme panelinin işidir (bkz. lib/admin-content.ts).

export interface ContentCategory {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface ContentProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  is_available: boolean;
  discount_percent: number;
  campaign_label: string;
}

interface Target {
  resource: ContentResource;
  op: ContentOp;
  id?: string;
}

interface FormState {
  name: string;
  description: string;
  isActive: boolean;
  price: string;
  category: string;
  isAvailable: boolean;
  discount: string;
  campaignLabel: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  isActive: true,
  price: "",
  category: "",
  isAvailable: true,
  discount: "0",
  campaignLabel: "",
};

const TITLES: Record<ContentResource, Record<ContentOp, string>> = {
  category: { create: "Kategori ekle", update: "Kategoriyi düzenle", delete: "Kategoriyi sil" },
  product: { create: "Ürün ekle", update: "Ürünü düzenle", delete: "Ürünü sil" },
};

export function ContentManager({
  businessId,
  categories,
  products,
  canEdit,
}: {
  businessId: string;
  categories: ContentCategory[];
  products: ContentProduct[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [initial, setInitial] = useState<FormState>(EMPTY);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function open(next: Target, state: FormState) {
    setTarget(next);
    setForm(state);
    setInitial(state);
    setReason("");
    setError("");
  }

  function openCategory(op: ContentOp, category?: ContentCategory) {
    open(
      { resource: "category", op, id: category?.id },
      category ? { ...EMPTY, name: category.name, description: category.description, isActive: category.is_active } : EMPTY
    );
  }

  function openProduct(op: ContentOp, product?: ContentProduct, categoryId?: string) {
    open(
      { resource: "product", op, id: product?.id },
      product
        ? {
            ...EMPTY,
            name: product.name,
            description: product.description,
            price: String(product.price),
            category: product.category,
            isAvailable: product.is_available,
            discount: String(product.discount_percent ?? 0),
            campaignLabel: product.campaign_label ?? "",
          }
        : { ...EMPTY, category: categoryId ?? categories[0]?.id ?? "" }
    );
  }

  /** Yalnızca değişen alanlar gider: kayıtta yalnızca onlar görünür. */
  function changedFields(): Record<string, unknown> {
    if (!target || target.op === "delete") return {};
    const creating = target.op === "create";
    const out: Record<string, unknown> = {};
    const put = (key: string, changed: boolean, value: unknown) => {
      if (creating || changed) out[key] = value;
    };
    put("name", form.name !== initial.name, form.name);
    put("description", form.description !== initial.description, form.description);
    if (target.resource === "category") {
      put("is_active", form.isActive !== initial.isActive, form.isActive);
    } else {
      put("price", form.price !== initial.price, form.price);
      put("category", form.category !== initial.category, form.category);
      put("is_available", form.isAvailable !== initial.isAvailable, form.isAvailable);
      put("discount_percent", form.discount !== initial.discount, form.discount === "" ? 0 : form.discount);
      put("campaign_label", form.campaignLabel !== initial.campaignLabel, form.campaignLabel);
    }
    return out;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: target.op, resource: target.resource, id: target.id, fields: changedFields(), reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "İşlem yapılamadı, tekrar dene.");
        return;
      }
      toast(`${TITLES[target.resource][target.op]}: tamamlandı.`);
      setTarget(null);
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  const productsOf = (categoryId: string) => products.filter((p) => p.category === categoryId);
  const orphans = products.filter((p) => !categories.some((c) => c.id === p.category));

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openCategory("create")}>
            Kategori ekle
          </Button>
          <Button type="button" size="sm" onClick={() => openProduct("create")} disabled={categories.length === 0}>
            Ürün ekle
          </Button>
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState title="Menü boş" description="Bu işletmede henüz kategori yok." />
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const items = productsOf(category.id);
            return (
              <section key={category.id} className="rounded-md border border-line bg-paper">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-ink">
                      {category.name}
                      {!category.is_active && (
                        <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-wider text-ink-soft">gizli</span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-ink-soft">{items.length} ürün</p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openProduct("create", undefined, category.id)}>
                        Ürün ekle
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openCategory("update", category)}>
                        Düzenle
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => openCategory("delete", category)}>
                        Sil
                      </Button>
                    </div>
                  )}
                </header>
                {items.length === 0 ? (
                  <p className="px-5 py-3 text-sm text-ink-soft">Bu kategoride ürün yok.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((product) => (
                      <ProductRow key={product.id} product={product} canEdit={canEdit} onEdit={openProduct} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {orphans.length > 0 && (
            <section className="rounded-md border border-paprika/30 bg-paper">
              <header className="border-b border-line px-5 py-3.5">
                <p className="font-display text-base font-bold text-paprika">Kategorisi olmayan ürünler</p>
              </header>
              <ul className="divide-y divide-line">
                {orphans.map((product) => (
                  <ProductRow key={product.id} product={product} canEdit={canEdit} onEdit={openProduct} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Modal
        open={target !== null}
        title={target ? TITLES[target.resource][target.op] : ""}
        onClose={() => !loading && setTarget(null)}
        dismissable={!loading}
      >
        {target && (
          <form onSubmit={submit} className="space-y-4">
            {target.op === "delete" ? (
              <p className="rounded-md border border-paprika/30 bg-paprika/10 px-3.5 py-2.5 text-sm text-paprika">
                “{form.name}” menüden kalıcı olarak silinir
                {target.resource === "product" ? " (seçenekleriyle birlikte)" : ""}. Silinmeden önceki hâli denetim kaydında kalır.
              </p>
            ) : (
              <>
                <p className="rounded-md border border-line bg-crema/50 px-3.5 py-2.5 text-sm text-ink-soft">
                  Değişiklik işletmenin canlı menüsünde hemen görünür. Çeviriler değişmez; işletme panelinden güncellenir.
                </p>
                <div>
                  <Label htmlFor="content-name">Ad</Label>
                  <Input
                    id="content-name"
                    required
                    maxLength={target.resource === "category" ? CONTENT_LIMITS.categoryName : CONTENT_LIMITS.productName}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="content-description">Açıklama</Label>
                  <Textarea
                    id="content-description"
                    rows={2}
                    maxLength={target.resource === "category" ? CONTENT_LIMITS.categoryDescription : CONTENT_LIMITS.productDescription}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                {target.resource === "category" ? (
                  <Switch
                    checked={form.isActive}
                    onChange={(checked) => setForm({ ...form, isActive: checked })}
                    label="Menüde görünsün"
                  />
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="content-price">Fiyat (₺)</Label>
                        <Input
                          id="content-price"
                          inputMode="decimal"
                          required
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="content-category">Kategori</Label>
                        <Select id="content-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="content-discount">İndirim (%)</Label>
                        <Input
                          id="content-discount"
                          type="number"
                          min={0}
                          max={100}
                          value={form.discount}
                          onChange={(e) => setForm({ ...form, discount: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="content-campaign">Kampanya etiketi</Label>
                        <Input
                          id="content-campaign"
                          maxLength={CONTENT_LIMITS.campaignLabel}
                          value={form.campaignLabel}
                          onChange={(e) => setForm({ ...form, campaignLabel: e.target.value })}
                        />
                      </div>
                    </div>
                    <Switch
                      checked={form.isAvailable}
                      onChange={(checked) => setForm({ ...form, isAvailable: checked })}
                      label="Satışta"
                      description="Kapalıyken ürün menüde tükendi olarak görünür."
                    />
                  </>
                )}
              </>
            )}
            <div>
              <Label htmlFor="content-reason">Gerekçe (denetim kaydına yazılır)</Label>
              <Textarea
                id="content-reason"
                rows={2}
                required
                minLength={REASON_MIN}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ör. İşletme telefonda fiyat düzeltmesi istedi."
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setTarget(null)} disabled={loading}>
                Vazgeç
              </Button>
              <Button type="submit" variant={target.op === "delete" ? "danger" : "primary"} loading={loading}>
                {target.op === "delete" ? "Sil" : "Kaydet"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function ProductRow({
  product,
  canEdit,
  onEdit,
}: {
  product: ContentProduct;
  canEdit: boolean;
  onEdit: (op: ContentOp, product?: ContentProduct) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
        <p className="flex flex-wrap gap-x-2 font-mono text-[11px] text-ink-soft">
          <span className="text-ink">{formatPrice(product.price)}</span>
          {product.discount_percent > 0 && <span className="text-paprika">%{product.discount_percent} indirim</span>}
          {product.campaign_label && <span>{product.campaign_label}</span>}
          {!product.is_available && <span>satışta değil</span>}
        </p>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit("update", product)}>
            Düzenle
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={() => onEdit("delete", product)}>
            Sil
          </Button>
        </div>
      )}
    </li>
  );
}
