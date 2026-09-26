"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { pb } from "@/lib/pocketbase";
import { useToast } from "@/components/panel/toast";
import { allergenLabels, badgeLabels } from "@/lib/labels";
import { Button, Card, DraftBanner, FORM_STACK, FormActions, Input, Label, Select, Spinner } from "@/components/panel/ui";
import { ImageUploader } from "@/components/panel/image-uploader";
import { ImagePicker, ImageSourceNote } from "@/components/panel/ai/image-picker";
import { SearchIcon } from "@/components/icons";
import { autoFindProductImage } from "@/lib/ai/find-image";
import type { ProductImageSource } from "@/lib/ai/image-source";
import { MultiLangFields } from "@/components/panel/multi-lang-fields";
import { useFormDraft } from "@/lib/use-draft";
import { productNameTaken } from "@/lib/unique-name";
import { activeLocales, mainLocale, type TranslatableField, type Translations } from "@/lib/i18n";
import type { Allergen, Badge, Business, Category, Product } from "@/lib/types";

const ALL_ALLERGENS = Object.keys(allergenLabels.tr) as Allergen[];
const ALL_BADGES = Object.keys(badgeLabels.tr) as Badge[];

interface ProductFormProps {
  business: Business;
  categories: Category[];
  initial?: Product;
  onSaved: (product: Product) => void;
  onCancel?: () => void;
}

/** Formun taslak olarak saklanan hâli (bkz. lib/use-draft.ts). */
interface ProductDraft {
  category: string;
  name: string;
  description: string;
  price: string;
  image: string;
  imageSource: ProductImageSource | null;
  prepMin: string;
  prepMax: string;
  calories: string;
  allergens: Allergen[];
  badges: Badge[];
  isAvailable: boolean;
  discountPercent: string;
  campaignLabel: string;
  translations: Translations;
}

function toDraft(initial: Product | undefined, categories: Category[]): ProductDraft {
  return {
    category: initial?.category ?? categories[0]?.id ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    price: initial?.price?.toString() ?? "",
    image: initial?.images?.[0] ?? "",
    imageSource: initial?.image_source ?? null,
    prepMin: initial?.prep_time_min ? initial.prep_time_min.toString() : initial ? "0" : "",
    prepMax: initial?.prep_time_max ? initial.prep_time_max.toString() : initial ? "0" : "",
    calories: initial?.calories ? initial.calories.toString() : initial ? "0" : "",
    allergens: initial?.allergens ?? [],
    badges: initial?.badges ?? [],
    isAvailable: initial?.is_available ?? true,
    discountPercent: initial?.discount_percent ? initial.discount_percent.toString() : initial ? "0" : "",
    campaignLabel: initial?.campaign_label ?? "",
    translations: initial?.translations ?? {},
  };
}

