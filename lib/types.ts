import type { Locale, Translations } from "@/lib/i18n";
import type { AnalyticsEventType } from "@/lib/analytics/events";
import type { DeviceType, TrafficSource } from "@/lib/analytics/attribution";
import type { ProductImageSource } from "@/lib/ai/image-source";

// Görsel kaynak künyesi lib/ai/image-source.ts'te tanımlıdır (tek kaynak); veri
// modelini kullananlar buradan da okuyabilsin diye yeniden dışa verilir.
export type { ProductImageSource };

export type Plan = "freemium" | "premium" | "elite";
export type Template = "liste" | "grid";

export type Allergen =
  | "gluten"
  | "laktoz"
  | "yumurta"
  | "findik_fistik"
  | "yer_fistigi"
  | "soya"
  | "balik"
  | "kabuklu_deniz_urunu"
  | "susam"
  | "hardal"
  | "kereviz"
  | "sulfit";

export type Badge =
  | "yeni"
  | "sefin_onerisi"
  | "populer"
  | "vejetaryen"
  | "vegan"
  | "aci"
  | "glutensiz";

export type Highlight =
  | "wifi"
  | "vale"
  | "otopark"
  | "cocuk_oyun_alani"
  | "evcil_hayvan_dostu"
  | "teras"
  | "canli_muzik"
  | "rezervasyon"
  | "kredi_karti"
  | "engelli_erisimi"
  | "sigara_alani"
  | "kahvalti";

/** İşletme hesabı: 1 işletme = 1 buyur_businesses kaydı = 1 kimlik (auth
 *  koleksiyonu). Giriş e-postası/şifre bu kaydın auth alanlarıdır; ayrı bir
 *  kullanıcı tablosu yoktur. Ad ve slug kurulum ekranında doldurulana kadar
 *  boştur (bkz. isBusinessSetUp). */
export interface Business {
  id: string;
  /** İşletme adı. */
  name: string;
  slug: string;
  description: string;
  /** Giriş e-postası. Herkese açık okumada yalnızca emailVisibility açıksa gelir;
   *  sahibinin kendi oturumunda her zaman vardır. */
  email?: string;
  /** Giriş e-postası menüde iletişim adresi olarak gösterilsin mi. */
  emailVisibility?: boolean;
  /** Menüde görünen iletişim e-postası — giriş e-postasından farklıysa. */
  contact_email?: string;
  logo_url: string;
  cover_url: string;
  theme: string;
  /** Özel marka rengi (hex). Doluysa preset `theme` yerine bu kullanılır. */
  theme_color?: string;
  /** lib/surfaces.ts'teki SurfaceKey — menü arka planı/yüzey tonu. Boşsa "paper". */
  menu_bg?: string;
  /** lib/fonts.ts'teki FontKey — menü yazı tipi. Boşsa varsayılan (figtree). */
  font?: string;
  template: Template;
  phone: string;
  address: string;
  working_hours: string;
  highlights: Highlight[];
  whatsapp: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  facebook: string;
  google_maps_url: string;
  google_review_url: string;
  wifi_password: string;
  plan: Plan;
  /** Freemium'un başladığı an (plan değişince yeniden yazılır). */
  freemium_started_at?: string;
  /** Freemium süresinin bitiş anı (başlangıç + 1 ay). Ücretli planlarda boş. */
  plan_expires_at?: string;
  /** Genel menü görüntülenme sayacı — Freemium 5.000 limiti buna bakar.
   *  Yalnızca gerçek müşteri sayfa görüntülemeleri sayılır (bkz. /api/track). */
  menu_views?: number;
  /** IANA saat dilimi (ör. "Europe/Istanbul"). Günlük/saatlik analitik
   *  kırılımları bu saat dilimine göre hesaplanır. Boşsa varsayılan kullanılır. */
  timezone?: string;
  is_active: boolean;
  /** İşletmenin ana (baz) dili — ana metinler (name/description) bu dilde tutulur.
   *  Seçilmemişse Türkçe kabul edilir (bkz. lib/i18n.ts mainLocale). */
  main_language?: Locale;
  /** Ana dil dışındaki aktif ek diller. main_language ve languages alanlarının
   *  ikisi de tanımsızsa (eski kayıt) tüm diller aktif sayılır. */
  languages?: Locale[];
  translations?: Translations;
  /** Aktivasyon adımlarının ilk gerçekleştiği anlar (bkz. lib/activation.ts). */
  activation?: BusinessActivation;
  /** Bu dönemde harcanan AI menü tarama hakkı. Dönem `ai_scans_period` ile
   *  birlikte okunur; ay değişince sayaç sıfırdan sayılır (bkz. aiUsage). */
  ai_scans_used?: number;
  /** Sayacın ait olduğu dönem (YYYY-MM, UTC). */
  ai_scans_period?: string;
  created: string;
  updated: string;
}

