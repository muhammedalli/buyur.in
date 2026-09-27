# Arayüz kuralları

## Tasarım dili

- Renkler yalnızca `app/globals.css → @theme` token'larından: `paper`, `crema`, `ink`, `ink-soft`,
  `paprika`, `paprika-deep`, `herb`, `line`. Ham renk kodu (`#fff`, `bg-[#…]`) yazılmaz.
- Yazı: `font-display` (başlık), `font-body` (buton, etiket, sekme, tablo başlığı, rozet dahil),
  `font-mono` yalnızca sayı ve kod (fiyat, adres, kimlik). Büyük harfli etiket (`uppercase tracking-wider`)
  kullanılmaz; küçük etiket `text-xs font-medium text-ink-soft`'tur. İstisna: giriş/kayıt ekranları.
- Köşe yarıçapı 6px (`rounded-md`). Hap biçimi yalnızca anahtar, durum noktası, avatar gibi
  gerçekten yuvarlak öğelerde. Giriş/kayıt ekranları kendi onaylı görselini izler.
- Müşteri menüsü işletmenin rengini `var(--brand)` / `var(--brand-text)` ile alır; sabit token'la
  ezilmez.

## Bileşenler

Panel ve yönetim ekranları bileşenleri **yalnızca** `components/panel/ui.tsx`'ten alır. Buton,
alan, pencere elle yazılmaz.

| İhtiyaç | Bileşen |
|---|---|
| Eylem | `Button` (`size="sm"`), bağlantı için `buttonClass()` / admin'de `ButtonLink` |
| Alan | `Input`, `Textarea`, `Select` (yerel select: mobilde işletim sisteminin seçicisi), `Switch` |
| Başlık | `PageHeader`, `SectionHeader` (eylem sağ üstte) |
| Özet | `StatGroup` (ikonlu kart ızgarası, `icon`; çok değerde `columns`, para için `size="sm"`) |
| Liste | `Table` |
| Pencere | `Modal` (Dialog), onay için `useConfirm()` |
| Yaprak | `Sheet*` (dar ekrandaki ikincil menüler) |
| Uygulama kabuğu | `SidebarProvider` + `Sidebar*` + `SidebarInset` (yalnızca panel/yönetim kabuğu) |
| İkincil eylemler | `Dropdown` / `DropdownMenu*` |
| İkon butonu adı | `Tooltip` (bilgi taşıyan metin tooltip'e saklanmaz) |
| Sekme | `Tabs` (durum), `NavTabs` (bağlantı) |
| Çok bölümlü ekran | `SectionNav` + `SECTION_LAYOUT` |
| Form eylem çubuğu | `FormActions` + `FORM_STACK` |

`components/ui/*` shadcn/ui katmanıdır (Radix + Buyur token'ları). Ekranlar onu doğrudan değil
kit üzerinden kullanır; yeni bir Radix bileşeni gerekiyorsa önce `components/ui`'a eklenir, kit
onu dışa verir. Radix paketi yalnızca panel/yönetim paketine girer; müşteri menüsü kiti import etmez.

## Yatay taşma yok

Kesin kural: **hiçbir ekran yatayda kaymaz ve içerik ekran dışında kalmaz.**

- Sekmeler sığmazsa açılır menüye döner (`Tabs`, `NavTabs` bunu kendisi ölçer).
- Çok bölümlü ayarlar: masaüstünde (lg+) sol bölüm listesi, dar ekranda açılır menü (`SectionNav`).
- Tablo 320px'te kabına sığacak şekilde yazılır: ikincil sütunlar `hidden sm:table-cell` /
  `md:table-cell`, ikincil bilgi dar ekranda ana hücrenin altına iner, uzun metin `truncate`.
- Buton ve filtre satırları `flex-wrap` ya da dar ekranda alt alta (`flex-col` → `sm:flex-row`).
  `shrink-0` buton uzun etiketle birlikte kullanılacaksa satır sarılabilir olmalı.
- Flex/grid çocukları taşan içerikte `min-w-0` alır (grid çocukları global olarak alır).
- Pencere, açılır menü ve popover görünür alanı aşmaz (Radix `collisionPadding`, `max-w-[calc(100vw-…)]`).
- İstisna: müşteri menüsünün kategori şeridi ve ürün kaydırıcıları bilinçli yatay kaydırmadır.

Denetim: 320 / 375 / 768 / 1024 / 1440 px'te her rota açılır, `document.documentElement.scrollLeft`
kaydırılamamalı ve görünür hiçbir öğenin sağ kenarı görünür alanı aşmamalıdır.

## Gezinme

- İşletme paneli: `components/panel/panel-nav.tsx → PANEL_NAV_GROUPS` (Menü, Paylaşım,
  Performans, Hesap). Yönetim paneli: `components/admin/admin-shell.tsx → NAV_GROUPS`.
- Kabuk shadcn Sidebar desenidir (`components/ui/sidebar.tsx`): `lg` ve üstü ekranın tam boyunda
  yapışkan sol sütun (üstte marka, altta hesap menüsü), başlıktaki `SidebarTrigger` ikonlara
  daraltır (tercih cihazda saklanır; daraltılmışken adı tooltip söyler). Daha dar ekranda aynı
  ağaç `Sheet` olarak açılır, sayfa değişince kapanır.
- Hesap işlemleri (menüyü gör, kılavuz, çıkış / şifre değiştir) sütunun altındaki hesap
  menüsündedir; başlıkta konum (`Grup › Sayfa`) ve birkaç kısa eylem durur.
- Yeni üst düzey sayfa = gruba bir satır; alt sayfalar `NavTabs` ile.

## Formlar

- `useBusiness()` → `useFormDraft()` → `FormActions` (masaüstünde başlığın altında, mobilde ekranın
  altında yapışkan). Kayıt durumu formun altına ayrıca yazılmaz.
- Alana bağlı AI eylemi alanın yanında durur (`MultiLangFields` → "AI ile tamamla").
- Dil seçimi açılır menüdür; seçenek listesi uzunsa `Select`, kısa eylem menüsü `Dropdown`.
