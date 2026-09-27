# buyur

Restoran ve kafeler için **QR tabanlı dijital menü platformu**. Tek bir uygulama üç yüz sunar:

| Yüz | Adres | Ne yapar |
|---|---|---|
| **Müşteri menüsü** | `buyur.in/isletme` veya `isletme.buyur.in` | QR ile açılan, çok dilli, markaya uyarlanmış menü |
| **İşletme paneli** | `buyur.in/panel` | menü yönetimi, kampanyalar, analitik, AI araçları |
| **Pazarlama sitesi** | `buyur.in` | tanıtım, fiyatlar, blog, hukuki metinler |

Ayrıca Elite planındaki her işletmeye otomatik bir tanıtım sitesi üretilir (`isletme.buyur.in/site`).

---

## Teknoloji

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
PocketBase · MinIO (S3 uyumlu) · OpenAI (yalnızca sunucuda) · Vitest

Paket yöneticisi **bun**.

## Kurulum

```bash
bun install
cp .env.example .env.local      # değerleri doldurun
bun run dev                     # http://localhost:3000
```

PocketBase şemasını ilk kez kurarken:

```bash
node scripts/setup-pocketbase.mjs     # koleksiyonlar ve kurallar
node scripts/plan-catalog.mjs         # plan/fiyat tohumu (canlı kaydı ezmez)
node scripts/create-service-account.mjs
```

Gizli anahtarlar (`OPENAI_API_KEY`, `BREVO_API_KEY`, MinIO, servis hesabı) **asla**
`NEXT_PUBLIC_` önekiyle tanımlanmaz.

## Komutlar

```bash
bun run dev      # geliştirme sunucusu
bun run build    # üretim derlemesi      ← PR öncesi zorunlu
bun run test     # vitest run            ← PR öncesi zorunlu
bun run lint     # next lint
bun run brand    # marka görsellerini yeniden üret
```

## Dizin haritası

```
app/[slug]/       müşteri menüsü          app/panel/        işletme paneli
app/site/[slug]/  otomatik işletme sitesi app/admin/        yönetim paneli (admin.buyur.in)
app/api/          track, upload, ai, admin components/       ui/ · menu/ · panel/ · admin/ · site/
lib/              iş kuralları ve veri    scripts/          şema, göç, tohum
tests/            iş kuralı sözleşmeleri  docs/             AI ve geliştirici için kurallar
```

## Bilinmesi gereken kararlar

- **Plan kuralları koda gömülmez.** Kaynak `buyur_plans` kaydıdır; okuma kapısı `lib/entitlements.ts`.
  Fiyatlar da oradan gelir — kodda rakam yoktur.
- **Üç ayrı PocketBase istemcisi** vardır (tarayıcı / istek başına sunucu / servis hesabı);
  doğru olanı seçmek bir güvenlik kararıdır.
- **Menü ziyaretçisi veritabanına doğrudan yazmaz** — tek kapı `/api/track`.
- **Kullanıcıya görünen tüm metinler Türkçe**; menü içeriği 8 dilde (`tr en de ar fr es it ru`), işletme başına en fazla 4 dil.
- **Hiçbir panel ekranı yatayda kaymaz** — sekme dar ekranda açılır menüye, gezinme yaprağa (Sheet) döner.
- **Menü mobilde 2 saniyenin altında açılmalı** — trafiğin %95+'ı mobildir.

Gerekçeleriyle tamamı: [`CLAUDE.md`](./CLAUDE.md)

## Dokümanlar

| Dosya | İçerik |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | mimari kararlar ve kurallar — kod yazmadan önce okunur |
| [`AGENTS.md`](./AGENTS.md) | kodlama ajanları için kısa giriş |
| [`docs/architecture.md`](./docs/architecture.md) | yüzler, veri erişimi, iş kurallarının yeri |
| [`docs/development-rules.md`](./docs/development-rules.md) | bitti tanımı, veri kaybını önleme, şema/göç, güvenlik |
| [`docs/ui-guidelines.md`](./docs/ui-guidelines.md) | UI kiti (shadcn/ui katmanı), yatay taşma kuralı, gezinme |
| [`docs/localization.md`](./docs/localization.md) | menü dilleri (8 dil, en fazla 4), RTL, arayüz dili |
| [`docs/admin-panel.md`](./docs/admin-panel.md) | yönetim paneli güvenlik modeli, yazma akışı, ekranlar |
| [`docs/payments.md`](./docs/payments.md) | ödemeler (cari hesap) modeli ve hesap kuralları |
| [`docs/analytics-architecture.md`](./docs/analytics-architecture.md) | analitik mimarisi (koddaki §N atıflarının hedefi) |
| [`docs/audit-log.md`](./docs/audit-log.md) | merkezi denetim kaydı ve PocketBase hook kurulumu |
| [`.claude/skills/`](./.claude/skills/) | sık tekrarlanan işlerin adım adım akışları |
| [`.claude/agents/`](./.claude/agents/) | alan uzmanı ajanlar (frontend, backend, quality) |
