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
