// Merkezi denetim kaydının SAF katmanı: kim yapabilir (aktör türleri), neyi
// (eylem sözlüğü ve etiketleri), hangi kayıtta (kaynaklar), ne değişti
// (önce/sonra satırları) ve kayıt ekranındaki filtrelerin PocketBase
// sorgusuna çevrilmesi. Ağ yok; hem sunucu hem istemci bileşeni kullanır.
// Sözleşmesi tests/audit-log.test.ts.
//
// Kayıtları yazan üç yer aynı sözlüğü konuşur:
//   - lib/admin-audit.ts (yönetim uçları; kaydı yazılamayan değişiklik geri alınır)
//   - lib/system-audit.ts (kayıt, AI, çıkış gibi sunucu akışları)
//   - pocketbase/pb_hooks (işletme panelinden gelen her yazma ve giriş)
// Eylem adı `<kaynak>.<işlem>` biçimindedir; aynı işlem kimin yaptığından
// bağımsız aynı adı taşır (işletme de yönetici de ürün fiyatını değiştirse
// `product.price_change`). Kimin yaptığı aktör alanlarındadır.

import type { AuditActorType, AuditLog } from "@/lib/types";

export type { AuditActorType, AuditLog };

export const AUDIT_LOG_COLLECTION = "buyur_admin_logs";

export const AUDIT_ACTOR_TYPES: readonly AuditActorType[] = ["admin", "business", "system", "superuser"];

export const AUDIT_ACTOR_LABELS: Record<AuditActorType, string> = {
  admin: "Yönetici",
  business: "İşletme",
  system: "Sistem",
  superuser: "Veritabanı yöneticisi",
};

/** PocketBase hook'unun izlediği koleksiyonlar — pocketbase/pb_hooks/buyur_audit.pb.js
 *  ile birebir aynı (tests/audit-hook.test.ts kilitler). */
export const AUDITED_COLLECTIONS = [
  "buyur_businesses",
  "buyur_categories",
  "buyur_products",
  "buyur_product_options",
  "buyur_popups",
  "buyur_qr_codes",
  "buyur_plans",
  "buyur_settings",
] as const;

/** Kaynak (hedef koleksiyon) → ekranda görünen adı. */
export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  buyur_businesses: "İşletme",
  buyur_categories: "Kategori",
  buyur_products: "Ürün",
  buyur_product_options: "Ürün seçeneği",
  buyur_popups: "Duyuru",
  buyur_qr_codes: "QR kod",
  buyur_plans: "Plan",
  buyur_settings: "Sistem ayarı",
  buyur_admins: "Yönetici",
  ai: "Yapay zekâ",
};

export function auditResourceLabel(collection: string | undefined): string {
  if (!collection) return "";
  return AUDIT_RESOURCE_LABELS[collection] ?? collection;
}

