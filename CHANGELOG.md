# Sürüm notları

> Bu dosya `lib/release-notes.ts`'ten üretilir (`bun run changelog`). Elle düzenlemeyin.
> Kullanıcıya görünen hâli: https://buyur.in/docs/surum-notlari

## [0.10.0] — 2026-09-27

**Panele yeni görünüm: tam boy yan menü ve sade kartlar**

- **Yeni:** Panelin sol menüsü artık ekranın tam boyunda. Menü butonuyla ikonlara daraltıp çalışma alanını genişletebilirsiniz; tercihiniz bu cihazda hatırlanır.
- **İyileştirme:** Menüyü görme, kılavuzu başlatma ve çıkış, yan menünün altındaki işletme adınıza tıklayınca açılan menüde. Üst çubukta hangi sayfada olduğunuz yazıyor.
- **İyileştirme:** Sayılar ikonlu kartlarda, sekmeler tek bir çerçevede; butonlar ve alanlar daha okunur. Renkleriniz ve yazı tipleri aynı kaldı.
- **İyileştirme:** Yönetim paneli de aynı yan menüye geçti: hesap ve çıkış işlemleri menünün altında.
- **İyileştirme:** Panel ve web sitenizdeki büyük harfli, daktilo yazılı etiketler sadeleşti: butonlar, etiketler ve rozetler artık normal yazıyla, daha kolay okunuyor.
- **Yeni:** Panel İngilizce olarak da tam kullanılabiliyor: analizler, raporlar, değerlendirmeler, yapay zekâ ile menü aktarımı ve plan ekranları dahil. Tarih, yüzde ve süreler de seçtiğiniz dile göre yazılıyor.
- **İyileştirme:** Web sitenizin açılışında görselin üstünde duran dil ve menü butonları kalktı; ziyaretçi aşağı kaydırınca işletme adınız, dil seçici ve "Menü" düğmesiyle yapışkan bir üst çubuk beliriyor. Dil seçici artık açılır menü.

Geliştirici notu:

