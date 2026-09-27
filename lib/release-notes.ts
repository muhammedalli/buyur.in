// Sürüm notlarının TEK KAYNAĞI. /docs/surum-notlari sayfası buradan,
// CHANGELOG.md de bununla birebir aynı başlıklarla yazılır
// (tests/release-notes.test.ts kilitler).
//
// Her geliştirme yayına girmeden önce en üste yeni bir kayıt eklenir
// (CLAUDE.md §12). `items` işletme sahibinin okuyacağı dildedir: ne değişti ve
// ona ne kazandırdı. Kod ayrıntısı `internal`'a yazılır, sayfada görünmez.

export type ReleaseItemKind = "yeni" | "iyileştirme" | "düzeltme" | "güvenlik";

export interface ReleaseItem {
  kind: ReleaseItemKind;
  text: string;
}

export interface ReleaseNote {
  /** Semver; package.json'daki sürümle en üstteki kayıt aynı olmalı. */
  version: string;
  /** Yayın tarihi (ISO, YYYY-MM-DD). */
  date: string;
  /** Tek cümlelik başlık. */
  title: string;
  items: ReleaseItem[];
  /** Geliştirici notu: etkilenen dosyalar, göçler, yayın adımları. Sayfada gösterilmez. */
  internal?: string[];
}