/** Kayıt ekranında gösterilen işlem adları. Listede olmayan işlem ham adıyla
 *  görünür: yeni bir işlem eklenip burası unutulsa da kayıt okunabilir kalır.
 *  Özne yazılmaz; kimin yaptığı satırda ayrıca görünür. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Yönetici hesabı
  "admin.login": "Yönetim paneline giriş yaptı",
  "admin.logout": "Yönetim panelinden çıkış yaptı",
  "admin.password_change": "Şifresini değiştirdi",
  "admin.create": "Yönetici hesabı açtı",
  "admin.role_change": "Yöneticinin rolünü değiştirdi",
  "admin.disable": "Yöneticinin erişimini kapattı",
  "admin.enable": "Yöneticinin erişimini açtı",
  // İşletme hesabı: oturum ve hesap
  "business.register": "Hesap açtı",
  "business.login": "Panele giriş yaptı",
  "business.login_failed": "Başarısız giriş denemesi",
  "business.logout": "Panelden çıkış yaptı",
  "business.password_change": "Şifresini değiştirdi",
  "business.password_reset_request": "Şifre sıfırlama bağlantısı istedi",
  "business.password_reset_done": "Şifresini sıfırladı",
  // İşletme kaydı
  "business.create": "İşletme kaydı oluşturdu",
  "business.update": "İşletme bilgilerini güncelledi",
  "business.delete": "İşletmeyi sildi",
  "business.restore": "Silinen işletmeyi geri aldı",
  "business.email_change": "Giriş e-postasını değiştirdi",
  // Yönetim işlemleri (işletmeye)
  "business.plan_assign": "Plan atadı",
  "business.trial_extend": "Süreyi uzattı",
  "business.ai_quota_reset": "AI kotasını sıfırladı",
  "business.suspend": "Askıya aldı",
  "business.unsuspend": "Askıyı kaldırdı",
  "business.slug_change": "Menü adresini değiştirdi",
  "business.password_reset": "Şifre sıfırlama e-postası gönderdi",
  // Menü içeriği
  "category.create": "Kategori ekledi",
  "category.update": "Kategoriyi güncelledi",
  "category.delete": "Kategoriyi sildi",
  "product.create": "Ürün ekledi",
  "product.update": "Ürünü güncelledi",
  "product.price_change": "Fiyat değiştirdi",
  "product.delete": "Ürünü sildi",
  "product_option.create": "Ürün seçeneği ekledi",
  "product_option.update": "Ürün seçeneğini güncelledi",
  "product_option.delete": "Ürün seçeneğini sildi",
  "popup.create": "Duyuru ekledi",
  "popup.update": "Duyuruyu güncelledi",
  "popup.delete": "Duyuruyu sildi",
  "qr_code.create": "QR kod ekledi",
  "qr_code.update": "QR kodu güncelledi",
  "qr_code.delete": "QR kodu sildi",
  // Planlar
  "plans.edit": "Planı düzenledi",
  "plan.create": "Plan kaydı oluşturdu",
  "plan.update": "Plan kaydını güncelledi",
  "plan.delete": "Plan kaydını sildi",
  // Sistem ayarları
  "settings.edit": "Sistem ayarını değiştirdi",
  "setting.create": "Sistem ayarı kaydı oluşturdu",
  "setting.update": "Sistem ayarı kaydını güncelledi",
  "setting.delete": "Sistem ayarı kaydını sildi",
  // Yapay zekâ
  "ai.menu_scan": "AI ile menü taradı",
  "ai.translate": "AI ile çeviri yaptı",
  "ai.image_search": "AI ile ürün görseli aradı",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/** Filtre seçicisindeki gruplar: eylem önekinden. */
export const AUDIT_ACTION_GROUPS: { label: string; prefix: string }[] = [
  { label: "Yönetici hesabı", prefix: "admin." },
  { label: "İşletme", prefix: "business." },
  { label: "Kategori", prefix: "category." },
  { label: "Ürün", prefix: "product." },
  { label: "Ürün seçeneği", prefix: "product_option." },
  { label: "Duyuru", prefix: "popup." },
  { label: "QR kod", prefix: "qr_code." },
  { label: "Plan", prefix: "plan" },
  { label: "Sistem ayarı", prefix: "setting" },
  { label: "Yapay zekâ", prefix: "ai." },
];

/** Genel bakıştaki "son önemli işlemler": hesap açılışı, plan/erişim
 *  kararları ve sistem ayarları. Sıradan içerik düzenlemeleri burada gürültüdür;
 *  onlar denetim kaydı ekranında filtreyle görülür. */
export const HIGHLIGHT_ACTIONS = [
  "business.register",
  "business.plan_assign",
  "business.trial_extend",
  "business.suspend",
  "business.unsuspend",
  "business.delete",
  "business.restore",
  "business.email_change",
  "business.slug_change",
  "plans.edit",
  "settings.edit",
  "admin.create",
  "admin.role_change",
  "admin.disable",
  "admin.enable",
] as const;

/** Önemli (dikkat isteyen) eylemler: listede vurgulanır. */
const ATTENTION_ACTIONS = new Set([
  "business.delete",
  "business.suspend",
  "business.login_failed",
  "business.email_change",
  "admin.disable",
  "admin.role_change",
  "category.delete",
  "product.delete",
]);

export function isAttentionAction(action: string): boolean {
  return ATTENTION_ACTIONS.has(action);
}

// ---------------------------------------------------------------------------
// Önce / sonra

const FIELD_LABELS: Record<string, string> = {
  name: "Ad",
  description: "Açıklama",
  price: "Fiyat",
  discount_percent: "İndirim %",
  campaign_label: "Kampanya etiketi",
  is_available: "Satışta",
  is_active: "Yayında",
  category: "Kategori",
  order: "Sıra",
  images: "Görseller",
  image_url: "Görsel",
  translations: "Çeviriler",
  slug: "Menü adresi",
  plan: "Plan",
  plan_expires_at: "Plan bitişi",
  freemium_started_at: "Deneme başlangıcı",
  suspended_at: "Askıya alınma",
  suspension_reason: "Askı mesajı",
  deleted_at: "Silinme",
  deletion_reason: "Silme gerekçesi",
  email: "Giriş e-postası",
  phone: "Telefon",
  address: "Adres",
  role: "Rol",
  disabled_at: "Erişim kapatılma",
  ai_scans_used: "AI tarama sayacı",
  ai_scans_period: "AI dönem",
  title: "Başlık",
  message: "Mesaj",
  code: "Kod",
  group_name: "Seçenek grubu",
  price_delta: "Fiyat farkı",
  price_monthly: "Aylık fiyat",
  key: "Anahtar",
  value: "Değer",
};

