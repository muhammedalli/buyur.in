---
name: buyur-ai-akisi
description: buyur'da yapay zekâ özelliği yazarken izlenecek akış — fiziksel menü tarama, OpenAI vision çıkarımı, otomatik ürün görseli bulma, AI ile çoklu dil içerik üretimi, önizleme/onay ekranı ve kota kontrolü. AI sekmesi, menü içe aktarma, AI çeviri veya yeni bir model çağrısı söz konusuysa kullanın.
---

# AI Akışı Yazma

Kapsam dokümanı: `Buyur AI – Fiziksel Menü Aktarımı ve Otomatik İçerik.md`
Referans uygulama: `app/api/ai/scan/route.ts`

## Vaat

İşletme sahibi basılı menüsünün fotoğrafını yükler → AI kategorileri, ürünleri,
açıklamaları ve fiyatları çıkarır → görseller bulunur → kullanıcı önizler ve
düzeltir → onaylayınca tek seferde menüye aktarılır.

## Pazarlık edilemez beş kural

### 1. Anahtar sunucuda kalır
`OPENAI_API_KEY` yalnızca route handler'da okunur. `NEXT_PUBLIC_` önekli bir AI
anahtarı **asla** tanımlanmaz. Model çağrısı istemciden yapılmaz.

### 2. Tahmin yok
Okunamayan fiyat, silik metin, belirsiz kategori **boş bırakılır ve kullanıcıya
işaretlenir**. Prompt'ta bunu açıkça iste; çıktıda belirsiz alanları ayrı bir
bayrakla döndür. Model uydurursa işletme yanlış fiyat yayınlar — bu ürünün en
pahalı hatasıdır.

### 3. Her şey önce taslak
AI çıktısı doğrudan canlı menüye yazılmaz. Akış: **çıkar → önizle → düzenle →
onayla → aktar.** Kullanıcı onayı olmadan menü yayına alınmaz.

### 4. Sayısal veri çeviriden muaf
Çeviri üretirken fiyat, sayı, para birimi, alerjen ve doğrulanması gereken
bilgiler değiştirilmez.

### 5. Görsel araması akışı bloklamaz
Ücretsiz sağlayıcıdan (Unsplash / Pexels / Pixabay — lisans koşullarına uygun)
görsel bulunamazsa ürün yine de oluşur. Kullanıcı görseli değiştirebilir,
yeniden aratabilir veya kendi görselini yükleyebilir.

## Route handler iskeleti

```ts
export async function POST(req: NextRequest) {
  // 1) Kimlik
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const pb = createServerPB();
  pb.authStore.save(authHeader, null);
  try { await pb.collection("buyur_businesses").authRefresh(); } // oturum = işletme hesabı
  catch { return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 }); }
  const userId = pb.authStore.record?.id;

  // 2) Girdi doğrulaması + sınır (ör. tek seferde en fazla 10 sayfa)
  // 3) Sahiplik: businessId === oturumdaki kayıt kimliği → değilse 403
  // 4) Plan/kota: entitlements üzerinden, elle plan karşılaştırması YOK
  // 5) Anahtar yoksa 500 + eyleme dönük Türkçe mesaj
  // 6) Model çağrısı
}
```

## Prompt ve çıktı disiplini

- Yapılandırılmış çıktı: `response_format: { type: "json_object" }` ve prompt'ta
  şemayı açıkça yaz
- Dönen JSON'u **parse etmeden önce doğrula**: tip kontrolü, fiyatın sayı
  olması, boş kategori elemesi, beklenmeyen alanların atılması
- Model kimliğini ve fiyatlandırmayı ezberden yazma — `claude-api` skill'i ya da
  sağlayıcının güncel dokümanından doğrula
- Uzun işlemlerde ilerleme göster; çok sayfalı taramada sayfa sayfa geri bildir

## Kullanıcıya dönük hatalar

Türkçe ve eyleme dönük:

| Durum | Mesaj |
|---|---|
| Görsel yok | "Görsel bulunamadı." |
| Sayfa sınırı | "Tek seferde en fazla 10 sayfa menü tarayabilirsiniz." |
| Erişim yok | "Bu işletmeye erişiminiz yok." |
| Model hatası | "Yapay zekâ tarama yaparken bir hata oluştu." |

İç hata detayını `console.error` ile logla, istemciye sızdırma.

## Mevcut mimariyi kullan

Yeni bir veri modeli veya paralel API katmanı kurma. Kategoriler
`buyur_categories`, ürünler `buyur_products`, görseller `/api/upload` →
MinIO, panel bileşenleri `components/panel/ui.tsx` kitinden (`AiButton` hazır).

## Kontrol listesi

- [ ] Anahtar yalnızca sunucuda, `NEXT_PUBLIC_` yok
- [ ] 401 → 400 → 403 → kota → model sırası eksiksiz
- [ ] Girdi sınırı uygulanıyor (sayfa/boyut/adet)
- [ ] Belirsiz alanlar işaretleniyor, uydurulmuyor
- [ ] Çıktı JSON'u tip doğrulamasından geçiyor
- [ ] Önizleme + düzenleme + onay ekranı var; içerik taslak
- [ ] Görsel bulunamazsa akış devam ediyor
- [ ] Çeviride sayısal veri korunuyor
- [ ] Kota `lib/entitlements.ts` üzerinden
- [ ] Hata mesajları Türkçe, iç detay sızmıyor
- [ ] Doğrulama mantığı için test yazıldı
