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

### Aşama 2: İşletmeler ✅ (2026-09-25)
*Kararlar:* askıya alma `is_active`'ten ayrı, korumalı `suspended_at` +
`suspension_reason` alanlarıyla (sahibi ve destek yazamaz; menü/site kapanır,
görüntülenme sayılmaz, sahibine panelde bant gösterilir). İç notlar yalnızca
eklenebilen `buyur_admin_notes` koleksiyonunda; not kendisi iz olduğu için ayrı
denetim kaydı yazılmaz. Liste e-posta araması için servis hesabıyla okunur ve
bellekte süzülür. Kurallar: `lib/admin-business-actions.ts`,
`lib/admin-business-list.ts`.
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
  *Öneri:* işletmenin token'ını üretmek (PocketBase impersonate) YERİNE panel
  ekranlarının salt-okur bir kopyası `/admin/businesses/[id]/panel` altında,
  veriyi servis hesabıyla okuyan sunucu bileşenleriyle kurulmalı. Böylece admin
  işletme adına hiçbir şey yazamaz (yazma yolu yok), token üretilmez ve her
  açılış `business.view_as` olarak loglanır. Panel bileşenleri `useBusiness()`
  bağlamına bağlı olduğundan, bağlamı sunucudan gelen kayıtla dolduran salt-okur
  bir sağlayıcı gerekir.

### Aşama 3: Planlar ve fiyatlar (yalnızca `super_admin`) ✅ (2026-09-25)
*Kararlar:* kurallar `lib/admin-plan-edit.ts`. Varsayılan plan pasif yapılamaz;
formun bilmediği limit anahtarları korunur; boş sayı alanı "sınırsız" sayılmasın
diye istemcide engellenir. (Aşama 6: yıllık fiyat ayrı alan değil, indirimden türetilir.)
`is_default` değiştirme bilerek yok (tek varsayılan kuralı için ayrı akış gerekir).
- `buyur_plans` düzenleme ekranı: ad, açıklama, `price_monthly`, `trial_months`,
  `is_active`.
- `limits` ve `features` ham JSON olarak düzenlenmez. Form, `Feature` union'ından
  ve `FEATURE_LIMIT_KEYS` eşlemesinden üretilir.
- Kaydetmeden önce etkiyi göster: "bu değişiklik N işletmeyi etkiler".
- Canlı kayıt `DEFAULT_PLAN_ENTITLEMENTS` yedeğinden farklıysa kayma uyarısı göster.
- Değişikliğin en geç 60 saniyede yansıyacağını belirten not ekle.

### Aşama 4: Genel bakış ✅ (2026-09-25)
*Kararlar:* hesaplar `lib/admin-overview.ts`; "bugün" İstanbul gününe göre.
"Ücretli oran" = kurulumu bitmiş hesaplar içinde süre/görüntülenme sınırı olmayan
plandakiler (plan adına bakılmaz). Platform etkinliği günlük özetlerin toplamı;
binlerce işletmede ayrı bir platform özeti gerekecek.
- Toplam işletme; bugün ve bu hafta açılan hesaplar; yayında olanlar; kurulumu yarım
  kalanlar.
- Plan dağılımı ve freemium'dan ücretli plana geçiş oranı.
- Önümüzdeki 7 ve 30 günde planı bitecek işletmeler, işletme detayına bağlantılı.
- Toplam menü görüntüleme, QR tarama ve AI tarama kullanımı.

### Aşama 5b: Super Admin paneli ve merkezi denetim kaydı ✅ (2026-09-26)
*Kararlar (kullanıcı onaylı):* işletme panelinin yazmaları ve girişleri PocketBase
hook'uyla kaydedilir (`pocketbase/pb_hooks`, kurulum `docs/audit-log.md`); işletme
silme yumuşaktır (`deleted_at` + askı + `authRule`, geri alınabilir); super_admin
yönetici hesabını panelden açar (geçici şifre bir kez gösterilir).
*Ek kararlar:* kayıt koleksiyonu yeniden adlandırılmadı, genişletildi (`actor_*`,
`business_id`, `meta`); yönetici hesabı silinmez, erişimi kapatılır; kimse kendi
rolüne/erişimine dokunamaz (son süper yönetici kilidi bundan gelir); yönetimden
içerik düzenleme dar kapsamlı (ad, açıklama, fiyat, kategori, görünürlük, indirim)
ve içi dolu kategori silinemez; işletme bilgisi/içerik düzenleme ve giriş e-postası
değiştirme super_admin'de. Sistem ekranı salt okunur (düzenlenebilir ayar yok).
- `/admin/logs`: arama, tarih, işletme, yapan, yapan türü, işlem, kaynak filtreleri
- İşletme detayı: tüm aktörlerin etkinlik geçmişi, bilgi düzenleme, silme/geri alma,
  giriş e-postası; `/admin/businesses/[id]/menu`: kategori/ürün yönetimi