- components/ui/sidebar.tsx: shadcn Sidebar'ın sade hâli (SidebarProvider, Sidebar, SidebarHeader/Content/Footer/Group/Item, SidebarBrand, SidebarAccount, SidebarTrigger, SidebarInset). lg+ tam boy yapışkan sütun (w-64 / daraltılmış w-14, localStorage: buyur-panel-sidebar, buyur-admin-sidebar), lg altı Sheet; sayfa değişince yaprak kapanır. Kit (components/panel/ui.tsx) dışa verir.
- Kabuklar: app/panel/(dashboard)/layout.tsx + components/panel/panel-nav.tsx (PanelSidebar, PanelBreadcrumb), components/admin/admin-shell.tsx. Başlık yüksekliği --app-header-h = 64px (SidebarProvider'da); eski --panel-header-h / --admin-header-h kalktı.
- Büyük harf temizliği: panel/yönetim/site ekranlarındaki `font-mono … uppercase tracking-*` sınıfları TS-AST ile gövde yazısına çevrildi (giriş/kayıt ekranları ve müşteri menüsü hariç).
- Panel İngilizce: lib/ui-messages/en/panel.ts dolduruldu (≈1.100 metin); analiz/rapor/değerlendirme/AI aktarım/plan kullanım ekranları t() ile sarıldı. lib/analytics/{reports,score,opportunities}.ts sabit etiketleri msg() ile işaretlendi ve i18n-domains panel kapsamına eklendi. Sunucuda sayıyla üretilen içgörü/rapor özet cümleleri Türkçe kalır (API'ye dil parametresi gerekir). chart-utils biçimleri setChartLocale ile arayüz diline bağlandı (WEEKDAY_LABELS → weekdayLabel/weekdayLabels).
- Site: SiteHeader açılışta gizli, hero'nun %35'i geçilince iner (inert); SiteLanguageSwitcher açılır menü (Radix'siz, Esc/dışarı tıklama kapatır).
- Kit: Button/Label/Tabs/NavTabs/Switch/Table başlığı font-mono büyük harf yerine gövde yazısı; Tabs bölümlü kontrol (bg-crema p-1); alanlar focus ring-3; Card/Table shadow-xs; PageHeader alt çizgisiz; StatGroup ayrı kartlardan ızgara + isteğe bağlı `icon`. Input/Textarea/Select/Card/Table sınıfları artık cn ile birleşiyor.

## [0.9.0] — 2026-09-27

**Sekiz dilde menü, telefona uygun panel ve yönetimde ödemeler**

- **Yeni:** Menünüz artık sekiz dilde sunulabiliyor: Türkçe, English, Deutsch, العربية, Français, Español, Italiano ve Русский. Ana diliniz dahil en fazla dört dil açabilirsiniz.
- **İyileştirme:** Menü dilleri açılır menüden seçiliyor: ana dili seçin, "Dil ekle" ile ek dilleri açın. Kapattığınız dilin çevirileri silinmiyor.
- **Yeni:** Mekân özelliklerinde sınır kalktı: Wi-Fi, otopark, teras gibi istediğiniz kadar özellik seçebilirsiniz. Menünüzde ve web sitenizde ikonlarıyla gösteriliyor.
- **İyileştirme:** Panel telefonda yeniden düzenlendi: yana kayan menü şeridi yerine menü butonuyla açılan yan menü. Ayarlar bölümleri masaüstünde sol listede, telefonda açılır menüde.
- **İyileştirme:** Panelin hiçbir ekranı telefonda yana kaymıyor; sekmeler, tablolar ve butonlar ekrana sığıyor.
- **Düzeltme:** Arapça menüde bazı oklar ve hizalamalar artık sağdan sola doğru gösteriliyor.
- **Düzeltme:** Kaydet çubuğundaki "Vazgeç" butonu telefonda gizleniyor; önceden sığmayıp çubuğu taşırıyordu.
- **Yeni:** Yönetim panelinde Ödemeler: borç kayıtları, alınan ve verilen ödemeler, işletme bazında kalan borç ve filtrelenebilir ödeme geçmişi.

Geliştirici notu:

- Menü dilleri: lib/i18n.ts (SUPPORTED_LOCALES = tr en de ar fr es it ru, MAX_MENU_LOCALES = 4, activeLocales en fazla 4 döner), lib/labels.ts, lib/ai/translate.ts dil adı eşlemeleri. Yayınlanmamış Kürtçe (ku) kaldırıldı.
- Mekân özellikleri: highlights.maxSelect = seçenek sayısı; components/highlight-list.tsx (menü + site).
- shadcn/ui katmanı: components/ui (dialog, sheet, dropdown-menu, tooltip; radix-ui, clsx, tailwind-merge). Panel kitinde Modal/Dropdown Radix'e taşındı; Tabs/NavTabs sığmazsa açılır menü, SectionNav, StatGroup columns/size, buttonClass cn ile birleşiyor.
- Gezinme: components/panel/panel-nav.tsx ve admin-shell.tsx (gruplu yan menü + Sheet); components/horizontal-scroll.tsx yalnızca müşteri menüsünde.
- Ödemeler: buyur_payments (scripts/payments-schema.mjs), lib/payments.ts, lib/admin-payments.ts, app/api/admin/payments/**, /admin/payments, işletme detayı; payments.view (destek) / payments.edit (super_admin); payment.create|update|delete denetim eylemleri.
- Yayın sırası: node scripts/migrate-storefront-i18n.mjs --dry-run → çalıştır (dil seçenekleri, languages.maxSelect = 3, highlights sınırı, vitrin alanları) → node scripts/migrate-payments.mjs --dry-run → çalıştır → deploy.
- pnpm-lock.yaml ve pnpm-workspace.yaml kaldırıldı; kurulum yalnızca bun.lock ile. Vercel'in kurulum komutu bun olmalı.
- Dokümanlar docs/ altında yeniden düzenlendi: architecture, development-rules, ui-guidelines, localization, admin-panel, payments (+ analytics-architecture, audit-log).
- Açık iş: aynı ağaçtaki vitrin/kayan yazı/kılavuz/panel arayüz dili çalışmasının panel İngilizce kataloğu (lib/ui-messages/en/panel.ts) boş; tests/ui-i18n.test.ts panel/en bu yüzden kırmızı. Yayından önce katalog doldurulmalı ya da paneldeki dil seçici gizlenmeli.

## [0.8.0] — 2026-09-27

**Yardım merkezi ve daha güvenilir yapay zekâ çevirisi**

- **Yeni:** Yardım merkezi yayında: kurulumdan QR kodlara, çoklu dilden raporlara kadar bütün özellikler adım adım anlatılıyor.
- **Yeni:** Sürüm notları sayfası: her güncellemede neyin değiştiğini buradan takip edebilirsiniz.
- **Düzeltme:** Kampanya başlığı ve mesajı, ürün seçenekleri ve kampanya etiketi için "AI ile tamamla" artık doğru alanı dolduruyor; önceden çeviri üretilip boş kalabiliyordu.
- **Düzeltme:** Ana dilde açıklaması olmayan bir ürüne yapay zekâ artık kendiliğinden açıklama uydurmuyor.
- **Düzeltme:** Yapay zekânın dilleri kod yerine adıyla ("English" gibi) döndürdüğü durumlarda çeviri artık kaybolmuyor.
- **Düzeltme:** Ayarlarda yeni eklenip henüz kaydedilmemiş dil için "önce kaydedin" uyarısı gösteriliyor; buton sessizce o dili atlamıyor.
- **İyileştirme:** Sayfadan çıkıldığında bekleyen çeviri denemesi tamamen iptal ediliyor.

Geliştirici notu:

- lib/ai/translate.ts: buildTranslationPrompt şema örneğini gönderilen alanlardan kurar; normalizeTranslationResult sourceFields (entrySourceFields) ile yalnızca gönderilen alanları kabul eder; extractItems id-sözlüğü, kök dil anahtarı, dizi çeviri ve farklı kök anahtar biçimlerini okur; normalizeLocaleKey dil adlarını tanır; unsavedLocales eklendi.
- components/panel/ai/translate-button.tsx: visibleLocales, iptal edilebilir yeniden deneme beklemesi.
- Yeni: lib/docs.ts, lib/release-notes.ts, app/docs/**, CHANGELOG.md; navbar/footer/sitemap bağlantıları.
- Göç yok.

## [0.7.1] — 2026-09-26

**Demo menü yeni adresinde**

- **Düzeltme:** Tanıtım sayfasındaki "Canlı demo" bağlantıları yeni demo menü adresine yönlendiriliyor.

Geliştirici notu:

- lib/showcase.ts DEMO_SLUG = "demo".

## [0.7.0] — 2026-09-26

**Çoklu dilde kaybolan çeviriler ve merkezi denetim kaydı**

- **Düzeltme:** Sekmeye geri dönünce formun yeniden yüklenip yapay zekâ çevirilerini silmesi giderildi.
- **İyileştirme:** "AI ile tamamla" yalnızca boş çevirileri dolduruyor; elle yazdığınız çeviriye dokunmuyor.
- **Yeni:** İşletme açıklaması da yapay zekâ ile çevrilebiliyor.
- **Güvenlik:** Önemli her işlem merkezi denetim kaydına yazılıyor.

Geliştirici notu:

- docs/audit-log.md; pocketbase/pb_hooks canlı PocketBase'e henüz kurulmadı.

## [0.6.0] — 2026-09-25

**Yönetim paneli**

- **Yeni:** İki adımlı yönetici girişi, işletme listesi, askıya alma ve plan/fiyat düzenleme.

Geliştirici notu:

- admin.buyur.in; lib/admin-roles.ts, lib/admin-audit.ts.

## [0.5.0] — 2026-09-25

**Tek hesap, tek işletme**

- **İyileştirme:** Giriş hesabı ile işletme kaydı birleştirildi; kayıt e-posta kodu ile doğrulanıyor.

Geliştirici notu:

- buyur_businesses auth koleksiyonu; scripts/business-schema.mjs.
