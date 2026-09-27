# Geliştirme kuralları

Bu kurallar her değişiklikte geçerlidir. Gerekçeleri [`CLAUDE.md`](../CLAUDE.md)'de.

## Bitti sayılmak için

1. `bun run test` ve `bun run build` yeşil.
2. İş kuralı değiştiyse önce ilgili `tests/*.test.ts` sözleşmesi değişti.
3. Sürüm notu yazıldı: `lib/release-notes.ts` başına kayıt, `package.json` sürümü, `bun run changelog`
   (CHANGELOG.md elle düzenlenmez). Kullanıcı davranışı değiştiyse `lib/docs.ts` rehberi de.
4. Görünen her ekran 320 / 375 / 768 / 1024 / 1440 px'te yatay taşmadan çalışıyor
   ([ui-guidelines.md](./ui-guidelines.md)).

## Veri kaybını önleme

- **Yarım veri canlıya yazılmaz.** Panel formları `useFormDraft()` ile taslak tutar; kayıt
  `FormActions` ile yapılır, başarılı kayıttan sonra form kayıtlı hâle eşitlenir.
- **Açık form sökülmez.** Sayfa kaydı `business` nesnesine değil `business.id`'ye bağlı yükler;
  oturum tazelenince form yeniden kurulmaz (aksi hâlde kaydedilmemiş her şey silinir).
- **Toplu yazma sıralıdır.** `Promise.all` ile toplu `create` yok; `withRetry(..., { verify })`
  (`lib/pb-retry.ts`). 503 "yazılmadı" demek değildir: tekrar denemeden önce kayıt var mı bakılır.
  Tek kaydın düşmesi döngüyü durdurmaz, sonda "X eklendi, Y eklenemedi" denir.
- **Silme yumuşaktır.** İşletme `deleted_at` ile silinir, yönetici hesabı `disabled_at` ile kapatılır.
- **Yönetim yazmaları denetlenir.** `runAuditedCreate/Update/Delete`: denetim kaydı yazılamazsa
  değişiklik geri alınır.
- **AI çıktısı taslaktır.** Kullanıcı onayı olmadan yayına girmez; "AI ile tamamla" yalnızca boş
  çevirileri doldurur.
- **Hesaplanabilen değer saklanmaz.** Bakiye, sayaç özeti gibi değerler kayıtlardan hesaplanır
  (ör. ödemelerde kalan borç, [payments.md](./payments.md)).

## Şema değişikliği

1. Tanım `scripts/<alan>-schema.mjs`'e yazılır; hem `scripts/setup-pocketbase.mjs` hem göç onu okur.
2. Göç idempotenttir, `--dry-run` destekler ve veri silmez (select seçeneği kaldırmaz).
   `getOrCreate` var olan alanın seçeneklerini güncellemez; bunun için göç adımı gerekir.
3. Yayın sırası: göç `--dry-run` → göç → deploy. Göç eski kodla uyumlu yazılır.
4. Uygulamadaki sözlük (ör. `lib/payments.ts`) ile şema değerleri bir testle kilitlenir.

## Güvenlik sınırları

- Filtreler her zaman `pb.filter()` ile parametreli.
- API anahtarları `NEXT_PUBLIC_` önekiyle tanımlanmaz; AI yalnızca route handler'da.
- Plan kuralı `isFeatureAvailable()` / `entitlementsFor()` ile okunur; `if (plan === "premium")` yazılmaz.
- Yönetim yetkisi `canPerform(role, action)` ile okunur; rol adına bakılmaz.
- Askıdaki işletme herkese açık her yüzeyde `isSuspended()` ile elenir.

## Kod dili

- Kullanıcıya görünen metinler Türkçe (panel İngilizce açıkken `t("…")` kataloglardan çevirir).
- Kod yorumları Türkçe ve **neden**i anlatır; ne yapıldığını tekrar eden yorum yazılmaz.
- Değişken/fonksiyon adları İngilizce, camelCase. Hata mesajı kullanıcının diliyle konuşur.
- Mevcut mimari kullanılır; paralel yeni bir yapı kurulmaz. Kullanılmayan kod ve dosya bırakılmaz.
- Paket yöneticisi **bun**; kilit dosyası yalnızca `bun.lock`.