- ~~`/admin/users`~~ (Aşama 6'da kaldırıldı): yöneticiler Sistem → Yönetim ekibi'ne,
  işletme hesabının giriş etkinliği işletme detayına taşındı
- `/admin/ai`: kota kullanımı, AI işlemleri, token toplamı; `/admin/system`: durum

### Aşama 6: Sadeleştirme ✅ (2026-09-26)
*Kararlar (kullanıcı isteği):* yönetimin temel birimi işletmedir; ayrı "Kullanıcılar"
ekranı yok. Ekranlar az ama anlamlı veri gösterir: sayılar tek çerçevede özet
şeridi (`StatGroup`), listeler geniş tablo (`Table`), köşe yarıçapı her yerde 6px.
- Planın **tek fiyatı** var (`price_monthly`); yıllık ödeme = aylık fiyat − sistem
  ayarındaki indirim (`buyur_settings.yearly_discount_percent`, varsayılan %20).
  `price_yearly_monthly` artık okunmaz/yazılmaz (şemada geriye dönük uyum için duruyor).
- `/admin/system`: "Genel ayarlar" (düzenlenebilir sistem değişkenleri, gerekçe +
  denetim kaydı; `lib/system-settings.ts`) ve "Yönetim ekibi" sekmeleri. Plan kataloğu
  ve ayrıntılı yapılandırma listesi burada yok; altyapı durumu genel bakışta kısa liste.
- Genel bakış: özet şeridi (işletme, yayında, ürün, ziyaret), plan dağılımı, sistem
  durumu, plan bitişleri (±30 gün) ve son önemli işlemler. Hesap/şifre işlemleri
  başlıktaki hesap menüsünde.
- İşletme detayı: tek bilgi kartı (son giriş dahil), özet şeridi, 3 temel işlem +
  "Diğer işlemler" menüsü, etkinlik geçmişi, iç notlar. QR ve değerlendirme listeleri
  kaldırıldı (işletmenin kendi panelinde).
- Canlıya alma: `scripts/migrate-settings.mjs --dry-run` → çalıştır → hook dosyalarını
  (buyur_settings eklendi) yeniden kopyala → deploy.

### Aşama 5: Sonraki işler (şimdilik yalnızca planla, kodlama)
Önerilen sıra ve yaklaşım (2026-09-25):
1. ~~**Admin kullanıcı yönetimi**~~ ✅ Aşama 5b. (`admins.manage`): liste (servis hesabı gizli),
   davet = `create-admin.mjs` mantığı sunucu ucunda (superuser token gerekir →
   ya bu işlem script olarak kalır ya da super_admin'in manageRule yetkisiyle
   yeni hesap için createRule açılır; ikincisi kural değişikliği ister), rol
   değiştirme ve erişim kaldırma denetim kaydıyla.
2. **Kayıt hunisi**: OTP gönderildi (buyur_otps.created) → hesap açıldı
   (businesses.created) → kurulum bitti (slug) → ilk ürün → ilk QR taraması
   (events qr_scan). Hepsi mevcut veriden; yeni event gerekmez.
3. **Kayıp takibi**: 14/30 gündür `sessions` = 0 olan yayındaki işletmeler
   (stats_daily'den); genel bakışta bir liste.
4. **Rollup durumu**: işletme başına son `stats_daily.date`; elle tetikleme
   `/api/analytics/rollup` ucunu admin oturumuyla çağırır.
5. **AI maliyeti**: token kullanımı artık denetim kaydında (`meta.input_tokens`,
   `output_tokens`); `/admin/ai` son 30 günü toplar. Model fiyatıyla çarpılıp
   işletme/gün bazında raporlanması kaldı.
6. **Brevo teslim durumu**: Brevo webhook'u → yeni `buyur_email_events`.
7. **Görsel denetimi, duyuru, sağlık ekranı**: ayrı ürün kararı ister.
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
