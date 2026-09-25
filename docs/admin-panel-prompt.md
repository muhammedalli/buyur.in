# Görev: buyur için admin paneli (admin.buyur.in)

buyur reposunda platform yöneticileri için bir admin paneli kuracaksın. Başlamadan
önce CLAUDE.md'yi, `.claude/skills/buyur-veri-modeli` ve `buyur-panel-sayfasi`
skill'lerini oku. Oradaki kurallar bu metinden önce gelir: kullanıcıya görünen
metinler Türkçe, yorumlar Türkçe ve "neden"i anlatır, filtreler `pb.filter()` ile
yazılır, ham renk kodu kullanılmaz, UI `components/panel/ui.tsx` kitinden kurulur.

## Mevcut durum (önce doğrula)
- `middleware.ts`: `admin.buyur.in` → `/admin/*` yönlendirmesi, `buyur_admin_auth`
  çerezi ve üretimde kök alandaki `/admin`'den alt alana yönlendirme hazır. Buradaki
  kontrol yalnızca kolaylık yönlendirmesi.
- `buyur_admins` auth koleksiyonu var, rolleri `super_admin` ve `support`.
- `scripts/setup-pocketbase.mjs` içindeki kuralların çoğunda `ADMIN_BYPASS` var.
  `buyur_plans` tablosuna yalnızca `super_admin` yazabiliyor.
- `getServicePB()` (`lib/pocketbase-server.ts`) servis hesabıyla **`buyur_admins`
  üzerinden** oturum açıyor. Yani servis hesabı da bir admin kaydı.
- Aşama 1'de kapatılan eksikler: `app/admin/` (giriş, konsol kabuğu, genel bakış,
  denetim kaydı), `lib/admin-auth.ts` (`requireAdmin`), `lib/admin-roles.ts`,
  `lib/admin-session.ts`, `lib/admin-audit.ts`, `buyur_admin_logs` şeması,
  `scripts/create-admin.mjs`, `scripts/migrate-admin.mjs`.

## Mimari kurallar (pazarlığa kapalı)
1. Her admin sayfası ve admin route handler'ı sunucu tarafında
   `requireAdmin({ role? })` çağırır. Asıl güvenlik kontrolü middleware değil,
   bu çağrıdır.
2. Admin yazma işlemleri tarayıcıdan doğrudan PocketBase'e **gitmez**. Akış:
   `/api/admin/*` route handler → `authenticateAdminRequest(req, { action })` →
   dönen `session.pb` ile `runAuditedUpdate()` → `buyur_admin_logs` kaydı.
   `BUSINESS_PROTECTED_FIELDS` alanları (plan, süre ve sayaçlar) yalnızca bu yolla
   yazılır.
   *(Aşama 1 kararı: ilk taslaktaki "getServicePB() ile yaz" yerine admin'in kendi
   token'ı kullanılır. Servis hesabı `support` rolünde; diğer admin kayıtlarını
   okuyamaz, `buyur_plans`'a yazamaz ve kimin yaptığı bilinmeyen yazımlar üretirdi.
   Token tarayıcıya hiç gitmez; şifreli httpOnly çerezde durur.)*
3. Denetim kaydı yazılamazsa işlem başarılı sayılmaz. *(Aşama 1 kararı: değişiklik
   geri alınır; geri alma da düşerse ayrı bir hata döner. Giriş/çıkış kaydı en iyi
   çabayla yazılır: geri alınacak bir şey yoktur ve kayıt koleksiyonundaki bir arıza
   yöneticileri panelin dışında bırakmamalıdır.)*
4. Toplu işlemler sırayla yapılır. `withRetry(..., { verify })` kullanılır,
   `Promise.all` ile toplu yazma yapılmaz. Sonda "X güncellendi, Y güncellenemedi"
   gösterilir.
5. Plan kuralları için `if (plan === ...)` yazılmaz. `entitlementsFor()` /
   `isFeatureAvailable()` kullanılır ve önce `ensurePlanCatalog` çağrılır.
6. Servis hesabı admin listesinde görünmez; panelden düzenlenemez, silinemez.
7. Rol matrisi:
   - `support`: işletmeleri görür, not ekler, şifre sıfırlama e-postası gönderir,
     deneme süresini uzatır, AI kotasını sıfırlar.
   - `super_admin`: `support`'un yapabildiği her şey, ayrıca plan atama, askıya alma,
     silme, plan ve fiyat düzenleme, admin yönetimi.
8. Okuma istekleri `Promise.all` ile paralel yapılır. Sayfa başına PocketBase istek
   sayısını `pbRequestCount()` ile ölç.

## Aşamalar
Her aşamanın sonunda dur ve bana kısa bir rapor ver: ne yapıldı, nasıl doğrulandı,
açık kalan sorular neler. Onay gelmeden sonraki aşamaya geçme.

