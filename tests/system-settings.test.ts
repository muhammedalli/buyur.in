import { afterEach, describe, expect, it } from "vitest";
import { SETTINGS_COLLECTION as SCHEMA_COLLECTION, SETTINGS_RULES, SETTING_SEEDS } from "../scripts/settings-schema.mjs";
import {
  SETTINGS_COLLECTION,
  SYSTEM_SETTINGS,
  SYSTEM_SETTING_KEYS,
  applySystemSettings,
  formatSettingValue,
  isSettingLive,
  isSystemSettingKey,
  resetSystemSettings,
  settingValueError,
  systemSetting,
} from "@/lib/system-settings";
import { AUDITED_COLLECTIONS } from "@/lib/audit-log";

// Sistem geneli değişkenlerin sözleşmesi (lib/system-settings.ts). Değerler
// buyur_settings kaydından okunur; okunamazsa koddaki yedek geçerlidir. Tohum
// değerler (yeni kurulum) yedekle aynı olmalı: aksi hâlde kayıt okunamadığı
// an fiyatlar sessizce değişirdi.

afterEach(() => resetSystemSettings());

describe("sistem ayarları", () => {
  it("koleksiyon adı ve tohum değerler koddaki tanımla aynı", () => {
    expect(SCHEMA_COLLECTION).toBe(SETTINGS_COLLECTION);
    expect(SETTING_SEEDS.map((seed: { key: string }) => seed.key).sort()).toEqual([...SYSTEM_SETTING_KEYS].sort());
    for (const seed of SETTING_SEEDS as { key: string; value: number }[]) {
      expect(isSystemSettingKey(seed.key)).toBe(true);
      if (!isSystemSettingKey(seed.key)) continue;
      expect(seed.value, seed.key).toBe(SYSTEM_SETTINGS[seed.key].fallback);
      expect(settingValueError(seed.key, seed.value)).toBeNull();
    }
  });

  it("yıllık indirim varsayılanı %20 (önceki ilan fiyatları bu orandan)", () => {
    expect(systemSetting("yearly_discount_percent")).toBe(20);
    expect(isSettingLive("yearly_discount_percent")).toBe(false);
    expect(formatSettingValue("yearly_discount_percent", 20)).toBe("%20");
  });

  it("canlı kayıt yedeği ezer; tanınmayan anahtar ve sınır dışı değer yok sayılır", () => {
    applySystemSettings([
      { key: "yearly_discount_percent", value: 25 },
      { key: "uydurma_ayar", value: 5 },
    ]);
    expect(systemSetting("yearly_discount_percent")).toBe(25);
    expect(isSettingLive("yearly_discount_percent")).toBe(true);

    for (const value of [-1, 91, 12.5, "20", null]) {
      applySystemSettings([{ key: "yearly_discount_percent", value }]);
      expect(systemSetting("yearly_discount_percent"), String(value)).toBe(20);
      expect(isSettingLive("yearly_discount_percent")).toBe(false);
    }
  });

  it("değer doğrulaması kullanıcı diliyle konuşur", () => {
    expect(settingValueError("yearly_discount_percent", 30)).toBeNull();
    expect(settingValueError("yearly_discount_percent", 0)).toBeNull();
    expect(settingValueError("yearly_discount_percent", 95)).toBe("Yıllık ödeme indirimi 0–90 arasında olmalı.");
    expect(settingValueError("yearly_discount_percent", 10.5)).toBe("Yıllık ödeme indirimi tam sayı olmalı.");
    expect(settingValueError("yearly_discount_percent", Number.NaN)).toBe("Yıllık ödeme indirimi bir sayı olmalı.");
  });

  it("herkese okunur, yalnızca super_admin yazar; değişiklik denetim kaydına düşer", () => {
    expect(SETTINGS_RULES.listRule).toBe("");
    expect(SETTINGS_RULES.viewRule).toBe("");
    for (const rule of [SETTINGS_RULES.createRule, SETTINGS_RULES.updateRule, SETTINGS_RULES.deleteRule]) {
      expect(rule).toContain('@request.auth.role = "super_admin"');
    }
    expect(AUDITED_COLLECTIONS).toContain(SETTINGS_COLLECTION);
  });
});
