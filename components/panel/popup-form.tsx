"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { pb } from "@/lib/pocketbase";
import { useToast } from "@/components/panel/toast";
import { Card, FORM_STACK, FormActions, Label } from "@/components/panel/ui";
import { ImageUploader } from "@/components/panel/image-uploader";
import { MultiLangFields } from "@/components/panel/multi-lang-fields";
import { activeLocales, mainLocale, type TranslatableField, type Translations } from "@/lib/i18n";
import type { Business, Popup } from "@/lib/types";

interface PopupValues {
  title: string;
  message: string;
  imageUrl: string;
  isActive: boolean;
  translations: Translations;
}

function toValues(popup?: Popup): PopupValues {
  return {
    title: popup?.title ?? "",
    message: popup?.message ?? "",
    imageUrl: popup?.image_url ?? "",
    isActive: popup?.is_active ?? true,
    translations: popup?.translations ?? {},
  };
}

export function PopupForm({
  business,
  initial,
  onSaved,
  onCancel,
}: {
  business: Business;
  initial?: Popup;
  onSaved: (popup: Popup) => void;
  onCancel?: () => void;
}) {
  const baseline = useMemo(
    () => toValues(initial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial?.id, initial?.updated]
  );
  const [title, setTitle] = useState(baseline.title);
  const [message, setMessage] = useState(baseline.message);
  const [imageUrl, setImageUrl] = useState(baseline.imageUrl);
  const [isActive, setIsActive] = useState(baseline.isActive);
  const [translations, setTranslations] = useState<Translations>(baseline.translations);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const currentJson = JSON.stringify({ title, message, imageUrl, isActive, translations } satisfies PopupValues);
  const dirty = currentJson !== JSON.stringify(baseline);

  // Kullanıcı formu düzelttikçe eski hata çubukta asılı kalmasın.
  useEffect(() => {
    setError("");
  }, [currentJson]);

  function setBaseField(field: TranslatableField, value: string) {
    if (field === "title") setTitle(value);
    else setMessage(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        business: business.id,
        title,
        message,
        image_url: imageUrl,
        is_active: isActive,
        translations,
      };
      const record = initial
        ? await pb.collection("buyur_popups").update<Popup>(initial.id, payload)
        : await pb.collection("buyur_popups").create<Popup>(payload);
      // Form kayıtla birebir aynı hâle gelir; "kaydedilmemiş değişiklik" kalmaz.
      const saved = toValues(record);
      setTitle(saved.title);
      setMessage(saved.message);
      setImageUrl(saved.imageUrl);
      setIsActive(saved.isActive);
      setTranslations(saved.translations);
      setSavedAt(Date.now());
      toast(initial ? "Kampanya güncellendi" : "Kampanya eklendi");
      onSaved(record);
    } catch {
      setError("Kaydedilemedi, tekrar dene.");
      toast("Kaydedilemedi, tekrar dene.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={FORM_STACK}>
      <FormActions
        saving={saving}
        dirty={dirty}
        savedAt={savedAt ?? initial?.updated ?? null}
        error={error || undefined}
        onCancel={onCancel}
        toggle={{ checked: isActive, onChange: setIsActive, label: "Aktif" }}
      />
      <Card className="space-y-5">
        {/* Üstte solda kare görsel */}
        <div className="w-32">
          <Label>Görsel (opsiyonel)</Label>
          <ImageUploader value={imageUrl} onChange={setImageUrl} businessId={business.id} kind="popup" name={title} aspect="aspect-square" />
        </div>
        {/* Başlık ve mesaj dil bazlı — ana dil baz alan, diğerleri çeviri */}
        <MultiLangFields
          locales={activeLocales(business)}
          mainLocale={mainLocale(business)}
          base={{ title, message }}
          onBaseChange={setBaseField}
          translations={translations}
          onTranslationsChange={setTranslations}
          title="Başlık ve mesaj"
          translate={{ business, kind: "popup" }}
          fields={[
            { key: "title", label: "Başlık", required: true, placeholder: "Bu hafta sonuna özel!" },
            { key: "message", label: "Mesaj", multiline: true, rows: 3 },
          ]}
        />
      </Card>
    </form>
  );
}