### Aşama 1: Temel ✅ (2026-09-25)
- `lib/admin-auth.ts`: `requireAdmin({ role })`. Çerezden admin oturumunu doğrular,
  `buyur_admins` kaydını ve rolünü döner. Yetki yoksa login sayfasına yönlendirir
  (sayfalarda) ya da 401/403 döner (API'de).
- `/admin/login`: e-posta ve şifreyle giriş, ardından `buyur_otps` altyapısıyla OTP
  adımı. Çıkış yapma.
- `buyur_admin_logs` koleksiyonu. Alanlar: `admin`, `action`, `target_collection`,
  `target_id`, `before` (json), `after` (json), `reason`, `ip`, `created`.
  Yalnızca kayıt eklenebilir; update ve delete kuralları kapalıdır. Bunu
  setup-pocketbase.mjs'e ekle ve idempotent bir göç scripti yaz.
- `scripts/create-admin.mjs`: superuser token ile ilk `super_admin` hesabını açar,
  idempotent çalışır.
- `/admin` layout'u: kenar menüsü, üstte admin adı ve rolü.

### Aşama 2: İşletmeler
- **Liste:** ad, slug veya e-postayla arama. Plan, `is_active`, kurulum tamamlandı mı
  (`isBusinessSetUp`), kayıt tarihi ve son etkinliğe göre filtre. Sunucu tarafında
  sayfalama.
- **Detay sayfası:**
  - Hesap bilgileri ve canlı menü bağlantısı
  - Ürün ve kategori sayıları
  - QR kodları
  - Son 30 günün analitik özeti (mevcut rapor fonksiyonlarını kullan)
  - Değerlendirmeler
  - Bu işletmeyle ilgili admin işlemlerinin geçmişi
- **İşlemler:** her biri gerekçe alanı ister ve `useConfirm()` ile onay sorar.
  - Plan atama
  - Deneme süresini ve `plan_expires_at` tarihini uzatma
  - AI kotasını sıfırlama
  - Askıya alma veya yayından kaldırma
  - Slug değiştirme (`RESERVED_SLUGS` ve tekillik kontrolüyle)
  - Şifre sıfırlama e-postası gönderme
  - İç not ekleme
- "İşletme olarak gör" özelliği yalnızca okuma yapar ve her kullanımı loglanır.
  Bu aşamada kapsam dışı; yalnızca nasıl yapılacağını öner.

### Aşama 3: Planlar ve fiyatlar (yalnızca `super_admin`)
- `buyur_plans` düzenleme ekranı: ad, açıklama, `price_monthly`,
  `price_yearly_monthly`, `trial_months`, `is_active`.
- `limits` ve `features` ham JSON olarak düzenlenmez. Form, `Feature` union'ından
  ve `FEATURE_LIMIT_KEYS` eşlemesinden üretilir.
- Kaydetmeden önce etkiyi göster: "bu değişiklik N işletmeyi etkiler".
- Canlı kayıt `DEFAULT_PLAN_ENTITLEMENTS` yedeğinden farklıysa kayma uyarısı göster.
- Değişikliğin en geç 60 saniyede yansıyacağını belirten not ekle.

### Aşama 4: Genel bakış
- Toplam işletme; bugün ve bu hafta açılan hesaplar; yayında olanlar; kurulumu yarım
  kalanlar.
- Plan dağılımı ve freemium'dan ücretli plana geçiş oranı.
- Önümüzdeki 7 ve 30 günde planı bitecek işletmeler, işletme detayına bağlantılı.
- Toplam menü görüntüleme, QR tarama ve AI tarama kullanımı.

### Aşama 5: Sonraki işler (şimdilik yalnızca planla, kodlama)
- Kayıt hunisi (OTP → doğrulama → kurulum → ilk ürün → ilk QR taraması)
- Kayıp takibi
- İşletme ve gün bazında AI maliyeti
- Rollup durumu ve elle tetikleme
- Brevo teslim durumu
- Görsel ve içerik denetimi
- Admin kullanıcı yönetimi
- Tüm işletmelere duyuru
- Sistem sağlık ekranı

## Doğrulama
- `bun run test` ve `bun run build` geçmeli. Eklenen iş kuralları için sözleşme
  testleri yaz: rol matrisi, protected field yazımı, log zorunluluğu, servis
  hesabının gizlenmesi.
- Kural testlerini mock ile değil, gerçek yerel PocketBase (v0.39.4) ile yap. Mock,
  kural hatalarını gizler.
- Özellikle şunları kanıtla:
  (a) işletme hesabı `/admin` sayfalarına ve `/api/admin/*` uçlarına erişemiyor;
  (b) `support` rolü, `super_admin`'e ait işlemleri yapamıyor;
  (c) `ADMIN_BYPASS` bir admin tokenının tarayıcıdan protected alanlara doğrudan
      yazmasına izin veriyor mu? İzin veriyorsa bunu raporla ve kapatmayı öner.
- Dev sunucusunu elle başlatma; `.claude/launch.json` içindeki `dev` yapılandırmasını
  kullan.

## Belirsizlikte
Tahmin etme. Kararı gerekçesiyle rapora yaz ve bana sor: log yazılamazsa ne olacağı,
OTP'nin zorunlu olup olmadığı, askıya alınan işletmenin menüsünde ne gösterileceği
gibi.