export function auditFieldLabel(field: string): string {
  const [head, ...rest] = field.split(".");
  const label = FIELD_LABELS[head] ?? head;
  return rest.length ? `${label}.${rest.join(".")}` : label;
}

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Kayıttaki değişikliklerin alan alan listesi. İç içe nesneler (plan
 *  limitleri, çeviriler) bir düzey açılır ve yalnızca değişen anahtarlar
 *  gelir: "limits.menu_views". Oluşturma ve silmede tek taraf boştur. */
export function auditChanges(log: Pick<AuditLog, "before" | "after">): AuditChange[] {
  const before = log.before ?? {};
  const after = log.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: AuditChange[] = [];
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (isPlainObject(a) && isPlainObject(b)) {
      for (const sub of Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))) {
        if (!same(a[sub], b[sub])) changes.push({ field: `${key}.${sub}`, before: a[sub], after: b[sub] });
      }
      continue;
    }
    // Oluşturma/silme anlık görüntüsünde de her alan gösterilir (tek taraflı).
    if (log.before && log.after && same(a, b)) continue;
    changes.push({ field: key, before: a, after: b });
  }
  return changes;
}

/** Değeri tek satır okunur metne çevirir. */
export function showAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "boş";
  if (value === true) return "evet";
  if (value === false) return "hayır";
  if (Array.isArray(value)) return value.length === 0 ? "boş" : value.map(showAuditValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Değişen alanların okunur özeti: "plan: freemium → premium". */
export function auditChangeLines(log: Pick<AuditLog, "before" | "after">): string[] {
  return auditChanges(log).map(({ field, before, after }) => `${field}: ${showAuditValue(before)} → ${showAuditValue(after)}`);
}

/** Kaydı yapanın ekranda görünen adı (eski kayıtlarda aktör alanları boştur). */
export function auditActorEmail(log: Pick<AuditLog, "actor_email" | "admin_email">): string {
  return log.actor_email || log.admin_email || "";
}

export function auditActorType(log: Pick<AuditLog, "actor_type" | "admin">): AuditActorType {
  if (log.actor_type && (AUDIT_ACTOR_TYPES as readonly string[]).includes(log.actor_type)) return log.actor_type;
  return "admin";
}

/** Kaydın ait olduğu işletme (eski kayıtlarda hedef işletmenin kendisi). */
export function auditBusinessId(log: Pick<AuditLog, "business_id" | "target_collection" | "target_id">): string {
  if (log.business_id) return log.business_id;
  return log.target_collection === "buyur_businesses" ? log.target_id ?? "" : "";
}

// ---------------------------------------------------------------------------
// Kayıt ekranı filtreleri

export interface AuditLogQuery {
  /** Serbest metin: eylem, e-posta, gerekçe, kayıt kimliği, önce/sonra içeriği. */
  q: string;
  /** YYYY-MM-DD (İstanbul günü), boş = sınırsız. */
  from: string;
  to: string;
  /** İşletme kimlikleri (ekranda ad/slug ile aranır, sayfa kimliğe çevirir). */
  businessIds: string[];
  /** Ham işletme girdisi (ekranda geri göstermek için). */
  business: string;
  /** Yapanın e-postası ya da kimliği. */
  actor: string;
  actorType: AuditActorType | "";
  action: string;
  resource: string;
  /** Tek bir kaydın geçmişi (hedef kimliği). */
  target: string;
  page: number;
}

export const AUDIT_PAGE_SIZE = 50;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_ID = /^[a-z0-9]{1,30}$/;
const ACTION = /^[a-z_]+\.[a-z_]+$/;
const COLLECTION = /^[a-z_]{1,60}$/;

/** Adres çubuğundaki parametreleri güvenli bir sorguya çevirir; tanınmayan
 *  değer boşa düşer. Parametre adları Türkçe (paylaşılan bağlantılar okunur). */
export function parseAuditLogQuery(params: Record<string, string | undefined>): Omit<AuditLogQuery, "businessIds"> {
  const page = Number.parseInt(params.sayfa ?? "", 10);
  const actorType = params.aktor ?? "";
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    from: DAY.test(params.baslangic ?? "") ? (params.baslangic as string) : "",
    to: DAY.test(params.bitis ?? "") ? (params.bitis as string) : "",
    business: (params.isletme ?? "").trim().slice(0, 100),
    actor: (params.kullanici ?? "").trim().slice(0, 200),
    actorType: (AUDIT_ACTOR_TYPES as readonly string[]).includes(actorType) ? (actorType as AuditActorType) : "",
    action: ACTION.test(params.islem ?? "") ? (params.islem as string) : "",
    resource: COLLECTION.test(params.kaynak ?? "") ? (params.kaynak as string) : "",
    target: RECORD_ID.test(params.hedef ?? "") ? (params.hedef as string) : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function hasAuditFilters(query: Omit<AuditLogQuery, "page" | "businessIds">): boolean {
  return Boolean(
    query.q || query.from || query.to || query.business || query.actor || query.actorType || query.action || query.resource || query.target
  );
}

/** İşletme girdisi doğrudan bir kayıt kimliği mi (ad/slug araması gerekmez). */
export function looksLikeRecordId(value: string): boolean {
  return /^[a-z0-9]{15}$/.test(value);
}

/** İstanbul gününün başlangıcı/sonu (UTC+3, yaz saati yok). */
export function istanbulDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000+03:00`);
}
export function istanbulDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999+03:00`);
}

