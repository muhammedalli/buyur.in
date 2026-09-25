"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  DraftBanner,
  ErrorText,
  FormActions,
  FormStatusFooter,
  Input,
  Label,
  Modal,
  SaveStatus,
  SectionHeader,
  Switch,
  Textarea,
} from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { REASON_MAX, REASON_MIN } from "@/lib/admin-business-actions";
import {
  EDITABLE_FEATURES,
  FEATURE_LABELS,
  PLAN_LIMITS,
  planChangeImpact,
  type PlanFormValues,
} from "@/lib/admin-plan-edit";
import { useFormDraft } from "@/lib/use-draft";

export interface PlanFormProps {
  planKey: string;
  initial: PlanFormValues;
  updated: string;
  /** Bu plandaki işletme sayısı — onayda gösterilir. */
  businessCount: number;
  isDefault: boolean;
}

/** Sayı alanı: boş bırakılırsa 0 değil NaN döner ki doğrulama yakalasın. */
const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value.replace(",", ".")));

function NullableLimit({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
}) {
  const unlimited = value === null;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          min={0}
          disabled={unlimited}
          value={unlimited ? "" : String(value)}
          placeholder={unlimited ? "Sınırsız" : ""}
          onChange={(e) => onChange(toNumber(e.target.value))}
        />
        <Switch compact checked={unlimited} onChange={(checked) => onChange(checked ? null : 0)} label="Sınırsız" />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

// Plan düzenleme formu. Kaydet'e basınca önce etki özeti ve gerekçe istenir;
// değişiklik denetim kaydıyla yazılır (app/api/admin/plans/[key]).
export function PlanForm({ planKey, initial, updated, businessCount, isDefault }: PlanFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<PlanFormValues>(initial);
  const [bulletsText, setBulletsText] = useState(initial.bullets.join("\n"));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | number>(updated);

  const current = useMemo(
    () => ({ ...values, bullets: bulletsText.split("\n").map((line) => line.trim()).filter(Boolean) }),
    [values, bulletsText]
  );
  const draft = useFormDraft<PlanFormValues>(`admin-plan:${planKey}`, current, initial, updated);
  const impact = planChangeImpact(initial, current);

  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  function openConfirm(e: FormEvent) {
    e.preventDefault();
    // Boş sayı alanı JSON'da null olur ve sunucu onu "sınırsız" okur; limiti
    // kaldırmak ancak "Sınırsız" anahtarıyla bilerek yapılabilmeli.
    const numbers = [
      values.price_monthly,
      values.price_yearly_monthly,
      values.trial_months,
      values.ai_pages_per_scan,
      values.analytics_retention_days,
      values.menu_views ?? 0,
      values.ai_scans_per_month ?? 0,
    ];
    if (numbers.some((n) => !Number.isFinite(n))) {
      setFormError("Boş bırakılan sayı alanları var. Sınırsız yapmak için \"Sınırsız\" anahtarını kullan.");
      return;
    }
    setFormError("");
    setError("");
    setReason("");
    setConfirmOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/plans/${planKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: current, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Plan kaydedilemedi, tekrar dene.");
        return;
      }
      draft.clear();
      setConfirmOpen(false);
      setSavedAt(Date.now());
      toast("Plan kaydedildi. Diğer sunucularda en geç 60 saniyede geçerli olur.");
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  const yearlyTotal = Number.isFinite(values.price_yearly_monthly) ? values.price_yearly_monthly * 12 : null;

  return (
    <>
      {draft.restorable && (
        <DraftBanner
          savedAt={draft.restorable.savedAt}
          onRestore={() => {
            const restored = draft.restorable!.value;
            setValues(restored);
            setBulletsText(restored.bullets.join("\n"));
            draft.dismiss();
          }}
          onDiscard={draft.discard}
        />
      )}

      <form onSubmit={openConfirm}>
        <FormActions saving={saving} saveLabel="Kaydet" />
        {formError && (
          <div className="mb-6">
            <ErrorText>{formError}</ErrorText>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeader title="Genel" />
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="plan-name">Plan adı</Label>
                <Input id="plan-name" maxLength={PLAN_LIMITS.nameMax} value={values.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="plan-description">Açıklama</Label>
                <Textarea
                  id="plan-description"
                  rows={2}
                  maxLength={PLAN_LIMITS.descriptionMax}
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
              <Switch
                checked={values.is_active}
                onChange={(checked) => set("is_active", checked)}
                label="Fiyat sayfasında göster"
                description={isDefault ? "Varsayılan plan (yeni kayıtlar bu planla açılır) pasif yapılamaz." : "Kapalıysa yeni satışa sunulmaz; mevcut işletmeler planında kalır."}
              />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Fiyat ve süre" description="Tutarlar ₺; fiyat sayfası ve yasal fiyat tablosu buradan okur." />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="plan-price-monthly">Aylık ödemede (₺ / ay)</Label>
                <Input
                  id="plan-price-monthly"
                  type="number"
                  step="0.01"
                  min={0}
                  value={Number.isFinite(values.price_monthly) ? String(values.price_monthly) : ""}
                  onChange={(e) => set("price_monthly", toNumber(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="plan-price-yearly">Yıllık ödemede (₺ / ay)</Label>
                <Input
                  id="plan-price-yearly"
                  type="number"
                  step="0.01"
                  min={0}
                  value={Number.isFinite(values.price_yearly_monthly) ? String(values.price_yearly_monthly) : ""}
                  onChange={(e) => set("price_yearly_monthly", toNumber(e.target.value))}
                />
                {yearlyTotal !== null && (
                  <p className="mt-1 text-xs text-ink-soft">Yıllık toplam: {yearlyTotal.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="plan-trial">Süre (ay)</Label>
                <Input
                  id="plan-trial"
                  type="number"
                  min={0}
                  max={PLAN_LIMITS.trialMonthsMax}
                  value={Number.isFinite(values.trial_months) ? String(values.trial_months) : ""}
                  onChange={(e) => set("trial_months", toNumber(e.target.value))}
                />
                <p className="mt-1 text-xs text-ink-soft">
                  0 = süresiz. Süreli planda işletme süre dolunca menüsünü kaybeder; mevcut işletmelerin bitiş tarihi değişmez.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Özellikler" description="Kapatılan özellik bu plandaki işletmelerde hemen kilitlenir." />
            <div className="mt-4 space-y-3">
              {EDITABLE_FEATURES.map((feature) => (
                <Switch
                  key={feature}
                  checked={values.features[feature]}
                  onChange={(checked) => set("features", { ...values.features, [feature]: checked })}
                  label={FEATURE_LABELS[feature]}
                />
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Kotalar" />
            <div className="mt-4 space-y-4">
              <NullableLimit
                id="plan-menu-views"
                label="Menü görüntülenme limiti"
                value={values.menu_views}
                onChange={(value) => set("menu_views", value)}
                hint="Dolunca menü yayından kalkar (süreli planlarda)."
              />
              <NullableLimit
                id="plan-ai-scans"
                label="Aylık AI tarama hakkı"
                value={values.ai_scans_per_month}
                onChange={(value) => set("ai_scans_per_month", value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="plan-pages">Tarama başına sayfa</Label>
                  <Input
                    id="plan-pages"
                    type="number"
                    min={PLAN_LIMITS.pagesPerScan[0]}
                    max={PLAN_LIMITS.pagesPerScan[1]}
                    value={Number.isFinite(values.ai_pages_per_scan) ? String(values.ai_pages_per_scan) : ""}
                    onChange={(e) => set("ai_pages_per_scan", toNumber(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="plan-retention">Veri saklama (gün)</Label>
                  <Input
                    id="plan-retention"
                    type="number"
                    min={PLAN_LIMITS.retentionDays[0]}
                    max={PLAN_LIMITS.retentionDays[1]}
                    value={Number.isFinite(values.analytics_retention_days) ? String(values.analytics_retention_days) : ""}
                    onChange={(e) => set("analytics_retention_days", toNumber(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <SectionHeader title="Fiyat kartı maddeleri" description={`Her satır bir madde (en fazla ${PLAN_LIMITS.bulletsMax}). Yalnızca ürünün bugün yaptığı iş yazılır.`} />
            <Textarea className="mt-4" rows={7} value={bulletsText} onChange={(e) => setBulletsText(e.target.value)} />
          </Card>
        </div>

        <FormStatusFooter status={<SaveStatus saving={saving} savedAt={savedAt} draftSavedAt={draft.draftSavedAt} />} />
      </form>

      <Modal
        open={confirmOpen}
        title="Plan değişikliğini onayla"
        description={`Bu plan şu an ${businessCount.toLocaleString("tr-TR")} işletmede kullanılıyor.`}
        onClose={() => !saving && setConfirmOpen(false)}
        dismissable={!saving}
      >
        <form onSubmit={save} className="space-y-4">
          {impact.length > 0 ? (
            <ul className="space-y-1 rounded-xl border border-line bg-crema/50 px-4 py-3 text-sm">
              {impact.map((line) => (
                <li key={line} className={line.startsWith("Kapanacak") ? "font-semibold text-paprika" : "text-ink"}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Yalnızca metin değişiyor (ad, açıklama ya da kart maddeleri).</p>
          )}
          <p className="text-xs text-ink-soft">Değişiklik bu sunucuda hemen, diğerlerinde en geç 60 saniye içinde geçerli olur.</p>
          <div>
            <Label htmlFor="plan-reason">Gerekçe (denetim kaydına yazılır)</Label>
            <Textarea
              id="plan-reason"
              rows={3}
              required
              minLength={REASON_MIN}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ör. Eylül kampanyası: Premium aylık fiyat güncellendi."
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="submit" loading={saving}>
              Onayla ve kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
