# Çoklu dil

İki ayrı sistem vardır; karıştırılmaz.

| | Menü içeriği dili | Arayüz dili |
|---|---|---|
| Ne | İşletmenin ürün/kategori/açıklama metinleri ve müşteri menüsünün sabit metinleri | Panelin ve pazarlama sitesinin kendi ekranları |
| Diller | `tr en de ar fr es it ru` | `tr en` |
| Kaynak | `lib/i18n.ts`, `lib/labels.ts` | `lib/ui-i18n.ts`, `lib/ui-messages/<dil>/` |
| Seçen | İşletme (Ayarlar → Menü dilleri), misafir menüde | Panel kullanıcısı (Ayarlar → Panel) |

## Menü dilleri

- Desteklenen diller `SUPPORTED_LOCALES`: Türkçe, English, Deutsch, العربية, Français, Español,
  Italiano, Русский. Sıra seçicilerdeki sıradır.
- **İşletme başına en fazla 4 dil** (`MAX_MENU_LOCALES`): ana dil + 3 ek dil. PocketBase'de
  `languages.maxSelect = 3`. `activeLocales()` şema gevşek olsa bile 4'ü aşmaz.
- Ana metin (`name`, `description`…) ana dilde tutulur, diğer diller `translations` JSON alanında.
  Okuma her zaman `tField(entity, field, locale, baseLocale)` ile: çeviri boşsa ana dile düşer.
- Ana dil değişince içerik `lib/language-rebase.ts` ile yeni ana dile taşınır; taşıma bitmeden
  `main_language` yazılmaz. Kapatılan dilin çevirileri silinmez.
- Dil seçimi her yerde **açılır menüdür** (panelde `Select`, menüde dil butonu). Yan yana dil
  butonları ya da uzun yatay dil listesi kullanılmaz.
- Çevrilebilir alanlar: `name`, `description`, `campaign_label`, `group_name`, `title`, `message`,
  `marquee_text`. Yeni çok dilli alan = `MultiLangFields` + `translate`.
- "AI ile tamamla" yalnızca boş çevirileri doldurur (`fillMissingTranslations`).

### Yeni menü dili eklemek

1. `lib/i18n.ts`: `SUPPORTED_LOCALES` + `Record<Locale, …>` tabloları (TypeScript eksik olanı söyler)
   ve `UI_STRINGS`'in her anahtarı.
2. `lib/labels.ts`: alerjen, rozet ve mekân özelliği etiketleri.
3. `lib/ai/translate.ts → LOCALE_NAME_ALIASES`: modelin dil adıyla döndürdüğü yanıt için.
4. `scripts/storefront-schema.mjs → MENU_LOCALE_VALUES` ve `scripts/migrate-storefront-i18n.mjs`
   (seçenek ekler, silmez; deploy'dan önce).
5. `tests/menu-locales.test.ts` her dilde eksiksiz metin ve eşleşen `{yer tutucu}` ister.

## Sağdan sola (Arapça)

- `dir` menüde `MenuProvider`, sitede `SiteLocaleProvider` sarmalayıcısında verilir.
- Yön sınıfları mantıksaldır: `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/text-end`,
  `border-s/border-e`. `ml-`, `mr-`, `left-`, `right-`, `text-left/right` menü ve sitede kullanılmaz
  (ortalanmış konumlandırma hariç).
- Yön bildiren ikonlar (ok, chevron) `rtl:rotate-180` alır; kayan animasyonlar `rtl:` karşılığıyla.
- Telefon numarası gibi LTR veriler `dir="ltr"` ile yazılır.

## Arayüz dili (panel ve site)

- Kaynak dil Türkçedir ve Türkçe metin mesaj kimliğidir: `t("Kaydet")`. Sabit listelerde `msg("…")`.
- Katalogda karşılığı olmayan metin Türkçe kalır (ekran boş görünmez).
- `tests/ui-i18n.test.ts` koddaki her `t()`/`msg()` metninin kataloglarda karşılığını ister;
  `bun scripts/i18n-missing.ts panel` eksikleri listeler.
- Yönetim paneli (admin) arayüz dili sistemine bağlı değildir, Türkçedir.
