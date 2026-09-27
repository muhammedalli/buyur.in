# AGENTS.md — buyur

QR tabanlı dijital menü platformu (Next.js 15 + PocketBase). Bu dosya, repoda çalışan
her kodlama ajanı için kısa bir giriş; ayrıntı ve gerekçeler [`CLAUDE.md`](./CLAUDE.md)
içindedir — **kod yazmadan önce onu okuyun.**

## Hızlı başlangıç

```bash
bun run dev      # geliştirme (port 3000)
bun run test     # vitest — PR öncesi zorunlu
bun run build    # üretim derlemesi — PR öncesi zorunlu
```

Paket yöneticisi **bun** (`bun.lock` kaynak). Kullanıcıya görünen tüm metin ve kod
yorumları **Türkçe**, değişken/fonksiyon adları İngilizce.

## Pazarlık edilemez kurallar

1. **Plan kuralları `buyur_plans` kaydından okunur**, kodda sabit yok. `lib/entitlements.ts`
   okuma kapısı; `if (plan === "premium")` yazılmaz. Yeni sunucu giriş noktası plan kuralı
   okuyacaksa önce `ensurePlanCatalog()` çağırılır. (CLAUDE.md §4)
2. **Fiyat ve limit metinleri kodda gömülmez** — `planPricing()`, `freemiumLimits()`, `featureMatrix()`.
3. **PocketBase filtreleri `pb.filter()` ile parametreli**; sunucuda paylaşılan `pb` değil
   `createServerPB()` / `getServicePB()`. (§3)
4. **Toplu yazma sıralı ve doğrulamalı**: `Promise.all` ile `create` yok, `withRetry` + `verify`
   ile çift kayıt önlenir. (§3.7)
5. **Ürün/kategori adı işletme bazında tek.** (§3.8)
6. **Gizli anahtarlar** asla `NEXT_PUBLIC_` önekiyle tanımlanmaz; AI çağrısı yalnızca route handler'da.
7. **Panel UI'sı** `components/panel/ui.tsx` kitinden; ham renk kodu yok, `@theme` token'ı kullanılır.
8. **Okunamayan veriyi AI'ya tahmin ettirme**; AI içeriği varsayılan olarak taslaktır.
9. **Menü sayfası mobilde 2 sn altında açılmalı** (trafiğin %95+'ı mobil).
10. **Hiçbir panel/yönetim ekranı yatayda kaymaz** (320–1440 px); sekme → açılır menü, gezinme → Sheet. ([docs/ui-guidelines.md](./docs/ui-guidelines.md))

## Harita

| Alan | Yer |
|---|---|
| Müşteri menüsü | `app/[slug]/**`, `components/menu/**` |
| İşletme paneli | `app/panel/**`, `components/panel/**` |
| Otomatik işletme sitesi (Elite) | `app/site/[slug]/**`, `components/site/**` |
| API | `app/api/**` |
| Plan/yetki, fiyat | `lib/entitlements.ts`, `lib/plan-catalog-loader.ts`, `lib/pricing.ts` |
| Veri dayanıklılığı | `lib/pb-retry.ts`, `lib/unique-name.ts` |
| Analitik | `lib/analytics/**` |
| Şema, göç, tohum | `scripts/**` (`plan-catalog.mjs` = yeni ortam tohumu, canlıyı ezmez) |
| İş kuralı sözleşmesi | `tests/**` — kural değişiyorsa **önce test** |
| Analitik mimarisi (koddaki §N atıfları) | [`docs/analytics-architecture.md`](./docs/analytics-architecture.md) |
| Alan kuralları (mimari, UI, dil, yönetim, ödemeler) | [`docs/`](./docs/) |

## Ajanlar ve skill'ler (Claude Code)

- `.claude/agents/` — `frontend`, `backend`, `quality` ([kullanım](./.claude/agents/README.md))
- `.claude/skills/` — müşteri menüsü, panel sayfası, veri modeli, analitik event, plan kilidi, çoklu dil, AI akışı, yayın öncesi ([liste](./.claude/skills/README.md))

Tipik akış: **backend** (veri + kural) → **frontend** (ekran) → **quality** (denetim + test).

## Bitti sayılmak için

`bun run test` ve `bun run build` yeşil; iş kuralı değiştiyse ilgili `tests/` sözleşmesi güncel;
şema değiştiyse `scripts/setup-pocketbase.mjs` (+ gerekiyorsa idempotent göç) güncel.
