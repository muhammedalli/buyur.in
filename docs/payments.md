# Ödemeler (cari hesap)

Yönetim panelinde işletmelerden alınan ve işletmelere yapılan bütün para hareketlerinin kaydı.
Kurallar `lib/payments.ts`'te, sözleşmesi `tests/payments.test.ts`. İşletme sahibi bu kayıtları
görmez.

## Model

`buyur_payments` koleksiyonunda her kayıt bir cari hareketidir:

| Tür | Etiket | Etkisi |
|---|---|---|
| `charge` | Borç kaydı | İşletmenin borcunu artırır (ör. plan ücreti) |
| `incoming` | Alınan ödeme | İşletmeden gelen para; borcu azaltır |
| `outgoing` | Verilen ödeme | İşletmeye giden para (iade vb.); borcu geri artırır |

Alanlar: `business`, `type`, `amount`, `date`, `method` (havale/EFT, kredi kartı, nakit, online,
diğer — borç kaydında boş), `status` (`completed` Tamamlandı · `pending` Bekliyor ·
`cancelled` İptal), `note`.

- **Tutar kuruş cinsinden tamsayıdır** (1.250,50 ₺ = `125050`). Kayan nokta yok; toplamlar kuruşu
  kuruşuna tutar. Giriş `parseAmount()` ile Türkçe yazımdan çevrilir; üst sınır 10 milyon ₺.
- **Tarih takvim günüdür**: `YYYY-MM-DD 12:00:00.000Z` olarak saklanır, saat dilimi günü kaydırmaz.

## Hesap

Yalnızca **tamamlanan** kayıtlar bakiyeye girer; bekleyenler ayrıca toplanır, iptaller hiçbir
toplama girmez.

```
toplam borç    = Σ borç kaydı
toplam alınan  = Σ alınan ödeme
toplam verilen = Σ verilen ödeme
toplam ödenen  = alınan − verilen
kalan borç     = toplam borç − toplam ödenen      (negatifse işletme alacaklıdır)
son ödeme      = en yeni tamamlanan alınan ödemenin günü
```

Bakiye **saklanmaz**, her okumada kayıtlardan hesaplanır: kayıt eklenince, düzenlenince ya da
silinince kalan borç kendiliğinden doğru olur; ayrı bir sayaç kayıtlarla çelişemez.

Genel ekranın "toplam borç"u yalnızca borcu kalan işletmelerin bakiyesini toplar (alacaklı bir
işletme başka işletmenin borcunu düşürmez). "Bu ay" İstanbul takvimine göredir.

## Ekranlar ve uçlar

- `/admin/payments`: genel özet (toplam alınan, verilen, bekleyen, borç, bu ay alınan/verilen),
  işletme/tip/durum/tarih filtreleri, sayfalı liste. Filtreler adres çubuğunda.
- İşletme detayı (`/admin/businesses/[id]`): toplam borç, ödenen, kalan borç, alınan, verilen,
  son ödeme tarihi ve ödeme geçmişi tablosu.
- `POST /api/admin/payments`, `PATCH|DELETE /api/admin/payments/[id]`: yalnızca `payments.edit`
  (super_admin). Hepsi `runAudited*` ile denetim kaydına düşer (`payment.create|update|delete`);
  silme gerekçe ister. PocketBase kuralı da yazmayı super_admin'e kilitler.

## Kurulum

`scripts/payments-schema.mjs` (tanım) → `node scripts/migrate-payments.mjs --dry-run` → göç →
deploy. Koleksiyon yoksa ekran "kayıtlar okunamadı" der; sıfır bakiye göstermez.

## Genişletirken

- Yeni tür/durum/yöntem = `lib/payments.ts` sözlüğü + `scripts/payments-schema.mjs` + göç; test
  iki listenin aynı kalmasını kilitler.
- Para birimi eklenecekse tutar alanı yine kuruş kalır, toplamlar para birimine göre ayrılır.
