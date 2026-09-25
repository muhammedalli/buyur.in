# buyur Analitik Mimarisi

Kod içindeki `bkz. docs/analytics-architecture.md §N` atıflarının hedefi bu dosyadır.
Burada **neden** öyle yapıldığı yazar; **nasıl** yapıldığı kodda ve
[`.claude/skills/buyur-analitik-event`](../.claude/skills/buyur-analitik-event/SKILL.md)
skill'indedir.

---

## §1 — Genel akış

```
menü istemcisi          /api/track              rollup                 panel
(trackEvent)    ──►  buyur_events        ──►  buyur_stats_daily  ──►  /api/analytics/*
                     buyur_sessions           (gün × boyut × anahtar)
```

Dört değişmez kural:

1. **İstemci yalnızca "ne oldu"yu söyler.** Kim, nereden, hangi cihaz — hepsi sunucuda üretilir.
2. **Panel ham event taramaz.** Okumalar agregat kayıtlarından yapılır.
3. **Analitik hiçbir koşulda menüyü bozmaz.** Hata sessizce yutulur, ziyaretçi bir şey görmez.
4. **İşletme kimliği istemciden gelen değerden türetilmez** — token'dan ya da doğrulanmış sahiplikten gelir.

Event sözlüğü tek kaynaktır: [`lib/analytics/events.ts`](../lib/analytics/events.ts).

---

## §2 — Ingestion (`/api/track`)

İstemci tarafı ([`lib/analytics/track-client.ts`](../lib/analytics/track-client.ts)) kasıtlı olarak
incedir: event tipi, hedef, etiket ve birkaç kimlik alanı gönderir (`TrackPayload`).
İlk temas parametreleri (`?qr=`, `utm_*`, referrer) sekme oturumunda saklanır — çünkü rota
değişince URL'den kaybolurlar; sunucu bunları yalnızca **yeni oturum açarken** kullanır.

Sunucu tarafı ([`app/api/track/route.ts`](../app/api/track/route.ts)) servis hesabıyla yazar ve şunları üretir:

| Alan | Nereden |
|---|---|
| oturum / ziyaretçi kimliği | `mv_sid` / `mv_vid` cookie'leri, rastgele 32 hex |
| trafik kaynağı, medium, kampanya | atıf kuralları (§5) |
| cihaz türü | User-Agent |
| ülke / şehir | edge coğrafi başlıkları |

Korumalar:

- `qr_scan`, `session_start`, `session_end` **yalnızca sunucu üretir**; istemciden gelirse reddedilir (`isClientEmittableEvent`).
- Bilinmeyen event tipi reddedilir (`isAnalyticsEventType`).
- IP + işletme başına dakikada 120 istek sınırı — normal ziyaretçi bunun çok altındadır.
- Slug ve PocketBase id'leri biçim doğrulamasından geçer.
- Hata durumunda bile yanıt 204'tür; menü akışı asla kesilmez.

> Yeni bir event eklemek sözlüğü güncellemekle bitmez: PocketBase'teki `select` alanının
> seçenekleri de `scripts/migrate-analytics.mjs` ile genişletilmelidir. `getOrCreate`
> var olan bir alanın seçenek listesini değiştirmez.

---

## §3 — Agregat veri modeli (`buyur_stats_daily`)

Bir satır = **gün × boyut × anahtar → metrikler** (`DailyStat`, [`lib/types.ts`](../lib/types.ts)).

- `date` işletmenin **kendi saat diliminde** `YYYY-MM-DD`. Gün sınırı UTC değil, işletmenin günüdür.
- `dimension`: `total`, `hour`, `weekday`, `page`, `product`, `category`, `source`, `device`,
  `country`, `city`, `qr`, `campaign`, `search`, `funnel`, `navigation`
- `label` insan okunur ad (panelde id gösterilmez); ilk event'te boş gelirse sonradan doldurulur
- `metrics` serbest sayısal sözlük — yeni metrik şema göçü gerektirmez

Uzun kuyruklu boyutlar gün başına sınırlıdır (arama 50, geçiş 30, şehir 30 satır) — aksi hâlde
tek bir günün agregatı binlerce satıra şişer.

**Huni (`funnel`)** tek kaynaktan tanımlanır: [`lib/analytics/funnel.ts`](../lib/analytics/funnel.ts).
Adımlar `menu_open → product_view → add_to_cart → cart_view`; her adım bir öncekinin alt kümesidir
(detaya girmeden karttan ekleyen "ürünü görmüş", eklemeden açılan sepet "sepete bakmış" sayılmaz).
Kategori ve ürün detayı atlanabilen yan dallar olduğu için huniye girmez. Etiketler satırdan değil
tanımdan okunur; sıfır oturumlu adımın satırı yazılmaz. Bu tanımdan önce hesaplanmış günler için
rollup ucu bir kez `?days=400` ile çağrılır.

---

## §4 — Oturum ve ziyaretçi

[`lib/analytics/session.ts`](../lib/analytics/session.ts):

- `mv_sid` (oturum) ve `mv_vid` (ziyaretçi, 365 gün) cookie'leri
- Kimlikler **rastgeledir** — IP, User-Agent veya başka bir parmak izinden türetilmez (§9)
- 30 dakika hareketsizlik = oturum kapandı
- Gelen kimlik biçim doğrulamasından geçer (`^[0-9a-f]{32}$`); uydurulmuş değerler veritabanına girmez