type FilterFn = (expr: string, params: Record<string, unknown>) => string;

/** Sorguyu PocketBase filtresine çevirir. Her değer `pb.filter()` ile
 *  parametrelenir (CLAUDE.md §3.1). İşletme girdisi eşleşme bulamadıysa
 *  (`businessIds` boş ama `business` dolu) hiçbir kayıt dönmez: yanlış
 *  işletme adıyla bütün kaydı göstermek filtre çalışmış gibi görünürdü. */
export function buildAuditFilter(query: AuditLogQuery, filter: FilterFn): string {
  const parts: string[] = [];
  if (query.q) {
    parts.push(
      filter(
        "(action ~ {:q} || actor_email ~ {:q} || admin_email ~ {:q} || reason ~ {:q} || target_id = {:q} || business_id = {:q} || before ~ {:q} || after ~ {:q} || meta ~ {:q})",
        { q: query.q }
      )
    );
  }
  if (query.from) parts.push(filter("created >= {:from}", { from: istanbulDayStart(query.from) }));
  if (query.to) parts.push(filter("created <= {:to}", { to: istanbulDayEnd(query.to) }));
  if (query.business) {
    if (query.businessIds.length === 0) {
      parts.push('id = ""');
    } else {
      // Eski kayıtlarda işletme yalnızca hedefte durur (göç doldurmadıysa).
      const each = query.businessIds.map((id, i) =>
        filter(`(business_id = {:b${i}} || (target_collection = "buyur_businesses" && target_id = {:b${i}}))`, { [`b${i}`]: id })
      );
      parts.push(`(${each.join(" || ")})`);
    }
  }
  if (query.actor) {
    parts.push(filter("(actor_email ~ {:actor} || admin_email ~ {:actor} || actor_id = {:actor} || admin = {:actor})", { actor: query.actor }));
  }
  if (query.actorType) {
    // Aktör türü boş eski kayıtlar yönetici kaydıdır.
    parts.push(
      query.actorType === "admin"
        ? filter('(actor_type = {:type} || actor_type = "")', { type: query.actorType })
        : filter("actor_type = {:type}", { type: query.actorType })
    );
  }
  if (query.action) parts.push(filter("action = {:action}", { action: query.action }));
  if (query.resource) parts.push(filter("target_collection = {:resource}", { resource: query.resource }));
  if (query.target) parts.push(filter("target_id = {:target}", { target: query.target }));
  return parts.join(" && ");
}

/** Sorguyu adres çubuğu parametrelerine geri çevirir (sayfa bağlantıları için). */
export function auditLogHref(
  query: Omit<AuditLogQuery, "businessIds">,
  patch: Partial<Omit<AuditLogQuery, "businessIds">> = {},
  base = "/admin/logs"
): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.from) params.set("baslangic", next.from);
  if (next.to) params.set("bitis", next.to);
  if (next.business) params.set("isletme", next.business);
  if (next.actor) params.set("kullanici", next.actor);
  if (next.actorType) params.set("aktor", next.actorType);
  if (next.action) params.set("islem", next.action);
  if (next.resource) params.set("kaynak", next.resource);
  if (next.target) params.set("hedef", next.target);
  if (next.page > 1) params.set("sayfa", String(next.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
