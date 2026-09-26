# Merkezi denetim kaydı

"Sistemde ne oldu, kim yaptı, ne değişti?" sorusunun tek cevabı `buyur_admin_logs`
koleksiyonudur. Koleksiyonun adı tarihsel: ilk sürümde yalnızca yönetici işlemlerini
tutuyordu. Bugün yöneticinin, işletmenin, sistemin ve veritabanı yöneticisinin
(superuser) bütün önemli işlemleri burada durur. Kayıtlar yalnızca eklenir;
güncelleme ve silme kuralı kapalıdır.

Ekranlar:

- `/admin/logs`: arama, tarih, işletme, yapan, yapan türü, işlem ve kaynak filtreleri
- İşletme detayındaki "Etkinlik geçmişi"
- `/admin/ai`: AI işlemleri, model ve token bilgisi
- `/admin` (genel bakış): son önemli işlemler. Hook'un çalıştığı, panelden yapılan bir değişikliğin `/admin/logs`'ta "işletme" kaynağıyla görünmesinden anlaşılır

## Kaydı kim yazar

| Yazan | Nerede | Ne | Kayıt yazılamazsa |
|---|---|---|---|
| Yönetim uçları | `lib/admin-audit.ts` → `runAuditedUpdate` / `runAuditedCreate` / `runAuditedDelete` | Yöneticinin her değişikliği, gerekçesiyle | Değişiklik **geri alınır** |
| Sunucu akışları | `lib/system-audit.ts` → `recordSystemAudit`, `recordAiAction` | Hesap açma, şifre sıfırlama, işletme çıkışı, AI işlemleri | İşlem sürer, hata sunucu günlüğüne düşer |
| PocketBase hook'u | `pocketbase/pb_hooks/buyur_audit.*` | İşletme panelinden gelen her yazma, işletme girişi ve başarısız girişler, superuser yazmaları | Yazma **aynı transaction'da** düşer; giriş kaydı en iyi çabayla yazılır |

İşletme paneli tarayıcıdan doğrudan PocketBase'e yazar. Bu yüzden panelin yazmalarını
Next.js göremez; kaydı PocketBase'in kendisi yazar. Kayıt istemcinin beyanına
dayanmadığı için taklit edilemez ve atlanamaz.

Hook, yöneticinin ve servis hesabının yazmalarını (`buyur_admins`) **bilerek** atlar:

- Yönetici işlemleri Next.js katmanında gerekçesiyle yazılır; hook da yazsaydı her işlem iki kez görünürdü.
- Servis hesabının yazmaları (menü sayacı, AI kotası) gürültüdür. Anlamlı olanları ilgili route kendisi yazar.

## Bir kaydın alanları

| Alan | Anlamı |
|---|---|
| `actor_type` | `admin` / `business` / `system` / `superuser`. Eski kayıtlarda boşsa yönetici kaydıdır |
| `actor_id`, `actor_email` | Yapan. E-posta ayrıca saklanır: hesap silinse de kimin yaptığı okunur |
| `business_id` | Kaydın ait olduğu işletme. İlişki değil düz metindir: işletme kalıcı silinse de geçmişi kalır |
| `action` | `<kaynak>.<işlem>`, ör. `product.price_change`. Etiketler `lib/audit-log.ts` → `AUDIT_ACTION_LABELS` |
| `target_collection`, `target_id` | Hangi kayıtta (`ai` = kayıtsız AI işlemi) |
| `before`, `after` | Güncellemede yalnızca değişen alanlar. Oluşturmada `before = null`, silmede `after = null` ve tam anlık görüntü |
| `reason` | Yönetici gerekçesi (yönetim işlemlerinde zorunlu) |
| `ip`, `meta` | İstek bağlamı. `meta.label` kaydın adıdır, kayıt silinse de ne olduğu okunur. Diğer alanlar: `user_agent`, `source` (`next` / `pocketbase`), AI için `model`, `input_tokens`, `output_tokens` |
| `admin`, `admin_email` | Kaydı yazan yönetim hesabı (ilk sürümden kalma). Hook kayıtlarında boştur |

Şifre değerleri hiçbir yolda kayda girmez.

## Yeni bir işlem eklerken

- **Yönetim işlemi:** Değişikliği doğrudan `pb.collection().update()` ile yazmayın; `runAudited*` ile yazın. Eylem adına `lib/audit-log.ts` sözlüğünde bir etiket ekleyin.
- **Sunucu akışı:** `recordSystemAudit` kullanın. Aktör, işlemi kimin adına yaptığınızdır (ör. işletme).
- **Hook'un izlediği yeni koleksiyon:** `lib/audit-log.ts` → `AUDITED_COLLECTIONS`, `pocketbase/pb_hooks/buyur_audit.pb.js` içindeki üç liste ve `buyur_audit.js` → `RESOURCES` güncellenir. `tests/audit-hook.test.ts` üçünün aynı kalmasını kilitler. Hook dosyası değiştiyse canlı PocketBase'in `pb_hooks` klasörüne yeniden kopyalanır.
- **Sistem ayarları** (`buyur_settings`): yönetim ekranından değişiklik `settings.edit` olarak gerekçesiyle yazılır (`meta.label` = ayarın adı); PocketBase panelinden (superuser) yapılan değişikliği hook `setting.update` olarak yazar.

## Canlıya kurulum (sıra önemli)