export const RELEASE_KIND_LABELS: Record<ReleaseItemKind, string> = {
  yeni: "Yeni",
  iyileştirme: "İyileştirme",
  düzeltme: "Düzeltme",
  güvenlik: "Güvenlik",
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.9.0",
    date: "2026-09-27",
    title: "Sekiz dilde menü, telefona uygun panel ve yönetimde ödemeler",
    items: [
      { kind: "yeni", text: "Menünüz artık sekiz dilde sunulabiliyor: Türkçe, English, Deutsch, العربية, Français, Español, Italiano ve Русский. Ana diliniz dahil en fazla dört dil açabilirsiniz." },
      { kind: "iyileştirme", text: "Menü dilleri açılır menüden seçiliyor: ana dili seçin, \"Dil ekle\" ile ek dilleri açın. Kapattığınız dilin çevirileri silinmiyor." },
      { kind: "yeni", text: "Mekân özelliklerinde sınır kalktı: Wi-Fi, otopark, teras gibi istediğiniz kadar özellik seçebilirsiniz. Menünüzde ve web sitenizde ikonlarıyla gösteriliyor." },
      { kind: "iyileştirme", text: "Panel telefonda yeniden düzenlendi: yana kayan menü şeridi yerine menü butonuyla açılan yan menü. Ayarlar bölümleri masaüstünde sol listede, telefonda açılır menüde." },
      { kind: "iyileştirme", text: "Panelin hiçbir ekranı telefonda yana kaymıyor; sekmeler, tablolar ve butonlar ekrana sığıyor." },
      { kind: "düzeltme", text: "Arapça menüde bazı oklar ve hizalamalar artık sağdan sola doğru gösteriliyor." },
      { kind: "düzeltme", text: "Kaydet çubuğundaki \"Vazgeç\" butonu telefonda gizleniyor; önceden sığmayıp çubuğu taşırıyordu." },
      { kind: "yeni", text: "Yönetim panelinde Ödemeler: borç kayıtları, alınan ve verilen ödemeler, işletme bazında kalan borç ve filtrelenebilir ödeme geçmişi." },
    ],
    internal: [
      "Menü dilleri: lib/i18n.ts (SUPPORTED_LOCALES = tr en de ar fr es it ru, MAX_MENU_LOCALES = 4, activeLocales en fazla 4 döner), lib/labels.ts, lib/ai/translate.ts dil adı eşlemeleri. Yayınlanmamış Kürtçe (ku) kaldırıldı.",
      "Mekân özellikleri: highlights.maxSelect = seçenek sayısı; components/highlight-list.tsx (menü + site).",
      "shadcn/ui katmanı: components/ui (dialog, sheet, dropdown-menu, tooltip; radix-ui, clsx, tailwind-merge). Panel kitinde Modal/Dropdown Radix'e taşındı; Tabs/NavTabs sığmazsa açılır menü, SectionNav, StatGroup columns/size, buttonClass cn ile birleşiyor.",
      "Gezinme: components/panel/panel-nav.tsx ve admin-shell.tsx (gruplu yan menü + Sheet); components/horizontal-scroll.tsx yalnızca müşteri menüsünde.",
      "Ödemeler: buyur_payments (scripts/payments-schema.mjs), lib/payments.ts, lib/admin-payments.ts, app/api/admin/payments/**, /admin/payments, işletme detayı; payments.view (destek) / payments.edit (super_admin); payment.create|update|delete denetim eylemleri.",
      "Yayın sırası: node scripts/migrate-storefront-i18n.mjs --dry-run → çalıştır (dil seçenekleri, languages.maxSelect = 3, highlights sınırı, vitrin alanları) → node scripts/migrate-payments.mjs --dry-run → çalıştır → deploy.",
      "pnpm-lock.yaml ve pnpm-workspace.yaml kaldırıldı; kurulum yalnızca bun.lock ile. Vercel'in kurulum komutu bun olmalı.",
      "Dokümanlar docs/ altında yeniden düzenlendi: architecture, development-rules, ui-guidelines, localization, admin-panel, payments (+ analytics-architecture, audit-log).",
      "Açık iş: aynı ağaçtaki vitrin/kayan yazı/kılavuz/panel arayüz dili çalışmasının panel İngilizce kataloğu (lib/ui-messages/en/panel.ts) boş; tests/ui-i18n.test.ts panel/en bu yüzden kırmızı. Yayından önce katalog doldurulmalı ya da paneldeki dil seçici gizlenmeli.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-09-27",
    title: "Yardım merkezi ve daha güvenilir yapay zekâ çevirisi",
    items: [
      { kind: "yeni", text: "Yardım merkezi yayında: kurulumdan QR kodlara, çoklu dilden raporlara kadar bütün özellikler adım adım anlatılıyor." },
      { kind: "yeni", text: "Sürüm notları sayfası: her güncellemede neyin değiştiğini buradan takip edebilirsiniz." },
      { kind: "düzeltme", text: "Kampanya başlığı ve mesajı, ürün seçenekleri ve kampanya etiketi için \"AI ile tamamla\" artık doğru alanı dolduruyor; önceden çeviri üretilip boş kalabiliyordu." },
      { kind: "düzeltme", text: "Ana dilde açıklaması olmayan bir ürüne yapay zekâ artık kendiliğinden açıklama uydurmuyor." },
      { kind: "düzeltme", text: "Yapay zekânın dilleri kod yerine adıyla (\"English\" gibi) döndürdüğü durumlarda çeviri artık kaybolmuyor." },
      { kind: "düzeltme", text: "Ayarlarda yeni eklenip henüz kaydedilmemiş dil için \"önce kaydedin\" uyarısı gösteriliyor; buton sessizce o dili atlamıyor." },
      { kind: "iyileştirme", text: "Sayfadan çıkıldığında bekleyen çeviri denemesi tamamen iptal ediliyor." },
    ],
    internal: [
      "lib/ai/translate.ts: buildTranslationPrompt şema örneğini gönderilen alanlardan kurar; normalizeTranslationResult sourceFields (entrySourceFields) ile yalnızca gönderilen alanları kabul eder; extractItems id-sözlüğü, kök dil anahtarı, dizi çeviri ve farklı kök anahtar biçimlerini okur; normalizeLocaleKey dil adlarını tanır; unsavedLocales eklendi.",
      "components/panel/ai/translate-button.tsx: visibleLocales, iptal edilebilir yeniden deneme beklemesi.",
      "Yeni: lib/docs.ts, lib/release-notes.ts, app/docs/**, CHANGELOG.md; navbar/footer/sitemap bağlantıları.",
      "Göç yok.",
    ],
  },
  {
    version: "0.7.1",
    date: "2026-09-26",
    title: "Demo menü yeni adresinde",
    items: [{ kind: "düzeltme", text: "Tanıtım sayfasındaki \"Canlı demo\" bağlantıları yeni demo menü adresine yönlendiriliyor." }],
    internal: ["lib/showcase.ts DEMO_SLUG = \"demo\"."],
  },
  {
    version: "0.7.0",
    date: "2026-09-26",
    title: "Çoklu dilde kaybolan çeviriler ve merkezi denetim kaydı",
    items: [
      { kind: "düzeltme", text: "Sekmeye geri dönünce formun yeniden yüklenip yapay zekâ çevirilerini silmesi giderildi." },
      { kind: "iyileştirme", text: "\"AI ile tamamla\" yalnızca boş çevirileri dolduruyor; elle yazdığınız çeviriye dokunmuyor." },
      { kind: "yeni", text: "İşletme açıklaması da yapay zekâ ile çevrilebiliyor." },
      { kind: "güvenlik", text: "Önemli her işlem merkezi denetim kaydına yazılıyor." },
    ],
    internal: ["docs/audit-log.md; pocketbase/pb_hooks canlı PocketBase'e henüz kurulmadı."],
  },
  {
    version: "0.6.0",
    date: "2026-09-25",
    title: "Yönetim paneli",
    items: [
      { kind: "yeni", text: "İki adımlı yönetici girişi, işletme listesi, askıya alma ve plan/fiyat düzenleme." },
    ],
    internal: ["admin.buyur.in; lib/admin-roles.ts, lib/admin-audit.ts."],
  },
  {
    version: "0.5.0",
    date: "2026-09-25",
    title: "Tek hesap, tek işletme",
    items: [
      { kind: "iyileştirme", text: "Giriş hesabı ile işletme kaydı birleştirildi; kayıt e-posta kodu ile doğrulanıyor." },
    ],
    internal: ["buyur_businesses auth koleksiyonu; scripts/business-schema.mjs."],
  },
];

export function latestRelease(): ReleaseNote {
  return RELEASE_NOTES[0];
}

/** CHANGELOG.md'nin tam metni. Elle düzenlenmez: `bun run changelog` bunu
 *  yazar, test de dosyanın bununla aynı olduğunu kilitler. */
export function renderChangelog(notes: ReleaseNote[] = RELEASE_NOTES): string {
  const lines = [
    "# Sürüm notları",
    "",
    "> Bu dosya `lib/release-notes.ts`'ten üretilir (`bun run changelog`). Elle düzenlemeyin.",
    "> Kullanıcıya görünen hâli: https://buyur.in/docs/surum-notlari",
    "",
  ];
  for (const note of notes) {
    lines.push(`## [${note.version}] — ${note.date}`, "", `**${note.title}**`, "");
    for (const item of note.items) lines.push(`- **${RELEASE_KIND_LABELS[item.kind]}:** ${item.text}`);
    if (note.internal?.length) {
      lines.push("", "Geliştirici notu:", "");
      for (const line of note.internal) lines.push(`- ${line}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
