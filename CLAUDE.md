# buyur — Proje Rehberi

> **buyur**, restoran/kafe işletmeleri için QR tabanlı dijital menü platformu.
> Üç yüzü var: **müşteri menüsü** (`buyur.in/isletme` veya `isletme.buyur.in`),
> **işletme paneli** (`/panel`) ve **pazarlama sitesi** (kök alan adı).

Bu dosya, kod yazmaya başlamadan önce bilinmesi gereken mimari kararları ve
kuralları içerir. Ayrıntılı iş akışları için `.claude/skills/` altındaki
skill'lere, alan uzmanlıkları için `.claude/agents/` altındaki agent'lara bakın.

---

## 1. Teknoloji Yığını

| Katman | Seçim |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Dil | TypeScript (strict) |
| Stil | Tailwind CSS v4 (`@theme` token'ları, `app/globals.css`) |
| Veritabanı | PocketBase (`buyur_*` koleksiyonları) |
| Dosya deposu | MinIO (S3 uyumlu) — `lib/minio.ts` |
| AI | OpenAI (yalnızca sunucu tarafında) |
| Test | Vitest (`tests/`) |
| Paket yöneticisi | **bun** (`bun.lock` kaynak; `pnpm-lock.yaml` eskidir) |

### Komutlar

```bash
bun run dev      # geliştirme sunucusu (port 3000)
bun run build    # üretim derlemesi
bun run test     # vitest run — PR öncesi zorunlu
bun run lint     # next lint
bun run brand    # marka görsellerini yeniden üret
```

> Geliştirme sunucusunu elle başlatmayın; ajanslar `preview_start` ile
> `.claude/launch.json` içindeki `dev` yapılandırmasını kullanır.

---

## 2. Mimari Haritası

```
app/
  [slug]/            → MÜŞTERİ MENÜSÜ (welcome, menu, categories, products, cart, search, review)
  panel/(auth)/      → giriş / kayıt
  panel/(dashboard)/ → İŞLETME PANELİ (client component'ler, pb ile doğrudan konuşur)
  site/[slug]/       → işletmeye otomatik üretilen tanıtım sitesi
  api/               → track, upload, ai/scan, analytics
  blog/, yasal/      → pazarlama & hukuki içerik
components/
  menu/              → müşteri menüsü bileşenleri (MenuProvider bağlamı)
  panel/             → panel UI kiti, formlar, grafikler
  site/              → otomatik site bölümleri
lib/
  analytics/         → event sözlüğü, ingestion, rollup, raporlar, insights
  entitlements.ts    → PLAN KURALLARININ TEK KAYNAĞI
  i18n.ts            → çoklu dil alan çözümleme (tField)
  types.ts           → tüm veri modelleri
scripts/             → PocketBase şema kurulumu, göçler, seed verileri
pocketbase/pb_hooks/ → PocketBase SUNUCUSUNA kurulan hook'lar (denetim kaydı; docs/audit-log.md)
tests/               → Vitest — iş kurallarının yazılı sözleşmesi
docs/                → mimari ve ürün notları (analytics-architecture.md = koddaki §N atıfları)
```

### Çok kiracılı (multi-tenant) yönlendirme

`middleware.ts` host'a bakar:

- `isletme.buyur.in/...` → `/isletme/...` rewrite (`x-buyur-rewrite: subdomain` başlığı eklenir)
- `isletme.buyur.in/site` → `/site/isletme`
- `admin.buyur.in` → `/admin/*` (izole uygulama; `requireAdmin()` asıl kontrol)
- `panel.` / `app.` gibi **rezerve** subdomain'ler (`lib/slug.ts`) kök alana yönlendirilir
- Panel asla subdomain'de yaşamaz

Yeni bir üst düzey rota eklerken slug çakışmasını `RESERVED_SLUGS`'a ekleyerek önleyin.

---

## 3. Veri Katmanı Kuralları

**Koleksiyonlar** (hepsi `buyur_` önekli): `businesses`, `categories`, `products`,
`product_options`, `popups`, `admins`, `plans`, `settings`, `events`, `sessions`,
`stats_daily`, `qr_codes`, `reviews`, `admin_logs`, `admin_notes`, `otps`.

`buyur_settings` sistem geneli değişkenlerdir (ör. yıllık ödeme indirimi): anahtar/değer
satırları, tanımları ve yedek değerleri `lib/system-settings.ts`'te. Herkese okunur
(fiyat sayfası da okur) — **gizli değer yazılmaz**; yalnızca super_admin yazar
(`/api/admin/settings`, denetim kaydıyla). Yeni ayar = tanım + onu okuyan kod; şema değişmez.

**1 işletme hesabı = 1 `buyur_businesses` kaydı = 1 kimlik.** `buyur_businesses` bir
**auth** koleksiyonudur: giriş e-postası/şifre ve işletmenin tüm bilgileri aynı kayıtta.
Ayrı kullanıcı tablosu ve `owner` alanı **yoktur**; bağlı koleksiyonlarda sahiplik
`business = @request.auth.id` ile ifade edilir. Kural cümleleri `scripts/business-schema.mjs`'te.
Menüde görünen iletişim e-postası `publicContactEmail()` ile okunur (`lib/business-account.ts`).

Üç farklı PocketBase istemcisi vardır — **doğru olanı seçmek kritiktir**:

| İstemci | Nerede | Ne zaman |
|---|---|---|
| `pb` (`lib/pocketbase.ts`) | tarayıcı, panel client component'leri | kullanıcının kendi yetkisiyle okuma/yazma |
| `createServerPB()` | route handler / server component | her istek için taze istemci; `authStore` sızmasın |
| `getServicePB()` (`lib/pocketbase-server.ts`) | yalnızca sunucu | servis hesabı; event yazımı, agregasyon |
| `requireAdmin()` / `authenticateAdminRequest()` (`lib/admin-auth.ts`) | admin sayfaları, `/api/admin` | admin'in kendi yetkisi; yalnızca sunucuda yaşar |

Kurallar:

1. **Filtreleri her zaman `pb.filter()` ile parametreli yazın.** String birleştirme yok.
2. Route handler'da kimlik: `lib/business-auth.ts` → `authenticateBusiness(authHeader)`; oturumun sahibi işletme kaydının kendisidir, istekteki işletme kimliği oturumun kimliğine eşit olmalı. (`app/api/upload/route.ts` referans akıştır.)
3. Menü ziyaretçisi PocketBase'e **doğrudan yazmaz**; `buyur_events` yazımı `/api/track` üzerinden servis hesabıyla yapılır.
4. Şema değişikliği = `scripts/setup-pocketbase.mjs` güncellemesi + gerekiyorsa **idempotent** bir göç scripti. `getOrCreate` var olan alanın `select` seçeneklerini güncellemez — bunun için ayrı göç adımı gerekir.
5. Kayıt tarayıcıdan yapılmaz: `buyur_businesses.createRule` servis hesabına kilitlidir, hesap `/api/auth/register` üzerinden OTP doğrulandıktan sonra açılır (`buyur_otps` yalnızca kodun sha256 özetini tutar). Ad/slug kurulum ekranında dolana kadar kayıt yayında değildir (`isBusinessSetUp`).
9. **Plan ve sayaç alanları hesap sahibine kapalıdır** (`plan`, `freemium_started_at`, `plan_expires_at`, `menu_views`, `ai_scans_used`, `ai_scans_period` — `BUSINESS_PROTECTED_FIELDS`). Bunları yalnızca sunucu servis hesabıyla (`getServicePB()`) yazar; panelden yazmaya çalışmak 404 döner.
6. Altyapı hatasında **kısıtlama değil, serbestlik** varsayılır (`lib/plan-catalog-loader.ts`: plan kaydı okunamazsa son bilinen/yedek katalog geçerli kalır): ödeme yapan işletme geçici bir ağ hatası yüzünden panelini kaybetmemeli.
7. **Toplu yazma sıralıdır ve çift kayıt üretmez.** PocketBase ani yükte 503 verir ve 503 "yazılmadı" demek değildir. `Promise.all` ile toplu `create` yok; `lib/pb-retry.ts` → `withRetry(..., { verify })` ile sar (tekrardan önce kaydın var olup olmadığına bak), tek kaydın düşmesi döngüyü durdurmaz, sonda "X eklendi, Y eklenemedi" söylenir
8. **Ürün ve kategori adı işletme bazında tektir** (`lib/unique-name.ts`, karşılaştırma `normalizeEntryName`); menü aktarımı da bunu uygular (`lib/ai/import-plan.ts`)
10. **Önemli her işlem merkezi denetim kaydına düşer** (`buyur_admin_logs`, [`docs/audit-log.md`](./docs/audit-log.md)): yönetim ucu değişikliği `runAuditedUpdate/Create/Delete` ile (kayıt yazılamazsa geri alınır), sunucu akışı `recordSystemAudit` ile yazar; işletme panelinin yazmalarını ve girişlerini PocketBase hook'u yazar. Dağınık kayıt kodu yazılmaz. Yeni eylem = `lib/audit-log.ts` sözlüğüne etiket; hook'a yeni koleksiyon = `AUDITED_COLLECTIONS` + hook listesi (`tests/audit-hook.test.ts` kilitler)

---

## 4. Plan ve Yetki Sistemi

**Kaynak `buyur_plans` koleksiyonudur** (admin panelinden değişir); `lib/entitlements.ts`
onu okuma kapısıdır. Panel, menü, analytics API'si, raporlar ve landing sayfası hepsi
buradan okur.

- Planlar: `freemium` → `premium` → `elite`
- Süre `trial_months` alanında (0 = süresiz); yetenek bayrakları, `menu_views`, saklama süresi ve AI kotası `limits` JSON'unda
- Kayıtlar `lib/plan-catalog-loader.ts` ile yüklenir (`ensurePlanCatalog`, 60 sn süreç önbelleği). Yeni bir sunucu/istemci giriş noktası plan kuralı okuyacaksa önce onu çağırın
- `entitlements.ts` içindeki `DEFAULT_PLAN_ENTITLEMENTS` yalnızca **yedek**tir (kayıt okunamazsa / alan eksikse). `scripts/plan-catalog.mjs` tohum kataloğu ile birebir aynı kalmalı — `tests/plan-catalog.test.ts` kilitler
- Yetenekler `Feature` union'ında tanımlı; yeni kilitlenebilir özellik = `Feature` + yedek matris + `FEATURE_LIMIT_KEYS` eşlemesi + tohum katalog + canlı kayıtlar
- Fiyatlar da `buyur_plans`'tan gelir; kodda rakam yok. Her planın **tek fiyatı** vardır (`price_monthly`); yıllık ödemenin aylık karşılığı `buyur_settings` → `yearly_discount_percent` (yedek %20) ile hesaplanır (`lib/pricing.ts` → `yearlyMonthlyPrice`). Eski `price_yearly_monthly` alanı okunmaz ve yazılmaz. Ayarlar plan kataloğuyla aynı turda yüklenir (`ensurePlanCatalog`). `planPricing(plan)` ücretli planda kayıt okunamadıysa `null` döner — ekranlar rakam uydurmaz, "bize yazın" der. Yasal fiyat tablosu (`lib/legal.ts`) render anında aynı kayıttan kurulur

> Hiçbir yerde `if (plan === "premium")` yazmayın. `isFeatureAvailable()` /
> `entitlementsFor()` kullanın. Kural değişiyorsa önce ilgili sözleşme testi değişir.

---

## 5. Çoklu Dil

- Desteklenen diller: `tr`, `en`, `ar`, `ru` (`ar` RTL)
- Ana metin (`name`, `description`) işletmenin **ana dilinde** tutulur; diğer diller `translations` JSON alanından okunur
- Okuma her zaman `tField(entity, field, locale, baseLocale)` ile yapılır — çeviri yoksa ana dile düşer
- Çevrilebilir alanlar: `name`, `description`, `campaign_label`, `group_name`, `title`, `message`
- Ana dil değişince içerik `lib/language-rebase.ts` ile yeni baz dile taşınır

---

## 6. Analitik

- Event sözlüğü: `lib/analytics/events.ts` — **tek kaynak**
- `qr_scan`, `session_start`, `session_end` yalnızca sunucu üretir; istemciden gelirse reddedilir
- Akış: istemci → `/api/track` → `buyur_events` → `rollup` → `buyur_stats_daily`
- Sözlüğe event eklemek PocketBase `select` alanının da güncellenmesini gerektirir (`scripts/migrate-analytics.mjs`)
- Uçtan uca mimari, gizlilik sınırı ve §N atıfları: [`docs/analytics-architecture.md`](./docs/analytics-architecture.md)
- Gecikmenin ana kaynağı hesaplama değil, **sıralı PocketBase turlarıdır** (~250ms/tur). `pbRequestCount()` ile ölçün, istekleri `Promise.all` ile paralelleştirin.

---

## 7. Tasarım Dili

Token'lar `app/globals.css` içindeki `@theme` bloğunda:

| Token | Anlam |
|---|---|
| `paper` `#fbf5ea` | sıcak kâğıt zemini |
| `crema` `#f4ead9` | kart zemini |
| `ink` `#231812` / `ink-soft` | espresso mürekkep (saf siyah değil) |
| `paprika` `#e8491f` / `paprika-deep` | marka turuncusu |
| `herb` `#3e7c4f` | onay / taze |
| `line` `#e0d3bf` | kenarlık |

- Yazı tipleri: `font-display` (Bricolage), `font-body` (Figtree), `font-mono` (JetBrains)
- İşletmenin kendi rengi `var(--brand)` üzerinden gelir; menü tarafında marka rengini sabit token'la ezmeyin
- Panel bileşenleri **her zaman** `components/panel/ui.tsx` kitinden gelir: `Button` (`size="sm"` küçük hâli; dolguyu className ile ezmeyin), `AiButton`, `AiActionButton`, `Card`, `PageHeader`, `SectionHeader`, `Input`, `Select`, `Switch`, `Tabs`, `EmptyState`, `UpgradeNotice`, `FormActions`, `StatGroup`, `Table`, `Dropdown`, `Modal`. Yeni buton/inputs elle yazılmaz.
- **Köşe yarıçapı standardı 6px** (`rounded-md`): buton, alan, kart, tablo, pencere, açılır menü. Hap (`rounded-full`) yalnızca anahtar, ilerleme çubuğu, durum noktası ve avatar gibi gerçekten yuvarlak öğelerde.
- **Giriş/kayıt/şifre ekranları** onaylı görseli birebir izler ve kendi parçalarını kullanır (`components/panel/auth-form.tsx`: editoryal serif başlık `font-editorial`, ikonlu geniş alanlar, oklu ana buton; görsel kartı `auth_bg.png`). Bu ekranlar ürünün kapısıdır; yönetim ekranlarının 6px kuralı burada geçerli değildir. "Beni hatırla" `lib/auth-persistence.ts` ile çalışır (işaretsizse tarayıcı kapanınca oturum düşer).
- Panel ve yönetim ekranları sade kalır: sayıları tek tek küçük kartlara bölmek yerine `StatGroup` (tek çerçevede özet şeridi), listeler için geniş `Table`. Ekranı doldurmak için grafik/metrik eklenmez; ikincil işlemler `Dropdown` altında toplanır.
- Ham renk kodu (`#fff`, `bg-[#...]`) yazmayın; token kullanın.

---

## 8. Panel Form Deseni

1. `useBusiness()` ile aktif işletme
2. `useFormDraft()` ile otomatik taslak — **yarım girilmiş veri canlı menüye yazılmaz**; `dirty` kaydedilmemiş değişikliği söyler
3. `useToast()` ile geri bildirim, `useConfirm()` ile yıkıcı işlem onayı
4. `FormActions` yapışkan eylem çubuğudur (masaüstünde başlığın altında, mobilde ekranın altında): durum satırı (`dirty`/`savedAt`/`draftSavedAt`/`error`) + kaydet. Form `FORM_STACK` (flex) olmalı; kayıt durumu ayrıca formun altına yazılmaz
5. Kayıt başarılıysa taslak temizlenir ve form kayıtlı hâle eşitlenir (kayıttan dönen değerle)
6. Alana bağlı yapay zekâ eylemi alanın yanında durur (ör. `MultiLangFields` → `translate` ile "AI ile tamamla" grubun sağ üstünde); aynı eylem eylem çubuğunda tekrar edilmez. Async AI butonu tek istek uçurur, zaman aşımı ve anlamlı hata mesajı taşır (`components/panel/ai/translate-button.tsx`). "Tamamla" **yalnızca boş çevirileri** doldurur, dolu olanı ezmez (`missingTranslations` / `fillMissingTranslations`, `tests/ai-translate.test.ts`). Çok dilli yeni bir alan = `MultiLangFields` + `translate`
7. Açık bir formu taşıyan sayfa kaydı `business` NESNESİNE değil `business.id`'ye bağlı yükler ve ilk yüklemeden sonra formu sökmez: oturum tazelenince (sekmeye dönüş) form sökülürse kaydedilmemiş her şey silinir

---

## 9. Yazım ve Dil Kuralları

- **Kullanıcıya görünen tüm metinler Türkçe** (panel, menü, hata mesajları dâhil)
- Kod yorumları Türkçe; **neden** açıklanır, ne yapıldığı değil
- Değişken/fonksiyon adları İngilizce, camelCase
- Hata mesajları kullanıcı diliyle konuşur: "Giriş yapmalısınız." — yığın izi değil

---

## 10. Güvenlik Sınırları

- API anahtarları (`OPENAI_API_KEY`, `BREVO_API_KEY`, MinIO, servis hesabı) **asla** `NEXT_PUBLIC_` önekiyle tanımlanmaz
- AI çağrıları yalnızca route handler içinde
- Yükleme: 5MB sınırı, izinli MIME listesi, `kind` doğrulaması, sahiplik kontrolü
- AI ile üretilen içerik **varsayılan olarak taslaktır**; kullanıcı onayı olmadan yayına alınmaz
- Okunamayan/belirsiz veriyi AI'ya **tahmin ettirmeyin**; kullanıcıya işaretleyin
- **Yönetim paneli** (`admin.buyur.in`, plan: `docs/admin-panel-prompt.md`): giriş = şifre + e-posta kodu. Admin'in PocketBase token'ı şifreli httpOnly çerezde durur (`lib/admin-session.ts`) ve **tarayıcıya verilmez**: `ADMIN_BYPASS` kuralı rol ayırmaz, rolü sunucu uygular. `ADMIN_SESSION_SECRET` (≥32 karakter) yoksa admin girişi kapalıdır
- Askıya alınan işletme (`suspended_at`, yalnızca super_admin yazar) herkese açık her yüzeyde `isSuspended()` ile elenir (`lib/business-suspension.ts`): menü, site, `/api/track`, vitrin, sitemap. Yeni bir herkese açık işletme listesi ekleyen de bunu uygular
- İşletme silme **yumuşaktır** (`deleted_at`, `lib/business-deletion.ts`): silme askıyı da koyar (ayrı bir yüzey kontrolü yok), `authRule` girişi kapatır, hook açık token'ları düşürür; geri alınabilir. Yönetici hesabı silinmez, erişimi kapatılır (`disabled_at`); kimse kendi rolüne/erişimine dokunamaz, servis hesabı panelde görünmez (`lib/admin-users.ts`)
- Admin yetkisi `canPerform(role, action)` ile okunur (`lib/admin-roles.ts`); `if (role === "super_admin")` yazılmaz. Admin'in yaptığı her değişiklik `runAuditedUpdate()` ile yazılır (`lib/admin-audit.ts`): denetim kaydı yazılamazsa değişiklik **geri alınır**

---

## 11. Değişiklik Yaparken

- Mevcut mimariyi kullanın; paralel yeni bir yapı kurmayın
- İş kuralı değiştiyse `tests/` altındaki ilgili sözleşme testini güncelleyin
- `bun run test` ve `bun run build` yeşil olmadan iş bitmiş sayılmaz
- Menü sayfası mobilde **2 saniyenin altında** açılmalı; trafiğin %95+'ı mobildir
