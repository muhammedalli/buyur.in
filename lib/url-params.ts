// Adres çubuğunda görünen parametre adları, sekme değerleri ve sayfa içi
// çapalar İngilizcedir (?tab=contact, /#pricing, ?status=live). Eski Türkçe
// karşılıkları (?tab=iletisim, /#fiyat, ?durum=live) OKUNMAYA devam eder: yer
// imleri, e-postadaki bağlantılar ve paylaşılmış adresler kırılmasın. Yeni
// bağlantı her zaman İngilizce üretilir; eski ad yalnızca okumada tanınır.
// Saf modül; sözleşmesi tests/url-params.test.ts.

/** İngilizce parametre adı → eski Türkçe adı. */
const LEGACY_PARAM_KEYS = {
  status: "durum",
  sort: "sirala",
  page: "sayfa",
  from: "baslangic",
  to: "bitis",
  business: "isletme",
  user: "kullanici",
  actor: "aktor",
  action: "islem",
  resource: "kaynak",
  target: "hedef",
  type: "tip",
  tab: "sekme",
  denied: "yetkisiz",
} as const;

export type ParamKey = keyof typeof LEGACY_PARAM_KEYS;

type ParamSource = Record<string, string | string[] | undefined>;

/** Parametreyi okur: önce İngilizce adı, yoksa eski Türkçe adı. Dizi gelirse
 *  ilk değer alınır. */
export function readParam(params: ParamSource, key: ParamKey | "q" | "plan"): string | undefined {
  const raw = params[key] ?? (key in LEGACY_PARAM_KEYS ? params[LEGACY_PARAM_KEYS[key as ParamKey]] : undefined);
  return Array.isArray(raw) ? raw[0] : raw;
}

// ── Panel ayarları sekmeleri (/panel/settings?tab=…) ─────────────────────

export const SETTINGS_TABS = ["general", "languages", "theme", "marquee", "amenities", "contact", "social", "panel"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const LEGACY_SETTINGS_TABS: Record<string, SettingsTab> = {
  genel: "general",
  diller: "languages",
  tema: "theme",
  yazi: "marquee",
  ozellik: "amenities",
  iletisim: "contact",
  sosyal: "social",
};

/** ?tab= değerini sekmeye çevirir; eski Türkçe değerleri de tanır. */
export function settingsTabFromParam(value: string | null | undefined): SettingsTab | null {
  if (!value) return null;
  if ((SETTINGS_TABS as readonly string[]).includes(value)) return value as SettingsTab;
  return LEGACY_SETTINGS_TABS[value] ?? null;
}

export function settingsHref(tab: SettingsTab): string {
  return `/panel/settings?tab=${tab}`;
}

// ── Yönetim > Sistem sekmeleri (/admin/system?tab=…) ─────────────────────

export type SystemTab = "settings" | "team";

export function systemTabFromParam(value: string | undefined): SystemTab {
  return value === "team" || value === "ekip" ? "team" : "settings";
}

// ── Tanıtım sayfası çapaları (/#pricing) ────────────────────────────────

/** Eski Türkçe çapa → İngilizce çapa (lib/landing-sections.ts). */
export const LEGACY_SECTION_ANCHORS: Record<string, string> = {
  neden: "why",
  "canli-menu": "live-demo",
  ozellikler: "features",
  panel: "dashboard",
  analiz: "analytics",
  nasil: "how-it-works",
  kullananlar: "customers",
  fiyat: "pricing",
  karsilastir: "compare",
  sss: "faq",
};

/** Adresteki çapa eski Türkçe bir çapaysa İngilizce karşılığını döner, değilse null. */
export function modernSectionAnchor(hash: string): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  return LEGACY_SECTION_ANCHORS[id] ?? null;
}
