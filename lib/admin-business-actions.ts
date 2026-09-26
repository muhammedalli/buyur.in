// Yönetim panelinden bir işletmeye uygulanan işlemlerin SAF kuralları: hangi
// işlem hangi yetkiyi ister, kayda hangi alanları yazar, hangi girdiyi reddeder.
// Ağ yok; sözleşmesi tests/admin-business-actions.test.ts. Uygulama:
// app/api/admin/businesses/[id]/route.ts (runAuditedUpdate ile).

import { PLAN_ORDER, aiPeriodKey, entitlementsFor } from "@/lib/entitlements";
import { isSuspended, SUSPENSION_REASON_MAX } from "@/lib/business-suspension";
import { deletionPatch, isDeleted, restorePatch } from "@/lib/business-deletion";
import { isValidEmail, normalizeEmail } from "@/lib/otp-client";
import { isReservedSlug, slugify } from "@/lib/slug";
import type { AdminAction } from "@/lib/admin-roles";
import type { Business, Plan } from "@/lib/types";

export type BusinessActionKind =
  | "plan_assign"
  | "trial_extend"
  | "ai_quota_reset"
  | "suspend"
  | "unsuspend"
  | "slug_change"
  | "password_reset"
  | "edit"
  | "email_change"
  | "delete"
  | "restore"
  | "note";

/** İşlem → yetki (lib/admin-roles.ts) ve denetim kaydındaki adı. */
export const BUSINESS_ACTIONS: Record<BusinessActionKind, { permission: AdminAction; logAction: string; label: string }> = {
  plan_assign: { permission: "business.plan_assign", logAction: "business.plan_assign", label: "Plan ata" },
  trial_extend: { permission: "business.trial_extend", logAction: "business.trial_extend", label: "Süreyi uzat" },
  ai_quota_reset: { permission: "business.ai_quota_reset", logAction: "business.ai_quota_reset", label: "AI kotasını sıfırla" },
  suspend: { permission: "business.suspend", logAction: "business.suspend", label: "Askıya al" },
  unsuspend: { permission: "business.suspend", logAction: "business.unsuspend", label: "Askıyı kaldır" },
  slug_change: { permission: "business.slug_change", logAction: "business.slug_change", label: "Menü adresini değiştir" },
  password_reset: { permission: "business.password_reset", logAction: "business.password_reset", label: "Şifre sıfırlama e-postası gönder" },
  edit: { permission: "business.edit", logAction: "business.update", label: "Bilgileri düzenle" },
  email_change: { permission: "business.email_change", logAction: "business.email_change", label: "Giriş e-postasını değiştir" },
  delete: { permission: "business.delete", logAction: "business.delete", label: "İşletmeyi sil" },
  restore: { permission: "business.delete", logAction: "business.restore", label: "Silmeyi geri al" },
  note: { permission: "business.note", logAction: "business.note", label: "Not ekle" },
};

export function isBusinessActionKind(value: unknown): value is BusinessActionKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BUSINESS_ACTIONS, value);
}

/** Gerekçe her işlemde zorunlu: denetim kaydı "ne" kadar "neden"i de taşımalı. */
export const REASON_MIN = 5;
export const REASON_MAX = 500;
export const NOTE_MAX = 2000;
export const TRIAL_EXTEND_MAX_DAYS = 365;
/** Kurulum ekranıyla aynı sınır (buyur_businesses.slug alanı max 60). */
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

export function reasonError(reason: unknown): string | null {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < REASON_MIN) return `Gerekçe en az ${REASON_MIN} karakter olmalı.`;
  if (text.length > REASON_MAX) return `Gerekçe en fazla ${REASON_MAX} karakter olabilir.`;
  return null;
}

export interface ActionInput {
  plan?: unknown;
  /** YYYY-MM-DD; boş = bitiş tarihi yok. */
  expiresOn?: unknown;
  days?: unknown;
  slug?: unknown;
  /** Askıda sahibine panelde gösterilecek mesaj (isteğe bağlı). */
  ownerMessage?: unknown;
  /** Bilgi düzenleme: alan → yeni değer (BUSINESS_EDITABLE_FIELDS). */
  fields?: unknown;
  /** Yeni giriş e-postası. */
  email?: unknown;
  /** Geri alma: silmeden önce yayında mıydı (sunucu silme kaydından okur;
   *  istemciden gelmez). */
  wasActive?: boolean;
}

export type PatchResult = { ok: true; patch: Record<string, unknown> } | { ok: false; error: string };

