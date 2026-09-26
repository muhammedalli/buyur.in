---
name: buyur-panel-sayfasi
description: buyur yönetim paneline yeni bir sayfa, form veya ekran eklerken izlenecek uçtan uca akış. Panel sayfası, panel formu, yeni panel sekmesi, ürün/kategori/kampanya ekranı, panel ayar alanı ya da panelde yeni bir liste isteniyorsa kullanın. Müşteri menüsü ekranları bu skill'in kapsamı dışındadır.
---

# Panel Sayfası Ekleme

buyur panelinde her ekran aynı iskeleti izler. Sapma, kullanıcıya tutarsız bir
ürün olarak döner.

## 1. Önce karar ver

| Soru | Nereye bakılır |
|---|---|
| Bu özellik plana bağlı mı? | `lib/entitlements.ts` → `Feature` union'ı |
| Yeni veri alanı gerekiyor mu? | `lib/types.ts` + `scripts/setup-pocketbase.mjs` |
| Metinler çevrilebilir mi? | `lib/i18n.ts` → `TranslatableField` |
| Navigasyonda yer alacak mı? | `app/panel/(dashboard)/layout.tsx` içindeki nav dizisi |

Plana bağlıysa **önce** `Feature` ekle, sonra ekranı yaz.

## 2. Dosya yerleşimi

```
app/panel/(dashboard)/<alan>/page.tsx        → liste ekranı
app/panel/(dashboard)/<alan>/new/page.tsx    → oluşturma
app/panel/(dashboard)/<tekil>/[id]/page.tsx  → düzenleme
components/panel/<alan>-form.tsx             → paylaşılan form gövdesi
```

Oluşturma ve düzenleme aynı form bileşenini paylaşır; sayfa yalnızca veriyi
yükler ve kaydeder.

## 3. İskelet

```tsx
"use client";

import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/panel/ui";
import type { Category } from "@/lib/types";

export default function OrnekPage() {
  const { business, isLoading: businessLoading } = useBusiness();
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  async function load() {
    if (!business) return;
    setLoading(true);
    const list = await pb.collection("buyur_categories").getFullList<Category>({
      filter: pb.filter("business = {:id}", { id: business.id }),
      sort: "order,created",
    });
    setItems(list);
    setLoading(false);
  }

  if (businessLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Başlık"
        description="Bu ekranın ne işe yaradığı tek cümlede."
        action={<Button>Yeni ekle</Button>}
      />
      {items.length === 0 ? (
        <EmptyState
          title="Henüz kayıt yok"
          description="İlk kaydınızı ekleyin, menünüzde hemen görünsün."
          action={<Button>Yeni ekle</Button>}
        />
      ) : (
        <Card>{/* liste */}</Card>
      )}
      {confirmDialog}
    </>
  );
}
```

## 4. Form sayfalarında ek zorunluluklar

```tsx
const draft = useFormDraft<FormValues>(`urun:${id}`, values, baseline, initial?.updated);
```

- `DraftBanner` ile önceki oturumdan kalan taslağı geri yükleme seçeneği sun
- `FormActions` yapışkan eylem çubuğudur: kaydet/iptal + durum satırı
  (`dirty={draft.dirty}`, `savedAt`, `draftSavedAt`, `error`); form `className={FORM_STACK}`
- Kayıt durumu formun altına ayrıca yazılmaz; alana bağlı AI eylemi alanın yanında
  durur (`MultiLangFields` → `translate`), çubukta tekrar edilmez
- Kayıt başarılı olunca `draft.clear()`
- Yarım veri canlı menüye **yazılmaz** — taslak tarayıcıda durur

## 5. Plan kilidi

```tsx
if (!isFeatureAvailable(business.plan, "campaigns")) {
  return (
    <UpgradeNotice
      title="Kampanyalar Premium'da"
      description="Menünüzde kampanya ve pop-up göstermek için planınızı yükseltin."
    />
  );
}
```

Özelliği menüden **gizleme** — kilitli ama görünür bırak.

## 6. Kontrol listesi

- [ ] Tüm bileşenler `components/panel/ui.tsx` kitinden
- [ ] Yükleniyor / boş / hata durumları var
- [ ] Sorgular `pb.filter()` ile parametreli, sıralama `order,created`
- [ ] Yıkıcı işlemler `useConfirm()` ile onaylanıyor
- [ ] Form sayfalarında `useFormDraft()` ve yapışkan `FormActions` var
- [ ] Köşe yarıçapı 6px (`rounded-md`); sayılar `StatGroup`, listeler `Table`
- [ ] Plana bağlıysa `isFeatureAvailable()` + `UpgradeNotice`
- [ ] Çevrilebilir alanlar `MultiLangFields` ile
- [ ] Tüm kullanıcı metinleri Türkçe
- [ ] Ham renk kodu yok, `@theme` token'ları kullanılmış
- [ ] Navigasyona eklendiyse `prefixes` doğru
- [ ] `bun run build` ve `bun run test` yeşil
- [ ] Akış tarayıcıda gerçekten tıklanarak doğrulandı
