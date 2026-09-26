---
name: buyur-yayin-oncesi
description: buyur'da bir değişikliği yayına almadan önce yapılacak doğrulama turu — test, derleme, mobil menü kontrolü, plan tutarlılığı, çoklu dil, güvenlik sınırları ve SEO. Commit, PR, deploy veya "bitti mi?" sorusu öncesinde kullanın.
---

# Yayın Öncesi Doğrulama

Bu tur atlanmadan iş "bitti" sayılmaz. Sırayla yürüt, sonuçları **olduğu gibi**
raporla — kırmızıya "geçti" deme.

## 1. Otomatik kontroller

```bash
bun run test
```

```bash
bun run build
```

```bash
bun run lint
```

`tests/` iş kurallarının sözleşmesidir. Bir test kırıldıysa önce sor: kural mı
değişti, kod mu bozuldu? Testi geçirmek için iş kuralını **sessizce gevşetme**.

## 2. Müşteri menüsü — mobil

Trafiğin %95+'ı mobildendir; menü **2 saniyenin altında** açılmalı.

- Dev sunucusunu `preview_start` ile aç, mobil genişlikte (375px) kontrol et
- Yatay kaydırma yok, dokunma hedefleri yeterince büyük
- Konsolda hata yok
- Yükleniyor / boş / hata durumları görünüyor
- Görseller lazy yükleniyor
- İşletmenin marka rengi uygulanıyor (`var(--brand)`), sabit `paprika` değil

## 3. Panel

- Akış gerçekten tıklanarak yürütüldü: form doldur → kaydet → listede gör
- Yıkıcı işlem onay soruyor
- Taslak davranışı çalışıyor (sayfayı yenile, taslak geri gelsin)
- Kilitli özellik `UpgradeNotice` ile görünür — gizlenmemiş

## 4. Plan tutarlılığı

Üç yüzey aynı şeyi söylüyor mu?

1. Landing fiyat tablosu
2. Panel plan ekranı
3. Özelliğin fiilen uygulandığı yer

Kodda elle plan karşılaştırması (`plan === "premium"`) veya gömülü limit sayısı
(`10000`, `3`) kalmamış olmalı.

## 5. Çoklu dil

- Dil değiştir; çevirisi olmayan içerik **ana dile düşüyor**
- Arapça'da düzen bozulmuyor
- Yeni metin alanı `tf` / `tField` ile okunuyor
- Kullanıcıya görünen İngilizce metin kalmamış

## 6. Güvenlik sınırları

```bash
grep -rn "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" lib app components | grep -iE "key|secret|password|token"
```

- Gizli anahtar istemciye sızmıyor
- Yeni route handler'da `authRefresh()` **ve** sahiplik kontrolü var
- Filtreler `pb.filter()` ile parametreli
- Sunucuda paylaşılan `pb` yerine `createServerPB()` / `getServicePB()`
- Hata mesajları Türkçe, yığın izi sızdırmıyor

## 7. Analitik

- Yeni event sözlükte **ve** PocketBase `select` göçünde
- Taşınan bileşenlerin event tetikleyicisi korunmuş
- Saat dilimi `business.timezone`'dan okunuyor

## 8. SEO (menü/site sayfaları değiştiyse)

- Metadata `lib/seo.ts` üzerinden üretiliyor
- `Restaurant` + `Menu` structured data bozulmamış
- Canonical ve `hreflang` doğru
- `app/sitemap.ts` / `app/robots.ts` yeni rotayı kapsıyor

## 9. Veri katmanı

- Şema değişikliği için idempotent göç scripti yazıldı
- `select` alanı genişlediyse göçte elle güncellendi
- Yeni alan opsiyonel; eski kayıtlar için varsayılan davranış belli

## 10. Sürüm notu ve yardım merkezi (her geliştirmede ZORUNLU)

- `lib/release-notes.ts` → `RELEASE_NOTES` başına yeni kayıt: `version` (semver; yeni özellik = minor, yalnızca düzeltme = patch), `date`, `title`, kullanıcı dilinde `items` (yeni / iyileştirme / düzeltme / güvenlik), `internal` (dosyalar, göç, yayın adımı)
- `package.json` → `version` aynı sürüme çekildi
- `bun run changelog` çalıştırıldı (CHANGELOG.md elle düzenlenmez)
- Kullanıcının gördüğü bir davranış değiştiyse `lib/docs.ts`'teki ilgili rehber güncellendi, `updated` ilerletildi; yeni özellik = yeni bölüm ya da rehber
- `tests/release-notes.test.ts` yeşil

## 11. Raporlama

Kullanıcıya şunları söyle:

- Ne değişti (dosya bazında)
- Hangi kontroller çalıştırıldı ve **sonuçları ne oldu**
- Neyi doğrulayamadın ve neden
- Atladığın kapsam varsa açıkça

Doğrulanmamış bir şeyi "çalışıyor" diye raporlama.