/** "Menünü yayına hazırla" hunisinin kalıcı işaretleri. Aktivasyon metriği:
 *  ilk QR indirme + ilk gerçek menü görüntülemesi. */
export interface BusinessActivation {
  /** Onboarding'de seçilen sektör şablonu (lib/sector-templates.ts). */
  sector?: string;
  qr_downloaded_at?: string;
  /** Panel kontrol listesinin tamamlandığı an. */
  checklist_completed_at?: string;
}

/** @deprecated Sözlük lib/analytics/events.ts'e taşındı; eski adı kırmamak için alias. */
export type MenuEventType = AnalyticsEventType;

export interface MenuEvent {
  id: string;
  business: string;
  type: AnalyticsEventType;
  target: string;
  label: string;
  /** Oturum anahtarı — unique ziyaretçi/funnel hesapları buna dayanır. */
  session: string;
  /** Birinci taraf rastgele ziyaretçi kimliği (PII değil). */
  visitor: string;
  product?: string;
  category?: string;
  popup?: string;
  qr?: string;
  source: TrafficSource | "";
  medium: string;
  campaign: string;
  referrer_host: string;
  device: DeviceType | "";
  country: string;
  city: string;
  locale: string;
  meta?: Record<string, unknown>;
  /** Event'in sunucuda kaydedildiği an (backfill'e izin verir; `created` PB damgası). */
  occurred_at: string;
  created: string;
  updated: string;
  expand?: {
    product?: Product;
    category?: Category;
    popup?: Popup;
    qr?: QrCode;
  };
}

/** Oturum özeti — unique ziyaretçi, süre, bounce ve yeni/dönen oranı buradan gelir. */
export interface MenuSession {
  id: string;
  business: string;
  /** Oturum anahtarı (cookie'deki değer); işletme başına tekil. */
  key: string;
  visitor: string;
  started_at: string;
  last_seen_at: string;
  duration_sec: number;
  events_count: number;
  page_views: number;
  product_views: number;
  cart_adds: number;
  source: TrafficSource | "";
  medium: string;
  campaign: string;
  referrer_host: string;
  device: DeviceType | "";
  country: string;
  city: string;
  locale: string;
  entry_path: string;
  exit_path: string;
  qr?: string;
  /** Ziyaretçinin daha önce bu işletmede oturumu var mıydı. */
  is_returning: boolean;
  created: string;
  updated: string;
}

export type QrPlacement = "table" | "counter" | "window" | "instagram" | "campaign" | "other";

/** Etiketli QR kodu — menü linkine `?qr=<code>` olarak eklenir. */
export interface QrCode {
  id: string;
  business: string;
  name: string;
  code: string;
  placement: QrPlacement;
  is_active: boolean;
  created: string;
  updated: string;
}

/** Rollup çıktısı: gün × boyut × anahtar → metrikler (bkz. docs/analytics-architecture.md §3). */
export type StatDimension =
  | "total"
  | "hour"
  | "weekday"
  | "page"
  | "product"
  | "category"
  | "source"
  | "device"
  | "country"
  | "city"
  | "qr"
  | "campaign"
  | "search"
  | "funnel"
  | "navigation";