`buyur_sessions` kaydı oturum boyunca güncellenir: süre, event sayısı, sayfa/ürün/sepet sayaçları,
giriş-çıkış yolu ve `is_returning`. Bir oturum **bounce** sayılır: tek sayfa görüntüleme, ürün
etkileşimi yok, sepet ekleme yok.

---

## §5 — Trafik atfı

Öncelik sırası (ilk eşleşen kazanır), [`lib/analytics/attribution.ts`](../lib/analytics/attribution.ts):

```
?qr=<kod>  →  utm_source  →  referrer host  →  direct
```

- Referrer eşlemesi alt alan adlarını da kapsar: `l.instagram.com`, `m.facebook.com` → instagram/facebook
- Tüm Google alan adları (`google.com.tr`, `google.de` …) tek kaynağa düşer
- **Tam referrer URL'i asla saklanmaz**, yalnızca host (§9)
- Atıf oturum başına bir kez belirlenir ve oturum boyunca değişmez

Fonksiyonlar saf tutulur (IO yok) — atıf kuralları `tests/attribution.test.ts` ile kilitlidir.

---

## §6 — Plan yetkileri ve saklama

Yetki kararı UI'da değil **sunucuda** verilir ([`lib/analytics/access.ts`](../lib/analytics/access.ts)).
İzinler plana bağlıdır; buyur'da rol/ekip kavramı yoktur (bir kullanıcı bir işletme yönetir).

| İzin | Özellik (`Feature`) |
|---|---|
| `analytics.view` | `basic_analytics` |
| `analytics.advanced` | `advanced_analytics` |
| `analytics.export` | `report_export` |
| `reports.view` | `advanced_reports` |
| `reports.export` | `report_export` |

Kararın kendisi `lib/entitlements.ts`'tedir; burası yalnızca izin adlarını o matrise bağlar.
Plan kaydı okunamazsa Freemium limitleri geçerli olur. Çözülmüş bağlam 60 sn önbelleklenir —
ödünleşim: iptal edilen token ya da değişen plan en fazla bu kadar geç yansır.

**Saklama** ([`lib/analytics/retention.ts`](../lib/analytics/retention.ts)): silinen yalnızca ham
event akışıdır; agregatlar **hiç silinmez** — plan düşse bile geçmiş kaybolmasın, yükseltmede
geri gelsin. Değişmez kural: **agregata dönüşmemiş bir gün silinmez.** Plan süresine 7 günlük
güvenlik payı eklenir ve bir turda en fazla 2000 kayıt temizlenir.

---

## §7 — Okuma uçlarının sözleşmesi

```
GET /api/analytics/<uç>?preset=last_30&compare=previous_period
Authorization: Bearer <pocketbase token>
```

Uçlar: `overview`, `insights`, `reports`, `menu`, `products`, `categories`, `sources`,
`devices`, `qr`, `activity`, `funnel`, `search`, `campaigns`, `navigation`.

- Route dosyası yalnızca kimlik ve zarf işini yapar; şekillendirme
  [`lib/analytics/endpoints.ts`](../lib/analytics/endpoints.ts) içindedir
- Her handler **kendi plan yetkisini talep eder** — gating bu katmanda bağlayıcıdır
- Yanıtlar 30 sn önbelleklenir; anahtar işletme + yetki + uç + parametrelerdir,
  farklı yetki asla aynı yanıtı paylaşmaz
- Eksik günler istek anında tembel rollup'lanır (istek başına en fazla 14 gün; kalan boşlukları
  `/api/analytics/rollup` cron'u kapatır), bu yüzden `maxDuration = 60`
- Aralık tekil ziyaretçisi 20.000 oturumu aşarsa sayım günlük tekillerin toplamına düşer ve
  yanıt `approximate` işaretlenir — panel "yaklaşık" der, kesin sayı uydurmaz

**Gecikmenin ana kaynağı hesaplama değil, sıralı PocketBase turlarıdır (~250ms/tur).**
`pbRequestCount()` ile ölçün, bağımsız okumaları `Promise.all` ile paralelleştirin.

---

## §8 — Rollup (günlük agregasyon)

[`lib/analytics/rollup.ts`](../lib/analytics/rollup.ts):

- **İdempotenttir**: aynı gün tekrar hesaplanınca kayıtlar üzerine yazılır, artık üretilmeyen satırlar silinir
- Bugünün agregatı 15 dakikadan eskiyse tembel olarak yeniden hesaplanır
- Yazma eşzamanlılığı 4 ile sınırlıdır — PocketBase ani yükte 503 verir
- Tekil sayımlar (oturum/ziyaretçi) küme ile tutulur, toplama ile değil

Rollup değişikliği yapıldığında `tests/rollup.test.ts` sözleşmesi de güncellenir.

---

## §9 — Gizlilik sınırı

Toplanmayanlar — bilerek:

- IP adresi saklanmaz (yalnızca ülke/şehir çıkarımı için anlık kullanılır ve oran sınırlamasında)
- Tam referrer URL'i saklanmaz, yalnızca host
- Kimlikler parmak izinden türetilmez; rastgeledir ve kişiye bağlanamaz
- Çerez ömrü sınırlıdır (ziyaretçi 365 gün, oturum 30 dk hareketsizlik)

Bu sınır [`lib/legal.ts`](../lib/legal.ts) üzerinden gizlilik metnine yansır — burada bir şey
değişirse **hukuki metin de değişmelidir**.
