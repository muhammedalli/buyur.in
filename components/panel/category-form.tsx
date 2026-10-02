"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { pb } from "@/lib/pocketbase";
import { useToast } from "@/components/panel/toast";
import { Card, DraftBanner, FORM_STACK, FormActions, Label } from "@/components/panel/ui";
import { ImageUploader } from "@/components/panel/image-uploader";
import { MultiLangFields } from "@/components/panel/multi-lang-fields";
import { useFormDraft } from "@/lib/use-draft";
import { categoryNameTaken } from "@/lib/unique-name";
import { CATEGORY_COLLECTION, categoryImageUrl } from "@/lib/files";
import { imagePatch, restoreImageValue } from "@/lib/image-value";
import { activeLocales, mainLocale, type TranslatableField, type Translations } from "@/lib/i18n";
import type { Business, Category } from "@/lib/types";
import { useUiLocale } from "@/components/ui-locale-provider";

interface CategoryDraft {
  name: string;
  description: string;
  /** Görsel alanı değeri (lib/image-value.ts). */
  image: string;
  isActive: boolean;
  translations: Translations;
}

function toDraft(initial?: Category): CategoryDraft {
  return {
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    image: initial?.image ?? "",
    isActive: initial?.is_active ?? true,
    translations: initial?.translations ?? {},
  };
}

export function CategoryForm({
  business,
  initial,
  order,
  onSaved,
  onCancel,
}: {
  business: Business;
  initial?: Category;
  order?: number;
  onSaved: (category: Category) => void;
  onCancel?: () => void;
}) {
  const baseline = useMemo(
    () => toDraft(initial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial?.id, initial?.updated]
  );

  const [name, setName] = useState(baseline.name);
  const [description, setDescription] = useState(baseline.description);
  const [image, setImage] = useState(baseline.image);
  const [isActive, setIsActive] = useState(baseline.isActive);
  const [translations, setTranslations] = useState<Translations>(baseline.translations);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const { toast } = useToast();
  const { t } = useUiLocale();

  const current: CategoryDraft = { name, description, image, isActive, translations };
  const draft = useFormDraft(`category:${initial?.id ?? `new:${business.id}`}`, current, baseline, initial?.updated);

  // Kullanıcı formu düzelttikçe eski hata çubukta asılı kalmasın.
  const currentJson = JSON.stringify(current);
  useEffect(() => {
    setError("");
  }, [currentJson]);

  function applyDraft(value: CategoryDraft) {
    setName(value.name);
    setDescription(value.description);
    setImage(restoreImageValue(value.image, baseline.image));
    setIsActive(value.isActive);
    setTranslations(value.translations);
  }

  function setBaseField(field: TranslatableField, value: string) {
    if (field === "name") setName(value);
    else setDescription(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Aynı adda ikinci bir kategori menüde ayırt edilemez — yazmadan önce sorulur.
      const taken = await categoryNameTaken(business.id, name, initial?.id);
      if (taken) {
        setError(t(taken));
        toast(t(taken), "error");
        return;
      }

      // Görsel yalnızca değiştiyse gider; kaldırılan görseli PocketBase depodan da siler.
      const payload = { name, description, is_active: isActive, translations, ...imagePatch(image, name, "image") };
      const record = initial
        ? await pb.collection(CATEGORY_COLLECTION).update<Category>(initial.id, payload)
        : await pb.collection(CATEGORY_COLLECTION).create<Category>({ ...payload, business: business.id, order: order ?? 0 });
      draft.clear();
      // Form kayıtla birebir aynı hâle gelir; "kaydedilmemiş değişiklik" kalmaz.
      applyDraft(toDraft(record));
      setLastSavedAt(Date.now());
      toast(initial ? t("Kategori güncellendi") : t("Kategori eklendi"));
      onSaved(record);
    } catch {
      setError(t("Kaydedilemedi, tekrar dene."));
      toast(t("Kaydedilemedi, tekrar dene."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={FORM_STACK}>
      <FormActions
        saving={saving}
        dirty={draft.dirty}
        savedAt={lastSavedAt ?? initial?.updated ?? null}
        draftSavedAt={draft.draftSavedAt}
        error={error || undefined}
        onCancel={onCancel}
        toggle={{ checked: isActive, onChange: setIsActive, label: t("Menüde göster") }}
      />
      {draft.restorable && (
        <DraftBanner
          savedAt={draft.restorable.savedAt}
          onRestore={() => {
            if (draft.restorable) applyDraft(draft.restorable.value);
            draft.dismiss();
          }}
          onDiscard={draft.discard}
        />
      )}

      <Card className="space-y-6">
        {/* Üstte solda kare görsel */}
        <div className="w-32">
          <Label>{t("Kategori görseli")}</Label>
          <ImageUploader
            value={image}
            onChange={setImage}
            preset="category"
            storedUrl={(fileName) => categoryImageUrl({ id: initial?.id ?? "", image: fileName })}
            aspect="aspect-square"
          />
        </div>

        {/* Altında dil sekmeleri — ana dil ilk sırada ve açık */}
        <MultiLangFields
          locales={activeLocales(business)}
          mainLocale={mainLocale(business)}
          base={{ name, description }}
          onBaseChange={setBaseField}
          translations={translations}
          onTranslationsChange={setTranslations}
          title={t("Ad ve açıklama")}
          translate={{ business, kind: "category" }}
          fields={[
            { key: "name", label: t("Kategori adı"), required: true, placeholder: t("Ana Yemekler") },
            { key: "description", label: t("Açıklama"), multiline: true },
          ]}
        />
      </Card>
    </form>
  );
}