export interface DailyStat {
  id: string;
  business: string;
  /** İşletmenin saat dilimine göre YYYY-MM-DD. */
  date: string;
  dimension: StatDimension;
  key: string;
  label: string;
  metrics: Record<string, number>;
  created: string;
  updated: string;
}

export interface Review {
  id: string;
  business: string;
  is_first_visit: boolean;
  hygiene: number;
  satisfaction: number;
  revisit: number;
  comment: string;
  created: string;
  updated: string;
}

export interface Category {
  id: string;
  business: string;
  name: string;
  description: string;
  image_url: string;
  order: number;
  is_active: boolean;
  translations?: Translations;
  created: string;
  updated: string;
}

export interface Product {
  id: string;
  business: string;
  category: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  /** Otomatik bulunan görselin kaynağı ve lisansı. Kullanıcı kendi görselini
   *  yüklediyse null — künye yalnızca dış kaynaklı görseller için tutulur. */
  image_source?: ProductImageSource | null;
  prep_time_min: number;
  prep_time_max: number;
  calories: number;
  allergens: Allergen[];
  badges: Badge[];
  is_available: boolean;
  order: number;
  discount_percent: number;
  campaign_label: string;
  translations?: Translations;
  created: string;
  updated: string;
  expand?: {
    category?: Category;
  };
}

export interface ProductOption {
  id: string;
  product: string;
  group_name: string;
  name: string;
  price_delta: number;
  order: number;
  translations?: Translations;
  created: string;
  updated: string;
}

export interface Popup {
  id: string;
  business: string;
  title: string;
  message: string;
  image_url: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  translations?: Translations;
  created: string;
  updated: string;
}

// ─── Admin paneli ──────────────────────────────────────────────────

/** `buyur_plans.limits` şeması: yetenek bayrakları ve kotalar. Uygulama bu
 *  alanları canlı OKUR (bkz. lib/entitlements.ts → applyPlanRecords); anahtar
 *  adları o eşlemeyle birebir aynıdır. null = sınırsız. */
export interface PlanLimits {
  /** Fiziksel menüden AI ile ürün aktarımı. */
  ai_menu_import: boolean;
  /** Tek taramada gönderilebilecek en fazla sayfa. */
  ai_pages_per_scan: number;
  /** Ay başına AI tarama hakkı. */
  ai_scans_per_month: number | null;
  ai_translation: boolean;
  /** Temel analitik: özet metrikler + son 7 gün grafiği (Freemium dahil). */
  analytics: boolean;
  /** Gelişmiş analitik: karşılaştırma, funnel, kaynak/cihaz/saat kırılımı, drill-down. */
  analytics_advanced: boolean;
  /** Ham event saklama süresi (gün). Plan düşse de geçmiş silinmez, erişim kapanır. */
  analytics_retention_days: number;
  api_access: boolean;
  branding_removal: boolean;
  campaigns: boolean;
  /** Menüden otomatik üretilen web sitesi. */
  website: boolean;
  /** Otomatik içgörüler + menü performans skoru. */
  insights: boolean;
  /** Menü görüntülenme limiti (null = sınırsız). */
  menu_views: number | null;
  /** Rapor Merkezi. */
  reports: boolean;
  /** Rapor dışa aktarma — PDF/Excel/CSV. */
  reports_export: boolean;
  /** Zamanlanmış rapor gönderimi (şimdilik hiçbir planda açık değil: e-posta altyapısı yok). */
  scheduled_reports: boolean;
}

export interface PlanRecord {
  id: string;
  key: Plan;
  name: string;
  description: string;
  /** Aylık ödemede aylık ücret (₺). Ücretsiz planda 0. */
  price_monthly: number;
  /** Yıllık ödemede aylık eşdeğer ücret (₺); yıllık toplam = bunun 12 katı. */
  price_yearly_monthly: number;
  /** Süreli (deneme) planın kaç ay sürdüğü. 0 = süresiz, ücretli planlar 0. */
  trial_months: number;
  features: string[];
  limits: PlanLimits;
  is_active: boolean;
  is_default: boolean;
  order: number;
  created: string;
  updated: string;
}

