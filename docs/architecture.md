# Mimari

buyur tek bir Next.js 15 (App Router) uygulamasıdır; veri PocketBase'de, dosyalar MinIO'da
durur. Kod yazmadan önce [`CLAUDE.md`](../CLAUDE.md) okunur; bu dosya haritayı ve veri akışını
özetler.

## Dört yüz

| Yüz | Adres | Kod | Nasıl render edilir |
|---|---|---|---|
| Müşteri menüsü | `buyur.in/isletme`, `isletme.buyur.in` | `app/[slug]/**`, `components/menu/**` | Sunucuda veri + istemci `MenuProvider`; mobilde < 2 sn |
| İşletme paneli | `buyur.in/panel` | `app/panel/**`, `components/panel/**` | İstemci bileşenleri, `pb` ile işletmenin kendi yetkisi |
| Yönetim paneli | `admin.buyur.in` | `app/admin/**`, `components/admin/**` | Sunucu bileşenleri + `/api/admin/*` yazma uçları |
| Pazarlama + işletme sitesi | `buyur.in`, `isletme.buyur.in/site` | `app/page.tsx`, `app/site/**`, `components/site/**` | Sunucu + hafif istemci |

`middleware.ts` host'a bakar: alt alan → `/isletme/...` rewrite, `admin.` → `/admin/*`,
rezerve alt alanlar (`lib/slug.ts → RESERVED_SLUGS`) kök alana yönlenir. Panel alt alanda yaşamaz.

## Veri erişimi

| İstemci | Nerede | Ne için |
|---|---|---|
| `pb` (`lib/pocketbase.ts`) | panel istemci bileşenleri | işletmenin kendi kayıtları |
| `createServerPB()` | route handler, sunucu bileşeni | istek başına taze istemci |
| `getServicePB()` | yalnızca sunucu | servis hesabı: event yazımı, agregasyon, plan/sayaç alanları |
| `requireAdmin()` / `authenticateAdminRequest()` | yönetim sayfaları ve `/api/admin` | yöneticinin kendi token'ı (şifreli httpOnly çerezde) |

- 1 işletme hesabı = 1 `buyur_businesses` kaydı (auth koleksiyonu). Bağlı kayıtlarda sahiplik
  `business = @request.auth.id`.
- Şema kaynağı `scripts/setup-pocketbase.mjs` + `scripts/*-schema.mjs`; mevcut kurulum için
  idempotent `scripts/migrate-*.mjs` (bkz. [development-rules.md](./development-rules.md)).
- Menü ziyaretçisi PocketBase'e yazmaz: event'ler `/api/track` → servis hesabı.

## İş kurallarının yeri

Kurallar saf `lib/` modüllerinde durur, ekranlar onları çağırır; her birinin `tests/` altında
sözleşme testi vardır.

| Alan | Modül | Doküman |
|---|---|---|
| Plan ve yetenekler | `lib/entitlements.ts`, `lib/plan-catalog-loader.ts` | CLAUDE.md §4 |
| Menü dilleri | `lib/i18n.ts`, `lib/labels.ts`, `lib/language-rebase.ts` | [localization.md](./localization.md) |
| Panel/site arayüz dili | `lib/ui-i18n.ts`, `lib/ui-messages/**` | [localization.md](./localization.md) |
| Analitik | `lib/analytics/**` | [analytics-architecture.md](./analytics-architecture.md) |
| Denetim kaydı | `lib/audit-log.ts`, `lib/admin-audit.ts`, `pocketbase/pb_hooks` | [audit-log.md](./audit-log.md) |
| Yönetim yetkileri | `lib/admin-roles.ts` | [admin-panel.md](./admin-panel.md) |
| Ödemeler | `lib/payments.ts` | [payments.md](./payments.md) |
| UI kiti | `components/panel/ui.tsx`, `components/ui/**` | [ui-guidelines.md](./ui-guidelines.md) |

## Dosya düzeni

```
app/                 rotalar (menü, panel, admin, site, api, docs, blog, yasal)
components/ui/       shadcn/ui katmanı (Radix): dialog, sheet, dropdown-menu, tooltip
components/panel/    panel UI kiti (ui.tsx) ve panel bileşenleri
components/admin/    yönetim paneli istemci parçaları
components/menu/     müşteri menüsü (MenuProvider bağlamı)
components/site/     işletme vitrini ve otomatik site
lib/                 iş kuralları, veri erişimi, çeviri
scripts/             şema kurulumu, göçler, tohum verisi
pocketbase/pb_hooks/ PocketBase sunucusuna kurulan hook'lar
tests/               Vitest — iş kurallarının yazılı sözleşmesi
docs/                bu dokümanlar
```
