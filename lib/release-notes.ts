// Sürüm notlarının TEK KAYNAĞI. /docs/surum-notlari sayfası buradan,
// CHANGELOG.md de bununla birebir aynı başlıklarla yazılır
// (tests/release-notes.test.ts kilitler).
//
// Her geliştirme yayına girmeden önce en üste yeni bir kayıt eklenir
// (CLAUDE.md §12). `items` işletme sahibinin okuyacağı dildedir: ne değişti ve
// ona ne kazandırdı. Kod ayrıntısı `internal`'a yazılır, sayfada görünmez.

import type { UiLocale } from "@/lib/ui-locales";

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
  /** İngilizce karşılık (/en/docs/release-notes): `items` ile aynı sırada, aynı
   *  sayıda. Her yeni sürüm notu bununla birlikte yazılır (test kilitler). */
  en: { title: string; items: string[] };
  /** Geliştirici notu: etkilenen dosyalar, göçler, yayın adımları. Sayfada gösterilmez. */
  internal?: string[];
}

export const RELEASE_KIND_LABELS: Record<ReleaseItemKind, string> = {
  yeni: "Yeni",
  iyileştirme: "İyileştirme",
  düzeltme: "Düzeltme",
  güvenlik: "Güvenlik",
};

export const RELEASE_KIND_LABELS_EN: Record<ReleaseItemKind, string> = {
  yeni: "New",
  iyileştirme: "Improvement",
  düzeltme: "Fix",
  güvenlik: "Security",
};