1. **Göçü kuru çalıştırın ve farkları okuyun:**
   ```bash
   POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... PB_SERVICE_EMAIL=... \
     node scripts/migrate-audit.mjs --dry-run
   ```
2. **Göçü uygulayın.** Aynı komutu `--dry-run` olmadan çalıştırın; ikinci çalıştırmada her satır `=` demelidir. Göç eski kodla uyumludur ve deploy'dan önce çalışabilir. Yaptıkları:
   - kayıt koleksiyonuna aktör, işletme ve meta alanlarını ve indeksleri ekler, eski kayıtları doldurur;
   - yumuşak silme alanlarını ve `authRule` kuralını ekler;
   - yönetici erişim kapatma alanını ve hesap açma kurallarını ekler;
   - super_admin için içerik ekleme kurallarını ekler.
3. **Hook'u kurun.** `pocketbase/pb_hooks/` içindeki iki dosyayı (`buyur_audit.pb.js`, `buyur_audit.js`) PocketBase sunucusunun `pb_hooks` klasörüne kopyalayın (`pb_data`'nın yanında). `serve` varsayılan olarak klasörü izler ve kendini yeniden başlatır. İzleme kapalıysa (`--hooksWatch=false`) PocketBase'i yeniden başlatın.
   - Hook göçten önce kurulursa kayıt yazmadan çalışır ve işletmelerin yazmasını durdurmaz.
4. **Gerçek IP için güvenilir proxy'yi ayarlayın.** PocketBase bir ters proxy (Cloudflare, Caddy, Traefik…) arkasındaysa hook kayıtlarındaki IP proxy'nin IP'si olur.
   - Yer: PocketBase paneli → Settings → Application → "User IP proxy headers" (ayar anahtarı `trustedProxy.headers`).
   - Değer: `X-Forwarded-For` ya da `CF-Connecting-IP`.
   - Canlıda bu liste şu an boş.
5. **Kodu deploy edin** (Vercel).
6. **Doğrulayın:**
   - `/admin/system` → "Denetim kaydı hook'u" satırı. Bir işletme panelinden bir ürün fiyatı değiştirildiğinde birkaç saniye içinde "Tamam" olmalı.
   - `/admin/logs?islem=product.price_change` → değişiklik, önce/sonra değeriyle görünmeli.

**Geri dönüş:**

- Hook dosyalarını `pb_hooks`'tan silmek, işletme kaydını durdurur. Başka hiçbir şey değişmez.
- Göçün geri alınması gerekmez; eklediği alanlar ve kurallar eski kodla da çalışır.

## Bilinen sınırlar

- **Saklama süresi yok.** Kayıt, özellikle giriş ve AI görsel araması yüzünden büyür. Binlerce işletmede eski kayıtları arşivleyen bir iş gerekecek.
- **Serbest metin araması** (`~`), `before`/`after`/`meta` üzerinde LIKE'tır ve indeks kullanmaz. Tarih ya da işletme filtresiyle birlikte kullanmak sorguyu daraltır.
- **Başarısız giriş kayıtları kötüye kullanılabilir.** Canlıda PocketBase hız sınırları kapalı (`rateLimits.enabled = false`). Kaba kuvvet denemesi hem hesabı zorlar hem kaydı şişirir. `*:auth` kuralı zaten tanımlı; hız sınırlarını açmak önerilir.
- **Bağlı kayıtların silinmesi** ayrıca kaydedilmez. İşletme bir kategoriyi sildiğinde PocketBase içindeki ürünleri de (cascade) siler; kayıtta yalnızca kategori silmesi görünür. Yönetim tarafında içi dolu kategori silinemez; ürün silinirken seçenekleri sayılır (`meta.cascaded`).
- **İşletme çıkışı**, panelin çağırdığı `/api/auth/logout` ile kaydedilir. Oturum token'dır; tarayıcıyı kapatıp giden kullanıcının çıkışı kayda düşmez.

## Doğrulama (2026-09-26)

Canlı şemanın salt okunur kopyası yerel bir PocketBase v0.39.4'e yüklendi ve hook bu
sunucuda çalıştırıldı. Aşağıdaki senaryolar denendi ve hepsi geçti:

- Göç yerel kopyada iki kez çalıştırıldı ve idempotent çıktı. Setup scripti göçle aynı sonuca vardı.
- Hook:
  - giriş ve başarısız giriş kaydedilir;
  - fiyat değişikliği yalnızca değişen alanla kaydedilir;
  - ürün ekleme ve silme anlık görüntüyle kaydedilir;
  - gürültü (activation) ve değişmeyen kayıt yazılmaz;
  - şifre değişiminde değer kayda girmez;
  - kayıt yazılamazsa değişiklik de yazılmaz;
  - silinen işletmenin açık token'ı düşer ve işletme giriş yapamaz.
- Kurallar:
  - super_admin kendi rolünü ve erişimini değiştiremez;
  - servis hesabına dokunulamaz;
  - destek rolü yönetici hesabı açamaz;
  - yönetici başka bir aktör adına kayıt yazamaz.
- Uygulama: izole bir Next.js sunucusunda bütün yönetim uçları ve ekranları denendi.
  - Rol reddi, fiyat değişikliği, silme ve geri alma, yönetici açma, rol değiştirme ve çıkış kaydı API üzerinden;
  - modallar ve filtreler tarayıcıda;
  - 1280px ve 375px genişlikte yatay taşma yok.