export function ProductForm({ business, categories, initial, onSaved, onCancel }: ProductFormProps) {
  const baseline = useMemo(
    () => toDraft(initial, categories),
    // Kayıt güncellendiğinde (updated) taban da tazelenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial?.id, initial?.updated, categories.length]
  );

  const [category, setCategory] = useState(baseline.category);
  const [name, setName] = useState(baseline.name);
  const [description, setDescription] = useState(baseline.description);
  const [price, setPrice] = useState(baseline.price);
  const [image, setImage] = useState<string>(baseline.image);
  const [imageSource, setImageSource] = useState<ProductImageSource | null>(baseline.imageSource);
  const [imageStatus, setImageStatus] = useState<"idle" | "searching" | "none">("idle");
  const [picking, setPicking] = useState(false);
  const [prepMin, setPrepMin] = useState(baseline.prepMin);
  const [prepMax, setPrepMax] = useState(baseline.prepMax);
  const [calories, setCalories] = useState(baseline.calories);
  const [allergens, setAllergens] = useState<Allergen[]>(baseline.allergens);
  const [badges, setBadges] = useState<Badge[]>(baseline.badges);
  const [isAvailable, setIsAvailable] = useState(baseline.isAvailable);
  const [discountPercent, setDiscountPercent] = useState(baseline.discountPercent);
  const [campaignLabel, setCampaignLabel] = useState(baseline.campaignLabel);
  const [translations, setTranslations] = useState<Translations>(baseline.translations);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const { toast } = useToast();

  const current: ProductDraft = {
    category,
    name,
    description,
    price,
    image,
    imageSource,
    prepMin,
    prepMax,
    calories,
    allergens,
    badges,
    isAvailable,
    discountPercent,
    campaignLabel,
    translations,
  };
  const draft = useFormDraft(`product:${initial?.id ?? `new:${business.id}`}`, current, baseline, initial?.updated);

  // Kullanıcı formu düzelttikçe eski hata çubukta asılı kalmasın.
  const currentJson = JSON.stringify(current);
  useEffect(() => {
    setError("");
  }, [currentJson]);

  function applyDraft(value: ProductDraft) {
    // Taslaktaki kategori silinmişse mevcut seçim korunur.
    if (categories.some((cat) => cat.id === value.category)) setCategory(value.category);
    setName(value.name);
    setDescription(value.description);
    setPrice(value.price);
    setImage(value.image);
    setImageSource(value.imageSource);
    setPrepMin(value.prepMin);
    setPrepMax(value.prepMax);
    setCalories(value.calories);
    setAllergens(value.allergens);
    setBadges(value.badges);
    setIsAvailable(value.isAvailable);
    setDiscountPercent(value.discountPercent);
    setCampaignLabel(value.campaignLabel);
    setTranslations(value.translations);
  }

  function setBaseField(field: TranslatableField, value: string) {
    if (field === "name") setName(value);
    else if (field === "campaign_label") setCampaignLabel(value);
    else setDescription(value);
  }

  const categoryName = categories.find((cat) => cat.id === category)?.name ?? "";
  // Kullanıcı görseli kendisi belirlediyse (yükledi, seçti ya da kaldırdı)
  // otomatik arama bir daha devreye girmez — seçimi ezmek en sinir bozucu hata.
  const manualImage = useRef(false);
  // Yazmaya devam eden kullanıcıda eski aramanın geç dönen sonucu uygulanmasın.
  const searchToken = useRef(0);

  async function findImage(term: string) {
    const token = ++searchToken.current;
    setImageStatus("searching");
    const stored = await autoFindProductImage(business.id, term, categoryName);
    if (token !== searchToken.current) return;

    if (stored) {
      setImage(stored.url);
      setImageSource(stored.source);
      setImageStatus("idle");
    } else {
      // Güvenli kaynakta uygun görsel yok: alan boş kalır, elle yükleme açık.
      setImageStatus("none");
    }
  }

  // Ürün adı yazıldıkça görsel otomatik aranır. Yalnızca YENİ üründe ve görsel
  // alanı boşken çalışır; yazma bitene kadar beklenir ki her harfte istek
  // atılmasın.
  useEffect(() => {
    if (initial || manualImage.current || image !== "") return;
    const term = name.trim();
    if (term.length < 3) return;

    const timer = setTimeout(() => findImage(term), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, category, image, initial]);

  /** Kullanıcının kendi seçimi — otomatik aramayı kapatır. */
  function applyManualImage(url: string, source: ProductImageSource | null) {
    manualImage.current = true;
    searchToken.current += 1;
    setImage(url);
    setImageSource(source);
    setImageStatus("idle");
  }

  function toggle<T>(list: T[], value: T, setList: (v: T[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!category) {
      setError("Bir kategori seç.");
      toast("Bir kategori seç.", "error");
      return;
    }

    const payload = {
      business: business.id,
      category,
      name,
      description,
      price: Number(price) || 0,
      images: image ? [image] : [],
      // Görselin nereden geldiği ve hangi lisansla kullanıldığı ürünle birlikte
      // saklanır; kendi yüklediği görselde künye olmaz.
      image_source: image ? imageSource : null,
      prep_time_min: prepMin ? Number(prepMin) : 0,
      prep_time_max: prepMax ? Number(prepMax) : 0,
      calories: calories ? Number(calories) : 0,
      allergens,
      badges,
      is_available: isAvailable,
      discount_percent: discountPercent ? Number(discountPercent) : 0,
      campaign_label: campaignLabel,
      translations,
    };

    setSaving(true);
    try {
      // Ad tekilliği işletme genelindedir: aynı ürün iki kategoride durmasın.
      const taken = await productNameTaken(business.id, name, initial?.id);
      if (taken) {
        setError(taken);
        toast(taken, "error");
        return;
      }

      const record = initial
        ? await pb.collection("buyur_products").update<Product>(initial.id, payload)
        : await pb.collection("buyur_products").create<Product>({ ...payload, order: 999 });
      draft.clear();
      // Form kayıtla birebir aynı hâle getirilir (ör. "80.50" → 80.5); aksi
      // hâlde kayıttan sonra da "kaydedilmemiş değişiklik" görünürdü.
      applyDraft(toDraft(record, categories));
      setLastSavedAt(Date.now());
      toast(initial ? "Ürün güncellendi" : "Ürün eklendi");
      onSaved(record);
    } catch {
      setError("Kaydedilemedi, alanları kontrol edip tekrar dene.");
      toast("Kaydedilemedi, tekrar dene.", "error");
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
        toggle={{ checked: isAvailable, onChange: setIsAvailable, label: "Satışta" }}
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

      <Card className="space-y-5">
        {/* Üstte solda kare görsel — ürün adı yazılınca otomatik doldurulur */}
        <div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-32 shrink-0">
              <Label>Ürün görseli</Label>
              <ImageUploader
                value={image}
                onChange={(url) => applyManualImage(url, null)}
                businessId={business.id}
                kind="product"
                name={name}
                aspect="aspect-square"
              />
            </div>

            <div className="min-w-[13rem] flex-1 space-y-2 pt-6">
              {imageStatus === "searching" && (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Spinner className="h-4 w-4" /> Ürün adına uygun görsel aranıyor…
                </p>
              )}
              {imageStatus === "none" && !image && (
                <p className="text-sm text-ink-soft">
                  Uygun lisanslı görsel bulunamadı. &quot;Görsel bul&quot; ile kendiniz arayabilir veya
                  kendi görselinizi yükleyebilirsiniz.
                </p>
              )}
              {image && imageSource && <ImageSourceNote source={imageSource} />}
              {image && !imageSource && (
                <p className="text-[11px] text-ink-soft">Kendi yüklediğiniz görsel.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setPicking((v) => !v)}>
                  <SearchIcon size={15} />
                  {picking ? "Kapat" : image ? "Görseli değiştir" : "Görsel bul"}
                </Button>
                {!image && imageStatus === "none" && name.trim().length >= 3 && (
                  <Button type="button" variant="ghost" onClick={() => findImage(name.trim())}>
                    Tekrar ara
                  </Button>
                )}
              </div>
            </div>
          </div>

          {picking && (
            <div className="mt-3">
              <ImagePicker
                businessId={business.id}
                productName={name}
                categoryName={categoryName}
                value={image}
                onChange={applyManualImage}
                onClose={() => setPicking(false)}
              />
            </div>
          )}
        </div>

        {/* Altında dil sekmeleri — ana dil ilk sırada ve açık. AI ile tamamla
            kaydın bütün metinlerini (kampanya etiketi dahil) tek istekte çevirir. */}
        <MultiLangFields
          locales={activeLocales(business)}
          mainLocale={mainLocale(business)}
          base={{ name, description }}
          onBaseChange={setBaseField}
          translations={translations}
          onTranslationsChange={setTranslations}
          title="Ad ve açıklama"
          translate={{ business, kind: "product", fields: { name, description, campaign_label: campaignLabel } }}
          fields={[
            { key: "name", label: "Ürün adı", required: true, placeholder: "Izgara Köfte" },
            { key: "description", label: "Açıklama", multiline: true, rows: 3, placeholder: "El yapımı, közlenmiş biber ve pilav ile" },
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-category">Kategori</Label>
            <Select id="p-category" required value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="p-price">Fiyat (₺)</Label>
            <Input id="p-price" type="number" min={0} step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="space-y-6">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Hazırlanma süresi & kalori</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="p-prep-min">Min (dk)</Label>
              <Input id="p-prep-min" type="number" min={0} value={prepMin} onChange={(e) => setPrepMin(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-prep-max">Maks (dk)</Label>
              <Input id="p-prep-max" type="number" min={0} value={prepMax} onChange={(e) => setPrepMax(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-calories">Kalori</Label>
              <Input id="p-calories" type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Rozetler</p>
          <div className="flex flex-wrap gap-2">
            {ALL_BADGES.map((badge) => (
              <button
                type="button"
                key={badge}
                onClick={() => toggle(badges, badge, setBadges)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  badges.includes(badge)
                    ? "border-paprika bg-paprika text-paper"
                    : "border-line text-ink-soft hover:border-paprika hover:text-paprika"
                }`}
              >
                {badgeLabels.tr[badge]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Alerjenler</p>
          <div className="flex flex-wrap gap-2">
            {ALL_ALLERGENS.map((allergen) => (
              <button
                type="button"
                key={allergen}
                onClick={() => toggle(allergens, allergen, setAllergens)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  allergens.includes(allergen)
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-ink-soft hover:border-ink"
                }`}
              >
                {allergenLabels.tr[allergen]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Kampanya</p>
        <div className="sm:max-w-[12rem]">
          <Label htmlFor="p-discount">İndirim (%)</Label>
          <Input
            id="p-discount"
            type="number"
            min={0}
            max={100}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
        </div>
        {/* Kampanya etiketi de dil bazlı — ana dil baz alan, diğerleri çeviri.
            Kendi kartında durduğu için tamamlama butonu da burada; yalnızca
            etiketi çevirir. */}
        <MultiLangFields
          locales={activeLocales(business)}
          mainLocale={mainLocale(business)}
          base={{ campaign_label: campaignLabel }}
          onBaseChange={setBaseField}
          translations={translations}
          onTranslationsChange={setTranslations}
          title="Kampanya etiketi"
          translate={{ business, kind: "product" }}
          fields={[{ key: "campaign_label", label: "Etiket", placeholder: "Haftanın kampanyası" }]}
        />
      </Card>

    </form>
  );
}
