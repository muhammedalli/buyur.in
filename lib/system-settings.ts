// Sistem geneli değişkenler — yönetim panelinin "Sistem" ekranında düzenlenir.
// Sözleşmesi tests/system-settings.test.ts.
//
// KAYNAK `buyur_settings` koleksiyonudur: her satır bir ayar (`key` + `value`).
// Buradaki tanımlar ayarın adını, açıklamasını, izinli aralığını ve YEDEK
// değerini tutar. Kayıt okunamazsa ya da ayar hiç yazılmamışsa yedek geçerlidir
// (CLAUDE.md §3.6: altyapı hatasında kısıtlama değil, bilinen değer). Yeni bir
// ayar = buraya bir tanım + onu okuyan kod; şema değişmez.
//
// Koleksiyon herkese okunur (fiyat sayfası da okur): buraya gizli bir değer
// YAZILMAZ. Yazma yalnızca super_admin'e açıktır ve denetim kaydıyla yapılır
// (app/api/admin/settings).
//
// Okuma plan kataloğuyla aynı turda ve aynı önbellekle yapılır
// (lib/plan-catalog-loader.ts → ensurePlanCatalog): ayar değişikliği en geç
// 60 saniyede her yere yansır.

export const SETTINGS_COLLECTION = "buyur_settings";

export interface SystemSettingDef {
  label: string;
  description: string;
  /** Değerin yanında gösterilen birim. */
  unit: string;
  min: number;
  max: number;
  /** Yalnızca tam sayı mı. */
  integer: boolean;
  /** Kayıt okunamadığında ya da hiç yazılmamışsa geçerli değer. */
  fallback: number;
}

export const SYSTEM_SETTINGS = {
  yearly_discount_percent: {
    label: "Yıllık ödeme indirimi",
    description:
      "Yıllık ödemede her planın aylık fiyatına uygulanır. Fiyat sayfası, işletme paneli ve yasal fiyat tablosu yıllık tutarı buradan hesaplar.",
    unit: "%",
    min: 0,
    max: 90,
    integer: true,
    fallback: 20,
  },
} as const satisfies Record<string, SystemSettingDef>;

export type SystemSettingKey = keyof typeof SYSTEM_SETTINGS;

export const SYSTEM_SETTING_KEYS = Object.keys(SYSTEM_SETTINGS) as SystemSettingKey[];

export function isSystemSettingKey(value: unknown): value is SystemSettingKey {
  return typeof value === "string" && (SYSTEM_SETTING_KEYS as string[]).includes(value);
}

/** `buyur_settings` satırının en küçük şekli. */
export interface SettingRecordLike {
  id?: string;
  key?: string;
  value?: unknown;
  updated?: string;
}

/** Değer tanımın sınırları içinde mi; değilse neden değil (kullanıcı diliyle). */
export function settingValueError(key: SystemSettingKey, value: unknown): string | null {
  const def: SystemSettingDef = SYSTEM_SETTINGS[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return `${def.label} bir sayı olmalı.`;
  if (def.integer && !Number.isInteger(value)) return `${def.label} tam sayı olmalı.`;
  if (value < def.min || value > def.max) return `${def.label} ${def.min}–${def.max} arasında olmalı.`;
  return null;
}

let live: Partial<Record<SystemSettingKey, number>> = {};

/** Kayıtları canlı değer olarak yükler. Tanınmayan anahtar ve sınır dışı
 *  değer yok sayılır: o ayar yedekte kalır, uygulama bozuk bir değerle
 *  (ör. %150 indirim) çalışmaz. */
export function applySystemSettings(records: SettingRecordLike[]): void {
  const next: Partial<Record<SystemSettingKey, number>> = {};
  for (const record of records) {
    if (!isSystemSettingKey(record.key)) continue;
    if (settingValueError(record.key, record.value) !== null) continue;
    next[record.key] = record.value as number;
  }
  live = next;
}

export function resetSystemSettings(): void {
  live = {};
}

/** Ayarın geçerli değeri: canlı kayıt, yoksa yedek. */
export function systemSetting(key: SystemSettingKey): number {
  return live[key] ?? SYSTEM_SETTINGS[key].fallback;
}

/** Ayar canlı kayıttan mı geliyor (yönetim ekranında "yedek değer" uyarısı için). */
export function isSettingLive(key: SystemSettingKey): boolean {
  return live[key] !== undefined;
}

/** Değerin ekranda okunuşu: "%20". */
export function formatSettingValue(key: SystemSettingKey, value: number): string {
  const def: SystemSettingDef = SYSTEM_SETTINGS[key];
  const text = value.toLocaleString("tr-TR");
  return def.unit === "%" ? `%${text}` : def.unit ? `${text} ${def.unit}` : text;
}
