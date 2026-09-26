"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label, Modal, Table, Textarea } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { REASON_MAX, REASON_MIN } from "@/lib/admin-business-actions";
import { formatTL, yearlyMonthlyPrice } from "@/lib/pricing";
import {
  SYSTEM_SETTINGS,
  formatSettingValue,
  settingValueError,
  type SystemSettingKey,
} from "@/lib/system-settings";

// Sistem geneli ayarların listesi ve düzenleme penceresi (yalnızca
// super_admin). Değer değişmeden önce etkisi gösterilir (ör. indirim oranı →
// planların yıllık fiyatı) ve gerekçe istenir; kayıt denetim kaydına düşer
// (app/api/admin/settings).

export interface SettingRow {
  key: SystemSettingKey;
  value: number;
  /** false: kayıt okunamadı ya da hiç yazılmadı; yedek değer geçerli. */
  live: boolean;
  updated: string;
}

export interface PricedPlan {
  name: string;
  monthly: number;
}

export function SystemSettings({ rows, plans }: { rows: SettingRow[]; plans: PricedPlan[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function open(row: SettingRow) {
    setEditing(row);
    setValue(String(row.value));
    setReason("");
    setError("");
  }

  const parsed = value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));
  const valueProblem = editing ? settingValueError(editing.key, parsed) : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || valueProblem) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editing.key, value: parsed, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Ayar kaydedilemedi, tekrar dene.");
        return;
      }
      toast(`${SYSTEM_SETTINGS[editing.key].label} güncellendi. Diğer sunucularda en geç 60 saniyede geçerli olur.`);
      setEditing(null);
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Ayar</th>
            <th className="text-right">Değer</th>
            <th>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const def = SYSTEM_SETTINGS[row.key];
            return (
              <tr key={row.key}>
                <td className="py-4">
                  <p className="font-semibold text-ink">{def.label}</p>
                  <p className="mt-0.5 max-w-xl text-[13px] text-ink-soft">{def.description}</p>
                  {!row.live && (
                    <p className="mt-1 text-[13px] text-paprika-deep">
                      Kayıt okunamadı; yedek değer geçerli. Kaydedince ayar oluşturulur.
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap text-right font-display text-xl font-bold text-ink">{formatSettingValue(row.key, row.value)}</td>
                <td className="w-px whitespace-nowrap text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => open(row)}>
                    Değiştir
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Modal
        open={editing !== null}
        title={editing ? SYSTEM_SETTINGS[editing.key].label : ""}
        description={editing ? SYSTEM_SETTINGS[editing.key].description : undefined}
        onClose={() => !saving && setEditing(null)}
        dismissable={!saving}
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="sm:max-w-[12rem]">
              <Label htmlFor="setting-value">
                Yeni değer ({SYSTEM_SETTINGS[editing.key].unit || "sayı"})
              </Label>
              <Input
                id="setting-value"
                type="number"
                inputMode="numeric"
                min={SYSTEM_SETTINGS[editing.key].min}
                max={SYSTEM_SETTINGS[editing.key].max}
                step={SYSTEM_SETTINGS[editing.key].integer ? 1 : "any"}
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-soft">
                Şu an {formatSettingValue(editing.key, editing.value)} · izinli aralık {SYSTEM_SETTINGS[editing.key].min}–
                {SYSTEM_SETTINGS[editing.key].max}
              </p>
            </div>

            {editing.key === "yearly_discount_percent" && plans.length > 0 && !valueProblem && (
              <div className="rounded-md border border-line bg-crema/40 px-4 py-3 text-sm">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Yıllık ödemede aylık karşılık</p>
                <ul className="mt-2 space-y-1">
                  {plans.map((plan) => (
                    <li key={plan.name} className="flex flex-wrap justify-between gap-x-4">
                      <span className="text-ink">{plan.name}</span>
                      <span className="font-mono text-[13px] tabular-nums text-ink">
                        {formatTL(yearlyMonthlyPrice(plan.monthly, editing.value))} → {formatTL(yearlyMonthlyPrice(plan.monthly, parsed))}
                        <span className="text-ink-soft"> · aylık {formatTL(plan.monthly)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-soft">Fiyat sayfası, işletme paneli ve yasal fiyat tablosu en geç 60 saniyede güncellenir.</p>
              </div>
            )}

            <div>
              <Label htmlFor="setting-reason">Gerekçe (denetim kaydına yazılır)</Label>
              <Textarea
                id="setting-reason"
                rows={2}
                required
                minLength={REASON_MIN}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ör. Yeni yıl kampanyası: yıllık indirim %25."
              />
            </div>
            <ErrorText>{error || (value.trim() !== "" ? valueProblem : "")}</ErrorText>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                Vazgeç
              </Button>
              <Button type="submit" loading={saving} disabled={Boolean(valueProblem)}>
                Onayla ve kaydet
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
