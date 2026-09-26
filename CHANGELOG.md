# Sürüm notları

> Bu dosya `lib/release-notes.ts`'ten üretilir (`bun run changelog`). Elle düzenlemeyin.
> Kullanıcıya görünen hâli: https://buyur.in/docs/surum-notlari

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