type BusinessFields = Pick<
  Business,
  "plan" | "plan_expires_at" | "freemium_started_at" | "suspended_at" | "slug"
> &
  Partial<Pick<Business, "deleted_at" | "email">> &
  Partial<Record<BusinessEditableField, unknown>>;

/** Yönetimden düzenlenebilen işletme bilgileri ve şemadaki üst sınırları
 *  (scripts/setup-pocketbase.mjs). Plan, askı, silme ve menü adresi ayrı
 *  işlemlerdir (kendi kuralları ve uyarıları var); görünüm ayarları (tema,
 *  renk, yazı tipi) sahibinin işidir. */
export const BUSINESS_EDITABLE_FIELDS = {
  name: { label: "İşletme adı", max: 120 },
  description: { label: "Açıklama", max: 500 },
  phone: { label: "Telefon", max: 30 },
  address: { label: "Adres", max: 300 },
  working_hours: { label: "Çalışma saatleri", max: 500 },
  contact_email: { label: "İletişim e-postası", max: 200 },
  whatsapp: { label: "WhatsApp", max: 30 },
  instagram: { label: "Instagram", max: 150 },
  google_maps_url: { label: "Google Haritalar bağlantısı", max: 500 },
  is_active: { label: "Yayında", max: 0 },
} as const;

export type BusinessEditableField = keyof typeof BUSINESS_EDITABLE_FIELDS;

export function isEditableField(value: string): value is BusinessEditableField {
  return Object.prototype.hasOwnProperty.call(BUSINESS_EDITABLE_FIELDS, value);
}

/** Yalnızca değişen alanlardan oluşan düzenleme yaması. Boş yama bir
 *  hatadır: "değişiklik yok" kaydı denetim kaydını kirletirdi. */
export function buildBusinessEditPatch(fields: unknown, business: BusinessFields): PatchResult {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return { ok: false, error: "Geçersiz istek." };
  const patch: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields as Record<string, unknown>)) {
    if (!isEditableField(key)) return { ok: false, error: "Bu alan buradan düzenlenemez." };
    const meta = BUSINESS_EDITABLE_FIELDS[key];
    if (key === "is_active") {
      if (typeof raw !== "boolean") return { ok: false, error: "Geçersiz istek." };
      // Kurulumu bitmemiş hesap yayına alınamaz: menü adresi yok.
      if (raw && !business.slug) return { ok: false, error: "Menü adresi olmayan işletme yayına alınamaz." };
      if (raw !== Boolean(business.is_active)) patch.is_active = raw;
      continue;
    }
    if (typeof raw !== "string") return { ok: false, error: "Geçersiz istek." };
    const value = raw.trim();
    if (value.length > meta.max) return { ok: false, error: `${meta.label} en fazla ${meta.max} karakter olabilir.` };
    if (key === "name" && !value && business.slug) return { ok: false, error: "İşletme adı boş olamaz." };
    if (key === "contact_email" && value && !isValidEmail(value)) return { ok: false, error: "Geçerli bir iletişim e-postası girin." };
    if (value !== String(business[key] ?? "")) patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Değişiklik yok." };
  return { ok: true, patch };
}

/** Seçilen günün sonu, İstanbul saatiyle (UTC+3, yaz saati yok). UTC gün
 *  sonu yazılsaydı ekranlarda (İstanbul günüyle gösterilir) bitiş bir gün
 *  sonrası görünürdü. */
function parseDay(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.000+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePbDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Slug girişini kurulum ekranıyla aynı biçime indirger. */
export function normalizeSlugInput(value: unknown): string {
  return typeof value === "string" ? slugify(value) : "";
}

export function slugError(slug: string, current: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) return `Menü adresi ${SLUG_MIN}–${SLUG_MAX} karakter olmalı.`;
  if (!/^[a-z0-9-]+$/.test(slug)) return "Menü adresi yalnızca küçük harf, rakam ve tire içerebilir.";
  if (isReservedSlug(slug)) return "Bu adres sistem tarafından kullanılıyor, başka bir adres seç.";
  if (slug === current) return "Yeni adres mevcut adresle aynı.";
  return null;
}

/** Kayda yazılacak alanlar. Plan adına göre dal yok: süre sınırı olup
 *  olmadığı plan kataloğundan okunur (lib/entitlements.ts). */