/** Sayfada gösterilecek hâli: başlık ve maddeler istenen dilde. */
export function localizedReleaseNote(note: ReleaseNote, locale: UiLocale): { title: string; items: { kind: ReleaseItemKind; label: string; text: string }[] } {
  const labels = locale === "en" ? RELEASE_KIND_LABELS_EN : RELEASE_KIND_LABELS;
  return {
    title: locale === "en" ? note.en.title : note.title,
    items: note.items.map((item, index) => ({
      kind: item.kind,
      label: labels[item.kind],
      text: locale === "en" ? (note.en.items[index] ?? item.text) : item.text,
    })),
  };
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.11.0",
    date: "2026-09-27",
    title: "buyur ekibi hesabınızı ve menünüzü sizin için kurabiliyor",
    items: [
      { kind: "yeni", text: "Hesabınızı buyur ekibi sizin yerinize açabilir: planınız ve menü diliniz seçilmiş, menü adresiniz hazır olarak. Size giriş bilgileriniz iletilir; ilk girişte şifrenizi değiştirebilirsiniz." },
      { kind: "yeni", text: "Mevcut menünüz tek seferde aktarılabilir: başka bir QR menü sitesindeki menünüzün bağlantısı, menü dosyası, fotoğrafı ya da düz metni yeter. Okunamayan fiyatlar tahmin edilmez; ekibimiz kontrol edip tamamlar." },
      { kind: "yeni", text: "Aktarım sırasında ürünlerinize uygun görseller otomatik aranabilir; istemediğiniz görsel yayına girmeden kaldırılır." },
      { kind: "iyileştirme", text: "Sayfa adreslerindeki bölüm ve sekme adları İngilizceye geçti (ör. buyur.in/#pricing, ayarlarda ?tab=contact). Daha önce kaydettiğiniz ya da paylaştığınız eski bağlantılar aynı yere açılmaya devam ediyor." },
    ],
    en: {
      title: "The buyur team can now set up your account and menu for you",
      items: [
        "The buyur team can open your account on your behalf, with your plan and menu language selected and your menu address ready. You receive your sign-in details and can change your password on first sign-in.",
        "Your existing menu can be imported in one go: a link to your menu on another QR menu site, a menu file, a photo or plain text is enough. Unreadable prices are never guessed; our team checks and completes them.",
        "Matching images can be searched for your products during import; any image you do not want is removed before it goes live.",
        "Section and tab names in page addresses are now in English (e.g. buyur.in/#pricing, ?tab=contact in settings). Old links you saved or shared still open the same place.",
      ],
    },
    internal: [
      "Yönetim: /admin/businesses/new (NewBusinessWizard) + POST /api/admin/businesses (yeni yetki business.create, yalnızca super_admin; runAuditedCreate, admin'in kendi token'ı — createRule TRUSTED_ADMIN). Kurallar lib/admin-onboarding.ts: OTP yok, telefon engellemez (adminPhone: TR ise biçimlenir, değilse olduğu gibi, boş olabilir), menü tek dilde (languages: []), kurulum alanları dolu açılır (slug/template/main_language/activation.sector). Kayıtlı e-posta PocketBase'de validation_not_unique dönerse giriş e-postası artı adresli takma ada geçer (loginEmailAlias: sahip+slug@alan, gerekirse -2…); ekran giriş adresini gösterir. İşletmeye e-posta gitmez.",
      "Menü asistanı sayfanın içinde (MenuAssistant: avatarlı sohbet, harf harf akan yanıt, yazıyor göstergesi, içerikle uzayan mesaj kutusu; animasyonlar globals.css → chat-in/ai-float/ai-orbit/typing-dot, hareket azaltmada kapalı); önizleme (MenuPreviewModal) ve son onay (oluştur / menüye yaz) pencerede. Durum useMenuSession'da. POST /api/admin/menu-assistant (business.content). Kaynaklar: ek dosya (vision), JSON (bizim biçim → modelsiz), bağlantı, düz metin. Bağlantı okuma kademeli (lib/ai/menu-extract.ts → readMenuLink): düz okuma (SSRF korumalı, HTML + JSON-LD/__NEXT_DATA__) → ürün çıkmazsa sayfayı gerçek tarayıcıda açan Jina Reader (r.jina.ai; JINA_API_KEY isteğe bağlı, MENU_LINK_RENDERER=off kapatır; yalnızca herkese açık, güvenlik kontrolünden geçmiş adres gider) → sayfadaki menü görselleri (en çok 4, vision). \"www.\" ile başlayan protokolsüz adres de bağlantı sayılır. Düzenleme komutları işlem listesi olarak alınır, lib/ai/menu-assistant.ts'te deterministik uygulanır. Model: OPENAI_ASSISTANT_MODEL ?? OPENAI_MENU_MODEL. Denetim: ai.menu_assist.",
      "Toplu görsel: POST /api/admin/menu-assistant/images (kayda yazmaz). Aktarım: POST /api/admin/businesses/[id]/import — kategori başına bir istek, buildImportPlan ile idempotent, sıralı withRetry(verify), tek denetim kaydı category.import; kayıt yazılamazsa bu istekte açılanlar silinir.",
      "Var olan işletmede de: /admin/businesses/[id]/menu → \"Asistanla menü aktar\" (AdminMenuImport, aynı tam ekran asistan).",
      "Taşımalar: parsePages → lib/ai/menu-scan.ts parseMenuPages (i18n panel kapsamına eklendi); toEnglishFoodQuery → lib/ai/image-query.ts. Kit Textarea ref kabul eder (ComponentProps<\"textarea\">). Şema değişikliği ve göç yok.",
      "Adresler İngilizce (lib/url-params.ts, tests/url-params.test.ts): panel ayarları ?tab=general|languages|theme|marquee|amenities|contact|social|panel; landing çapaları her dilde İngilizce (lib/landing-sections.ts, eski /#fiyat → LegacyAnchorRedirect ile /#pricing); yönetim filtreleri status/sort/page/from/to/business/user/actor/action/resource/target/type, sistem ?tab=team, yetkisiz uyarısı ?denied=1. Eski Türkçe adlar readParam ile okunmaya devam eder; yeni bağlantı Türkçe üretilmez (CLAUDE.md §9).",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-09-27",
    title: "Panele yeni görünüm: tam boy yan menü ve sade kartlar",
    items: [
      { kind: "yeni", text: "Panelin sol menüsü artık ekranın tam boyunda. Menü butonuyla ikonlara daraltıp çalışma alanını genişletebilirsiniz; tercihiniz bu cihazda hatırlanır." },
      { kind: "iyileştirme", text: "Menüyü görme, kılavuzu başlatma ve çıkış, yan menünün altındaki işletme adınıza tıklayınca açılan menüde. Üst çubukta hangi sayfada olduğunuz yazıyor." },
      { kind: "iyileştirme", text: "Sayılar ikonlu kartlarda, sekmeler tek bir çerçevede; butonlar ve alanlar daha okunur. Renkleriniz ve yazı tipleri aynı kaldı." },
      { kind: "iyileştirme", text: "Yönetim paneli de aynı yan menüye geçti: hesap ve çıkış işlemleri menünün altında." },
      { kind: "iyileştirme", text: "Panel ve web sitenizdeki büyük harfli, daktilo yazılı etiketler sadeleşti: butonlar, etiketler ve rozetler artık normal yazıyla, daha kolay okunuyor." },
      { kind: "yeni", text: "Panel İngilizce olarak da tam kullanılabiliyor: analizler, raporlar, değerlendirmeler, yapay zekâ ile menü aktarımı ve plan ekranları dahil. Tarih, yüzde ve süreler de seçtiğiniz dile göre yazılıyor." },
      { kind: "iyileştirme", text: "Web sitenizin açılışında görselin üstünde duran dil ve menü butonları kalktı; ziyaretçi aşağı kaydırınca işletme adınız, dil seçici ve \"Menü\" düğmesiyle yapışkan bir üst çubuk beliriyor. Dil seçici artık açılır menü." },
    ],
    en: {
      title: "A new look for the dashboard: full-height sidebar and cleaner cards",
      items: [
        "The dashboard's left menu now runs the full height of the screen. Collapse it to icons with the menu button to widen your workspace; your choice is remembered on this device.",
        "Viewing your menu, starting the guide and signing out are in the menu that opens when you click your business name at the bottom of the sidebar. The top bar shows which page you are on.",
        "Numbers sit in cards with icons, tabs in a single frame; buttons and fields are easier to read. Your colors and fonts stay the same.",
        "The admin panel moved to the same sidebar: account and sign-out actions are at the bottom of the menu.",
        "The all-caps, typewriter-style labels in your dashboard and website were simplified: buttons, labels and badges now use regular text and are easier to read.",
        "The dashboard is fully usable in English, including analytics, reports, reviews, AI menu import and plan screens. Dates, percentages and durations follow your chosen language too.",
        "The language and menu buttons over the cover image on your website are gone; when a visitor scrolls down, a sticky top bar with your business name, a language selector and a \"Menu\" button appears. The language selector is now a dropdown.",
      ],
    },
    internal: [
      "components/ui/sidebar.tsx: shadcn Sidebar'ın sade hâli (SidebarProvider, Sidebar, SidebarHeader/Content/Footer/Group/Item, SidebarBrand, SidebarAccount, SidebarTrigger, SidebarInset). lg+ tam boy yapışkan sütun (w-64 / daraltılmış w-14, localStorage: buyur-panel-sidebar, buyur-admin-sidebar), lg altı Sheet; sayfa değişince yaprak kapanır. Kit (components/panel/ui.tsx) dışa verir.",
      "Kabuklar: app/panel/(dashboard)/layout.tsx + components/panel/panel-nav.tsx (PanelSidebar, PanelBreadcrumb), components/admin/admin-shell.tsx. Başlık yüksekliği --app-header-h = 64px (SidebarProvider'da); eski --panel-header-h / --admin-header-h kalktı.",
      "Büyük harf temizliği: panel/yönetim/site ekranlarındaki `font-mono … uppercase tracking-*` sınıfları TS-AST ile gövde yazısına çevrildi (giriş/kayıt ekranları ve müşteri menüsü hariç).",
      "Panel İngilizce: lib/ui-messages/en/panel.ts dolduruldu (≈1.100 metin); analiz/rapor/değerlendirme/AI aktarım/plan kullanım ekranları t() ile sarıldı. lib/analytics/{reports,score,opportunities}.ts sabit etiketleri msg() ile işaretlendi ve i18n-domains panel kapsamına eklendi. Sunucuda sayıyla üretilen içgörü/rapor özet cümleleri Türkçe kalır (API'ye dil parametresi gerekir). chart-utils biçimleri setChartLocale ile arayüz diline bağlandı (WEEKDAY_LABELS → weekdayLabel/weekdayLabels).",
      "Site: SiteHeader açılışta gizli, hero'nun %35'i geçilince iner (inert); SiteLanguageSwitcher açılır menü (Radix'siz, Esc/dışarı tıklama kapatır).",
      "Kit: Button/Label/Tabs/NavTabs/Switch/Table başlığı font-mono büyük harf yerine gövde yazısı; Tabs bölümlü kontrol (bg-crema p-1); alanlar focus ring-3; Card/Table shadow-xs; PageHeader alt çizgisiz; StatGroup ayrı kartlardan ızgara + isteğe bağlı `icon`. Input/Textarea/Select/Card/Table sınıfları artık cn ile birleşiyor.",
    ],
  },
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
    en: {
      title: "Menus in eight languages, a phone-friendly dashboard and payments in admin",
      items: [
        "Your menu can now be offered in eight languages: Türkçe, English, Deutsch, العربية, Français, Español, Italiano and Русский. You can enable up to four languages including your main one.",
        "Menu languages are picked from a dropdown: choose the main language and enable extra ones with \"Add language\". Translations of a language you switch off are not deleted.",
        "No more limit on venue features: select as many as you like, such as Wi-Fi, parking or terrace. They appear with icons on your menu and website.",
        "The dashboard was reworked for phones: a side menu opened with the menu button instead of a sideways-scrolling strip. Settings sections are in a list on the left on desktop and in a dropdown on phones.",
        "No dashboard screen scrolls sideways on a phone anymore; tabs, tables and buttons fit the screen.",
        "Some arrows and alignments in the Arabic menu are now shown right to left.",
        "The \"Cancel\" button in the save bar is hidden on phones; it used to overflow the bar.",
        "Payments in the admin panel: debt records, received and paid payments, remaining debt per business and a filterable payment history.",
      ],
    },
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
    en: {
      title: "Help center and more reliable AI translation",
      items: [
        "The help center is live: every feature, from setup to QR codes and from multiple languages to reports, is explained step by step.",
        "Release notes page: follow what changed with each update here.",
        "\"Complete with AI\" now fills the right field for campaign title and message, product options and campaign label; before, a translation could be generated and still stay empty.",
        "AI no longer invents a description for a product that has none in the main language.",
        "Translations are no longer lost when the AI returns languages by name (like \"English\") instead of code.",
        "A \"save first\" warning is shown for a language just added in Settings but not saved yet; the button no longer skips that language silently.",
        "A pending translation attempt is fully cancelled when you leave the page.",
      ],
    },
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
    en: {
      title: "Demo menu at its new address",
      items: [
        "The \"Live demo\" links on the landing page now point to the new demo menu address.",
      ],
    },
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
    en: {
      title: "Lost translations in multiple languages and a central audit log",
      items: [
        "Fixed the form reloading and wiping AI translations when you returned to the tab.",
        "\"Complete with AI\" fills only empty translations; it never touches one you wrote yourself.",
        "The business description can be translated with AI too.",
        "Every important action is written to a central audit log.",
      ],
    },
    internal: ["docs/audit-log.md; pocketbase/pb_hooks canlı PocketBase'e henüz kurulmadı."],
  },
  {
    version: "0.6.0",
    date: "2026-09-25",
    title: "Yönetim paneli",
    items: [
      { kind: "yeni", text: "İki adımlı yönetici girişi, işletme listesi, askıya alma ve plan/fiyat düzenleme." },
    ],
    en: {
      title: "Admin panel",
      items: [
        "Two-step admin sign-in, business list, suspension and plan/price editing.",
      ],
    },
    internal: ["admin.buyur.in; lib/admin-roles.ts, lib/admin-audit.ts."],
  },
  {
    version: "0.5.0",
    date: "2026-09-25",
    title: "Tek hesap, tek işletme",
    items: [
      { kind: "iyileştirme", text: "Giriş hesabı ile işletme kaydı birleştirildi; kayıt e-posta kodu ile doğrulanıyor." },
    ],
    en: {
      title: "One account, one business",
      items: [
        "The sign-in account and the business record were merged; sign-up is verified with an email code.",
      ],
    },
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
