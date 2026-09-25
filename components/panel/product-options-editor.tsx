"use client";

import { useEffect, useState, type FormEvent } from "react";
import { pb } from "@/lib/pocketbase";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { Button, Card, Input, Label } from "@/components/panel/ui";
import { MultiLangFields } from "@/components/panel/multi-lang-fields";
import { activeLocales, mainLocale, tField, type TranslatableField, type Translations } from "@/lib/i18n";
import type { Business, ProductOption } from "@/lib/types";

const emptyForm = { groupName: "", name: "", priceDelta: "", translations: {} as Translations };

export function ProductOptionsEditor({ business, productId }: { business: Business; productId: string }) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();

  const main = mainLocale(business);

  useEffect(() => {
    load();
  }, [productId]);

  // requestKey: null — tekrarlanan istek SDK tarafından iptal edilip yakalanmamış
  // hataya dönmesin; hata olursa editör "yükleniyor"da asılı kalmasın.
  async function load() {
    setLoading(true);
    try {
      const list = await pb.collection("buyur_product_options").getFullList<ProductOption>({
        filter: pb.filter("product = {:id}", { id: productId }),
        sort: "order,created",
        requestKey: null,
      });
      setOptions(list);
    } catch {
      toast("Seçenekler yüklenemedi, sayfayı yenile.", "error");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(option: ProductOption) {
    setEditingId(option.id);
    setForm({
      groupName: option.group_name,
      name: option.name,
      priceDelta: option.price_delta.toString(),
      translations: option.translations ?? {},
    });
  }

  function startAdd() {
    setEditingId("new");
    setForm(emptyForm);
  }

  function setBaseField(field: TranslatableField, value: string) {
    if (field === "group_name") setForm((f) => ({ ...f, groupName: value }));
    else if (field === "name") setForm((f) => ({ ...f, name: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        group_name: form.groupName,
        name: form.name,
        price_delta: Number(form.priceDelta) || 0,
        translations: form.translations,
      };
      const editing = editingId && editingId !== "new";
      if (editing) {
        await pb.collection("buyur_product_options").update(editingId, payload);
      } else {
        await pb.collection("buyur_product_options").create({ ...payload, product: productId, order: options.length });
      }
      setEditingId(null);
      setForm(emptyForm);
      await load();
      toast(editing ? "Seçenek güncellendi" : "Seçenek eklendi");
    } catch {
      toast("Seçenek kaydedilemedi, tekrar dene.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(option: ProductOption) {
    const ok = await confirm({
      title: "Seçenek silinsin mi?",
      description: `“${option.group_name}: ${option.name}” menüden kaldırılır.`,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await pb.collection("buyur_product_options").delete(option.id, { requestKey: null });
      setOptions((list) => list.filter((item) => item.id !== option.id));
      toast("Seçenek silindi");
    } catch {
      toast("Seçenek silinemedi, tekrar dene.", "error");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Seçenekler / Varyantlar</p>
          <p className="mt-1 text-xs text-ink-soft">Boy, ekstra malzeme gibi fiyat farkı yaratan opsiyonlar.</p>
        </div>
        {editingId === null && (
          <Button type="button" variant="outline" onClick={startAdd}>
            + Ekle
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-ink-soft">Yükleniyor…</p>}

      {!loading && options.length === 0 && editingId === null && (
        <p className="text-sm text-ink-soft">Henüz seçenek eklenmedi. Örn: &quot;Boy&quot; grubunda &quot;Büyük +25₺&quot;.</p>
      )}

      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt.id} className="flex items-center justify-between rounded-2xl border border-line px-4 py-2.5 text-sm">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                {tField(opt, "group_name", main, main)}
              </span>
              <p className="font-medium">
                {tField(opt, "name", main, main)}{" "}
                <span className="text-ink-soft">
                  {opt.price_delta >= 0 ? "+" : ""}
                  {opt.price_delta}₺
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => startEdit(opt)} className="text-xs text-ink-soft hover:text-paprika">
                Düzenle
              </button>
              <button type="button" onClick={() => handleDelete(opt)} className="text-xs text-ink-soft hover:text-paprika">
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-crema/30 p-4">
          {/* Grup ve seçenek adı dil bazlı — ana dil baz alan, diğerleri çeviri */}
          <MultiLangFields
            locales={activeLocales(business)}
            mainLocale={main}
            base={{ group_name: form.groupName, name: form.name }}
            onBaseChange={setBaseField}
            translations={form.translations}
            onTranslationsChange={(next) => setForm((f) => ({ ...f, translations: next }))}
            fields={[
              { key: "group_name", label: "Grup", required: true, placeholder: "Boy" },
              { key: "name", label: "Seçenek", required: true, placeholder: "Büyük" },
            ]}
          />
          <div className="sm:max-w-[12rem]">
            <Label htmlFor="opt-price">Fiyat farkı (₺)</Label>
            <Input
              id="opt-price"
              type="number"
              step="0.01"
              placeholder="25"
              value={form.priceDelta}
              onChange={(e) => setForm({ ...form, priceDelta: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" loading={saving}>
              Kaydet
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
              Vazgeç
            </Button>
          </div>
        </form>
      )}
      {confirmDialog}
    </Card>
  );
}
