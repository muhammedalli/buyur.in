# Yönetim paneli

`admin.buyur.in` → `/admin/*`. Platform ekibinin işletmeleri, planları, ödemeleri ve sistemi
yönettiği ayrı bir uygulama bölümü.

## Güvenlik modeli

- Giriş: e-posta + şifre, ardından e-postaya gelen kod (`/api/admin/auth`).
- Yöneticinin PocketBase token'ı **tarayıcıya verilmez**: AES-GCM ile şifreli httpOnly çerezde durur
  (`lib/admin-session.ts`). `ADMIN_SESSION_SECRET` (≥ 32 karakter) yoksa giriş kapalıdır.
- Her sayfa sunucuda `requireAdmin({ action })`, her yazma ucu
  `authenticateAdminRequest(req, { action })` çağırır. Middleware yalnızca yönlendirir.
- PocketBase kuralı `ADMIN_BYPASS` rol ayırmaz; rolü sunucu uygular: `canPerform(role, action)`
  (`lib/admin-roles.ts`, sözleşme `tests/admin-roles.test.ts`). Gelir ve erişim kararları
  (plan atama, askı, silme, fiyat, ödeme yazma) yalnızca `super_admin`'dedir; destek rolü görür,
  not ekler, deneme uzatır, AI kotası sıfırlar, ödemeleri görür.
- Servis hesabı bir insan değildir: listelerde görünmez, düzenlenemez.

## Yazma akışı

```
istemci formu → /api/admin/* → authenticateAdminRequest → girdi doğrulama (lib/*)
              → runAuditedCreate/Update/Delete (yöneticinin token'ı) → buyur_admin_logs
```

- Denetim kaydı yazılamazsa değişiklik **geri alınır** (`lib/admin-audit.ts`).
- Geri alınamaz/önemli işlemler gerekçe ister (`reasonError`, en az 5 karakter).
- Oluşturma tekrar denenmez (çift kayıt olmasın); hata yöneticiye döner.
- İşletme silme yumuşaktır (`deleted_at`), askı `suspended_at` ile; ikisi de geri alınabilir.
- Yeni eylem = `lib/audit-log.ts → AUDIT_ACTION_LABELS` + gerekiyorsa `AUDIT_ACTION_GROUPS`.

## Ekranlar

| Ekran | Rota | Yetki |
|---|---|---|
| Genel bakış | `/admin` | herkes |
| İşletmeler (liste, detay, işlemler, menü içeriği) | `/admin/businesses` | `business.view` |
| Ödemeler ([payments.md](./payments.md)) | `/admin/payments` | `payments.view` / `payments.edit` |
| Planlar | `/admin/plans` | `plans.edit` |
| Yapay zekâ kullanımı | `/admin/ai` | `ai.view` |
| Denetim kaydı | `/admin/logs` | `logs.view` |
| Sistem (ayarlar, yönetim ekibi) | `/admin/system` | `system.view` |

## Gezinme

- Menü `components/admin/admin-shell.tsx → NAV_GROUPS`'tadır; yeni ekran bir satır ekler ve
  `action` verir (yetkisi olmayan görmez).
- `lg` ve üstünde sol yan menü, daha dar ekranda başlıktaki menü butonunun açtığı yaprak (Sheet).
  Yatay kayan menü yoktur.
- Alt bölümler `NavTabs` ile (sığmazsa açılır menü); filtreler sade GET formudur (adres çubuğunda
  durur, bağlantı paylaşılabilir).

## Yeni ekran eklemek

1. `lib/admin-roles.ts`'e işlem (`ADMIN_ACTIONS` + destek kümesi) ve testine satır.
2. Saf kurallar `lib/<alan>.ts` + `tests/<alan>.test.ts`; okuma `lib/admin-<alan>.ts`.
3. Sayfa: sunucu bileşeni, `requireAdmin({ action })`, okumalar `Promise.all` ile paralel.
4. Yazma: `/api/admin/<alan>` + `runAudited*`; istemci parçası `components/admin/<alan>.tsx`,
   kaydedince `router.refresh()`.
5. `NAV_GROUPS`'a satır, bu tabloya satır.
