# Sürüm notları

> Bu dosya `lib/release-notes.ts`'ten üretilir (`bun run changelog`). Elle düzenlemeyin.
> Kullanıcıya görünen hâli: https://buyur.in/docs/surum-notlari

## [0.12.0] — 2026-10-02

**Yüklediğiniz görseller otomatik küçülüyor, menünüz daha hızlı açılıyor**

- **Yeni:** Yüklediğiniz fotoğraf, menüde gösterileceği boyuta otomatik küçültülür. Telefonla çektiğiniz büyük fotoğrafları da doğrudan yükleyebilirsiniz; menünüz misafirin telefonunda daha hızlı açılır.
- **İyileştirme:** Logo, kapak, kategori, ürün ve kampanya görselleriniz menünüzle aynı yerde, güvenle saklanıyor. Menü listelerinde görsellerin telefona uygun küçük boyu gösteriliyor.
- **Yeni:** Ayarlar'da logoyu ve kapak görselini kaldırabilirsiniz. Kaldırdığınız ya da değiştirdiğiniz görsel depodan da silinir, eski dosya birikmez.
- **İyileştirme:** Seçtiğiniz görsel artık Kaydet'e bastığınızda yükleniyor: yarım bıraktığınız bir form menünüze görsel yazmaz.

Geliştirici notu:

- Model (scripts/image-schema.mjs): elle yüklenen görsel → PocketBase file alanı (buyur_businesses.logo/cover, buyur_categories.image, buyur_products.image, buyur_popups.image; maxSelect 1, 5MB, jpeg/png/webp/gif/avif, thumbs logo 256x256f, ürün/kategori 640x640f). Depo PocketBase'in S3 ayarı (MinIO, bucket buyur, dışa kapalı; dosyayı PB /api/files servis eder). Alan temizlenince/değişince ya da kayıt silinince PB dosyayı depodan siler (yerel PB 0.39.4'te doğrulandı; silme işlem sonrası asenkron). AI'ın bulduğu ürün görseli → buyur_products.image_url (text) bağlantı olarak, indirilmez; ikisinden biri dolu.
- Küçültme tarayıcıda (lib/image-resize.ts, ölçüler IMAGE_PRESETS): logo 512, kapak 1920, ürün 1200, kategori 800, pop-up 1080 px en uzun kenar; WebP (saydamlık korunur), WebP kodlayamayan tarayıcıda JPEG/PNG; EXIF yönü uygulanır; GIF dokunulmaz; küçülen dosya büyürse özgün kalır. Kaynak sınırı 25MB, çıktı 5MB. Headless Chromium'da: 4032x3024 JPEG → 1200x900 WebP ~0,1 sn.
- Adres lib/files.ts (productImageUrl: dosya → yoksa image_url; hasProductImage). Form değeri lib/image-value.ts: "" kaldır, blob: seçilmiş dosya, https AI bağlantısı, diğer mevcut dosya adı; kayıt yükü imagePatch(value, ad, dosyaAlanı, bağlantıAlanı?) yalnızca değişeni yazar. Taslaktan dönen ölü blob kayıtlı görseli silmez.
- Kaldırılanlar: /api/upload, lib/upload.ts, lib/minio.ts, tests/upload-path.test.ts; uygulama MINIO_* okumaz (yalnızca göç scripti). Sözleşme: tests/image-files.test.ts.
- YAYIN SIRASI: (1) scripts/migrate-image-files.mjs --dry-run, sonra gerçek (MINIO_ENDPOINT + geçerli MINIO_ACCESS_KEY/SECRET_KEY zorunlu: eski s3.harbidigital.com/buyur/<slug>/… yüklemeleri dışa kapalı, anahtarla okunur, sharp ile küçültülüp dosya alanına yüklenir; ürünlerdeki Pexels/Wikimedia bağlantıları image_url'e kopyalanır). (2) deploy. (3) göçü bir kez daha. (4) kontrol sonrası --drop-legacy (taşınamayan varsa durur; --force): eski MinIO kopyalarını siler, logo_url/cover_url/kategori-pop-up image_url/ürün images alanlarını kaldırır.
- Canlı göç (2026-10-02): 195 AI görseli image_url'e yazıldı. Eski 40 MinIO yüklemesi (Prime Grill 27, Ünal Kebap 3; Demo, Reality Döner, Zeus Garden, Invest Garden, İkizdere Kaymakamlığı logo+kapak) bucket'ta yok — buyur bucket'ı PocketBase bağlanırken boş yeniden kurulmuş, sürümleme kapalı. Kararla gözden çıkarıldı: yeniden yüklenecek, eski alanlar --drop-legacy --force ile kaldırılacak.

## [0.11.0] — 2026-09-27

**buyur ekibi hesabınızı ve menünüzü sizin için kurabiliyor**

- **Yeni:** Hesabınızı buyur ekibi sizin yerinize açabilir: planınız ve menü diliniz seçilmiş, menü adresiniz hazır olarak. Size giriş bilgileriniz iletilir; ilk girişte şifrenizi değiştirebilirsiniz.
- **Yeni:** Mevcut menünüz tek seferde aktarılabilir: başka bir QR menü sitesindeki menünüzün bağlantısı, menü dosyası, fotoğrafı ya da düz metni yeter. Okunamayan fiyatlar tahmin edilmez; ekibimiz kontrol edip tamamlar.
- **Yeni:** Aktarım sırasında ürünlerinize uygun görseller otomatik aranabilir; istemediğiniz görsel yayına girmeden kaldırılır.
- **İyileştirme:** Sayfa adreslerindeki bölüm ve sekme adları İngilizceye geçti (ör. buyur.in/#pricing, ayarlarda ?tab=contact). Daha önce kaydettiğiniz ya da paylaştığınız eski bağlantılar aynı yere açılmaya devam ediyor.

Geliştirici notu:

- Yönetim: /admin/businesses/new (NewBusinessWizard) + POST /api/admin/businesses (yeni yetki business.create, yalnızca super_admin; runAuditedCreate, admin'in kendi token'ı — createRule TRUSTED_ADMIN). Kurallar lib/admin-onboarding.ts: OTP yok, telefon engellemez (adminPhone: TR ise biçimlenir, değilse olduğu gibi, boş olabilir), menü tek dilde (languages: []), kurulum alanları dolu açılır (slug/template/main_language/activation.sector). Kayıtlı e-posta PocketBase'de validation_not_unique dönerse giriş e-postası artı adresli takma ada geçer (loginEmailAlias: sahip+slug@alan, gerekirse -2…); ekran giriş adresini gösterir. İşletmeye e-posta gitmez.
- Menü asistanı sayfanın içinde (MenuAssistant: avatarlı sohbet, harf harf akan yanıt, yazıyor göstergesi, içerikle uzayan mesaj kutusu; animasyonlar globals.css → chat-in/ai-float/ai-orbit/typing-dot, hareket azaltmada kapalı); önizleme (MenuPreviewModal) ve son onay (oluştur / menüye yaz) pencerede. Durum useMenuSession'da. POST /api/admin/menu-assistant (business.content). Kaynaklar: ek dosya (vision), JSON (bizim biçim → modelsiz), bağlantı, düz metin. Bağlantı okuma kademeli (lib/ai/menu-extract.ts → readMenuLink): düz okuma (SSRF korumalı, HTML + JSON-LD/__NEXT_DATA__) → ürün çıkmazsa sayfayı gerçek tarayıcıda açan Jina Reader (r.jina.ai; JINA_API_KEY isteğe bağlı, MENU_LINK_RENDERER=off kapatır; yalnızca herkese açık, güvenlik kontrolünden geçmiş adres gider) → sayfadaki menü görselleri (en çok 4, vision). "www." ile başlayan protokolsüz adres de bağlantı sayılır. Düzenleme komutları işlem listesi olarak alınır, lib/ai/menu-assistant.ts'te deterministik uygulanır. Model: OPENAI_ASSISTANT_MODEL ?? OPENAI_MENU_MODEL. Denetim: ai.menu_assist.
- Toplu görsel: POST /api/admin/menu-assistant/images (kayda yazmaz). Aktarım: POST /api/admin/businesses/[id]/import — kategori başına bir istek, buildImportPlan ile idempotent, sıralı withRetry(verify), tek denetim kaydı category.import; kayıt yazılamazsa bu istekte açılanlar silinir.
- Var olan işletmede de: /admin/businesses/[id]/menu → "Asistanla menü aktar" (AdminMenuImport, aynı tam ekran asistan).
- Taşımalar: parsePages → lib/ai/menu-scan.ts parseMenuPages (i18n panel kapsamına eklendi); toEnglishFoodQuery → lib/ai/image-query.ts. Kit Textarea ref kabul eder (ComponentProps<"textarea">). Şema değişikliği ve göç yok.
- Adresler İngilizce (lib/url-params.ts, tests/url-params.test.ts): panel ayarları ?tab=general|languages|theme|marquee|amenities|contact|social|panel; landing çapaları her dilde İngilizce (lib/landing-sections.ts, eski /#fiyat → LegacyAnchorRedirect ile /#pricing); yönetim filtreleri status/sort/page/from/to/business/user/actor/action/resource/target/type, sistem ?tab=team, yetkisiz uyarısı ?denied=1. Eski Türkçe adlar readParam ile okunmaya devam eder; yeni bağlantı Türkçe üretilmez (CLAUDE.md §9).

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
