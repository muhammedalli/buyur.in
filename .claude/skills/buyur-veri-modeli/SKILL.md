---
name: buyur-veri-modeli
description: PocketBase şemasına yeni alan veya koleksiyon eklerken, mevcut kurulumlar için göç scripti yazarken ya da /api altına yeni bir route handler eklerken izlenecek akış. Yeni veri alanı, yeni koleksiyon, şema göçü, seed verisi veya yeni API ucu söz konusuysa kullanın.
---

# Veri Modeli ve API Ucu Ekleme

## Koleksiyonlar

`buyur_businesses`, `buyur_categories`, `buyur_products`,
`buyur_product_options`, `buyur_popups`, `buyur_admins`,
`buyur_plans`, `buyur_events`, `buyur_sessions`, `buyur_stats_daily`,
`buyur_qr_codes`, `buyur_reviews`, `buyur_admin_logs`

## A. Yeni alan ekleme

### 1. Tipi tanımla

`lib/types.ts` içinde alanı ekle ve **neden var olduğunu** yorumla:

```ts
/** IANA saat dilimi (ör. "Europe/Istanbul"). Günlük/saatlik analitik
 *  kırılımları bu saat dilimine göre hesaplanır. Boşsa varsayılan kullanılır. */
timezone?: string;
```

Geriye uyum kuralı: eski kayıtlarda alan **yoktur**. Opsiyonel yap ve
tanımsız hâli için anlamlı bir varsayılan belirle. Varsayılanı "kısıtlama"
yönünde değil, "serbestlik" yönünde seç.

### 2. Şemaya ekle

`scripts/setup-pocketbase.mjs` içine alanı ekle. Script **idempotent** kalmalı —
koleksiyon varsa dokunmadan atlar.

### 3. Göç scripti yaz

Var olan kurulumlar için ayrı, idempotent bir script:

```js
// <Başlık>. Mevcut bir kurulumu <hedef> durumuna taşır:
//   1) ...
//   2) ...
// Kullanım: POCKETBASE_API_URL=... POCKETBASE_ADMIN_TOKEN=... node scripts/migrate-<ad>.mjs
// Önkoşul: scripts/setup-pocketbase.mjs bu sürümle bir kez çalıştırılmış olmalı.
// Idempotent: her adım zaten uygulanmışsa atlanır.
```

> **Tuzak:** `getOrCreate` var olan bir alanın `select` seçenek listesini
> güncellemez. Bir `select` alanına yeni değer eklemek göçte **elle** yapılır.
> Örnek: `scripts/migrate-analytics.mjs`.

### 4. Seed'i güncelle

Demo veriyi etkiliyorsa `scripts/seed-demo-menu.mjs`,
`scripts/seed-analytics-demo.mjs` veya `scripts/demo-menu-data.mjs`.

## B. Yeni route handler

`app/api/upload/route.ts` referans akıştır. Sıra değişmez:

```ts
export async function POST(req: NextRequest) {
  // 1) Kimlik var mı
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  // 2) Oturum geçerli mi — her istek için TAZE istemci
  const pb = createServerPB();
  pb.authStore.save(authHeader, null);
  try {
    await pb.collection("buyur_businesses").authRefresh(); // oturum = işletme hesabı (lib/business-auth.ts)
  } catch {
    return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  }
  const userId = pb.authStore.record?.id;

  // 3) Girdi doğrulaması → 400
  // 4) Sahiplik: istenen işletme kimliği === oturumdaki kayıt kimliği → değilse 403
  // 5) Kaynak yoksa 404
  // 6) İş
}
```

### İstemci seçimi

| İstemci | Kullanım |
|---|---|
| `pb` | yalnızca tarayıcı |
| `createServerPB()` | route handler / server component — her istek için taze |
| `getServicePB()` | servis hesabı; event yazımı, agregasyon |

Sunucuda paylaşılan `pb`'yi kullanmak `authStore` state'ini istekler arasında
sızdırır.

## C. Sorgu maliyeti

Gecikmenin kaynağı hesaplama değil, **sıralı ağ turlarıdır** (~250ms/tur).

- Bağımsız istekleri `Promise.all` ile paralelleştir
- `pbRequestCount()` ile tur sayısını ölç
- Filtreler her zaman `pb.filter("alan = {:x}", { x })`

## Kontrol listesi

- [ ] `lib/types.ts` güncel, alan **neden** var yorumlanmış
- [ ] Alan opsiyonel ve eski kayıtlar için varsayılanı belli
- [ ] `setup-pocketbase.mjs` güncel ve idempotent
- [ ] Göç scripti var, başında kullanım + önkoşul yorumu bulunuyor
- [ ] `select` alanı genişlediyse göçte elle güncellenmiş
- [ ] Route handler'da 401 → 400 → 403 → 404 sırası eksiksiz
- [ ] Doğru PocketBase istemcisi seçilmiş
- [ ] Filtreler parametreli
- [ ] Gizli değerlerde `NEXT_PUBLIC_` öneki yok
- [ ] Hata mesajları Türkçe, yığın izi sızdırmıyor