export function buildBusinessPatch(
  kind: Exclude<BusinessActionKind, "password_reset" | "note">,
  input: ActionInput,
  business: BusinessFields,
  now: Date = new Date(),
  reason = ""
): PatchResult {
  // Silinmiş işletmede tek işlem geri almaktır: silinmiş kayıtta plan/askı
  // değiştirmek geri alındığında sürpriz üretirdi.
  if (isDeleted(business) && kind !== "restore") {
    return { ok: false, error: "İşletme silinmiş. Önce silmeyi geri alın." };
  }
  switch (kind) {
    case "edit":
      return buildBusinessEditPatch(input.fields, business);

    case "email_change": {
      if (!isValidEmail(input.email)) return { ok: false, error: "Geçerli bir e-posta adresi girin." };
      const email = normalizeEmail(input.email);
      if (email === normalizeEmail(business.email ?? "")) return { ok: false, error: "Yeni e-posta mevcut e-postayla aynı." };
      return { ok: true, patch: { email } };
    }

    case "delete":
      return { ok: true, patch: deletionPatch({ ...business, is_active: Boolean(business.is_active) }, reason, now) };

    case "restore":
      if (!isDeleted(business)) return { ok: false, error: "İşletme silinmiş değil." };
      return { ok: true, patch: restorePatch(business, input.wasActive === true) };

    case "plan_assign": {
      if (typeof input.plan !== "string" || !(PLAN_ORDER as string[]).includes(input.plan)) {
        return { ok: false, error: "Geçerli bir plan seç." };
      }
      const plan = input.plan as Plan;
      const expiresRaw = typeof input.expiresOn === "string" ? input.expiresOn.trim() : "";
      const expires = expiresRaw ? parseDay(expiresRaw) : null;
      if (expiresRaw && !expires) return { ok: false, error: "Bitiş tarihi okunamadı." };
      if (expires && expires.getTime() <= now.getTime()) return { ok: false, error: "Bitiş tarihi ileri bir tarih olmalı." };

      const timeLimited = entitlementsFor(plan).limits.durationMonths !== null;
      // Süre sınırlı planda bitiş tarihi yoksa limit hemen dolmuş sayılırdı (süresiz değil).
      if (timeLimited && !expires) return { ok: false, error: "Süreli planda bitiş tarihi zorunlu." };
      if (plan === business.plan && (expires?.toISOString() ?? "") === (parsePbDate(business.plan_expires_at)?.toISOString() ?? "")) {
        return { ok: false, error: "İşletme zaten bu planda ve bu bitiş tarihinde." };
      }

      const patch: Record<string, unknown> = { plan, plan_expires_at: expires ? expires.toISOString() : "" };
      // Süreli plana (yeniden) geçişte süre bugünden başlar.
      if (timeLimited && business.plan !== plan) patch.freemium_started_at = now.toISOString();
      return { ok: true, patch };
    }

    case "trial_extend": {
      const days = typeof input.days === "number" ? input.days : Number(input.days);
      if (!Number.isInteger(days) || days < 1 || days > TRIAL_EXTEND_MAX_DAYS) {
        return { ok: false, error: `Gün sayısı 1–${TRIAL_EXTEND_MAX_DAYS} arasında olmalı.` };
      }
      const current = parsePbDate(business.plan_expires_at);
      if (!current) return { ok: false, error: "Bu işletmenin bitiş tarihi yok; uzatılacak bir süre bulunmuyor." };
      // Süresi dolmuşsa bugünden, dolmamışsa mevcut bitişten itibaren uzatılır.
      const base = Math.max(current.getTime(), now.getTime());
      return { ok: true, patch: { plan_expires_at: new Date(base + days * 86_400_000).toISOString() } };
    }

    case "ai_quota_reset":
      return { ok: true, patch: { ai_scans_used: 0, ai_scans_period: aiPeriodKey(now) } };

    case "suspend": {
      if (isSuspended(business)) return { ok: false, error: "İşletme zaten askıda." };
      const message = typeof input.ownerMessage === "string" ? input.ownerMessage.trim() : "";
      if (message.length > SUSPENSION_REASON_MAX) {
        return { ok: false, error: `Sahibine gösterilecek mesaj en fazla ${SUSPENSION_REASON_MAX} karakter olabilir.` };
      }
      return { ok: true, patch: { suspended_at: now.toISOString(), suspension_reason: message } };
    }

    case "unsuspend":
      if (!isSuspended(business)) return { ok: false, error: "İşletme askıda değil." };
      return { ok: true, patch: { suspended_at: "", suspension_reason: "" } };

    case "slug_change": {
      const slug = normalizeSlugInput(input.slug);
      const error = slugError(slug, business.slug ?? "");
      if (error) return { ok: false, error };
      return { ok: true, patch: { slug } };
    }
  }
}
