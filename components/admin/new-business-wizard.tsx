"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Card, ErrorText, Input, Label, Modal, Select, SectionHeader, Switch, buttonClass } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { CheckCircleIcon, CopyIcon } from "@/components/icons";
import { MenuAssistant, importDraftToBusiness, statsLine, useMenuSession, type ImportSummary } from "@/components/admin/menu-builder";
import { generatePassword } from "@/lib/admin-onboarding";
import { draftStats } from "@/lib/ai/menu-assistant";
import { SUPPORTED_LOCALES, localeNamesTr, type Locale } from "@/lib/i18n";
import { addMonths } from "@/lib/plan-period";
import { SECTOR_TEMPLATES } from "@/lib/sector-templates";
import { menuUrl } from "@/lib/site";
import { slugify } from "@/lib/slug";

// Yönetim panelinden yeni işletme: bilgiler ve menü asistanı aynı sayfada,
// önizleme ve son onay pencerede. Hesap e-posta kodu olmadan açılır
// (POST /api/admin/businesses, denetim kaydıyla), taslak menü hesap açıldıktan
// hemen sonra kategori kategori yazılır. İşletmeye e-posta gitmez; giriş
// bilgilerini yönetici iletir. Menü tek dilde açılır.
//
// Sıra bilerek böyle: hesap açılmadan menü yazılamaz (kategori işletmeye
// bağlıdır). Hesap açılıp menü yarıda kalırsa ekran hesabı unutmaz; "Tekrar
// dene" yalnızca eksikleri yazar (aktarım idempotent).

export interface WizardPlan {
  key: string;
  name: string;
  trial_months: number;
  is_default: boolean;
}

type FieldKey = "name" | "email" | "phone" | "password" | "slug" | "sector" | "mainLanguage" | "plan" | "expiresOn";

interface Created {
  id: string;
  slug: string;
  loginEmail: string;
  aliased: boolean;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : hint ? <p className="mt-1.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Onay penceresindeki özet satırı. */
function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export function NewBusinessWizard({ plans, userName }: { plans: WizardPlan[]; userName: string }) {
  const { toast } = useToast();
  const session = useMenuSession();
  const defaultPlan = plans.find((plan) => plan.is_default) ?? plans[0];

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [sector, setSector] = useState<string>("restoran");
  const [plan, setPlan] = useState(defaultPlan?.key ?? "");
  const [expiresOn, setExpiresOn] = useState("");
  const [mainLanguage, setMainLanguage] = useState<Locale>("tr");
  const [publish, setPublish] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  useEffect(() => {
    setPassword(generatePassword());
  }, []);

  const draft = session.draft;
  const selectedPlan = plans.find((entry) => entry.key === plan);
  const stats = draftStats(draft);
  const planEnd =
    expiresOn || !selectedPlan || selectedPlan.trial_months <= 0 ? null : formatDay(addMonths(new Date(), selectedPlan.trial_months));
  const endLabel = expiresOn ? formatDay(new Date(`${expiresOn}T12:00:00`)) : (planEnd ?? "Süresiz");

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} kopyalandı.`);
    } catch {
      toast("Kopyalanamadı; elle seçip kopyalayın.", "error");
    }
  }

  async function runImport(businessId: string): Promise<boolean> {
    if (draft.categories.length === 0) return true;
    setProgress({ done: 0, total: draft.categories.length });
    const result = await importDraftToBusiness(businessId, draft, publish, (done, total) => setProgress({ done, total }));
    setProgress(null);
    setSummary(result);
    const clean = result.errors.length === 0 && result.failed === 0;
    if (clean) toast(`${result.created} ürün menüye yazıldı.`);
    else toast(`${result.created} ürün yazıldı, ${result.failed} ürün yazılamadı.`, "error");
    return clean;
  }

  /** Onay penceresini açar; eksik fiyat varken pencere bunu söyler ve onay kapalı kalır. */
  function openConfirm() {
    setFormError("");
    setErrors({});
    setConfirmOpen(true);
  }

  async function submit() {
    if (busy || stats.missingPrices > 0) return;
    setFormError("");
    setBusy(true);
    try {
      let account = created;
      if (!account) {
        const res = await fetch("/api/admin/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, password, slug, sector, mainLanguage, plan, expiresOn, publish }),
        }).catch(() => null);
        const data = (res ? await res.json().catch(() => ({})) : {}) as Partial<Created> & { error?: string; field?: FieldKey };
        if (!res || !res.ok) {
          const message = data.error ?? "Hesap açılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
          if (data.field) {
            // Hata bir form alanındaysa pencere kapanır ve alan görünür olur.
            setErrors({ [data.field]: message });
            setConfirmOpen(false);
            requestAnimationFrame(() => {
              const field = document.getElementById(data.field!);
              field?.scrollIntoView({ block: "center" });
              field?.focus();
            });
          } else {
            setFormError(message);
          }
          return;
        }
        account = { id: data.id!, slug: data.slug!, loginEmail: data.loginEmail ?? email.trim().toLowerCase(), aliased: data.aliased === true };
        setCreated(account);
        toast("İşletme hesabı açıldı.");
      }
      const clean = await runImport(account.id);
      if (clean) setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const locked = busy || created !== null;
  const importDone = created !== null && (draft.categories.length === 0 || (summary !== null && summary.errors.length === 0 && summary.failed === 0));
  const importFailed = summary !== null && (summary.failed > 0 || summary.errors.length > 0);

  if (created && importDone && !confirmOpen) {
    const credentials = `Giriş: ${created.loginEmail}\nŞifre: ${password}\nPanel: ${window.location.origin.replace("//admin.", "//")}/panel/login`;
    return (
      <Card className="chat-in mx-auto max-w-2xl">
        <div className="flex items-start gap-3">
          <CheckCircleIcon size={22} className="mt-0.5 shrink-0 text-herb" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{name} hazır</p>
            <p className="mt-1 text-sm text-ink-soft">
              {summary ? `${summary.created} ürün menüye yazıldı${summary.skipped ? `, ${summary.skipped} ürün zaten vardı` : ""}.` : "Menü boş açıldı; içerik menü sayfasından eklenebilir."}{" "}
              {publish ? "Menü yayında." : "Menü taslakta; işletme panelden yayına alabilir."}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-md border border-line bg-crema/50 p-4 text-sm">
          <p className="font-medium">Giriş bilgileri</p>
          <p className="break-all">
            <span className="text-ink-soft">Giriş e-postası:</span> {created.loginEmail}
          </p>
          <p className="break-all">
            <span className="text-ink-soft">Şifre:</span> <span className="font-mono">{password}</span>
          </p>
          {created.aliased && (
            <p className="text-xs text-paprika-deep">
              {email.trim().toLowerCase()} başka bir hesapta kayıtlı olduğu için giriş adresi yukarıdaki takma ad oldu. Bu adrese giden e-postalar ({email.trim().toLowerCase()}) aynı gelen kutusuna düşer.
            </p>
          )}
          <p className="text-xs text-ink-soft">İşletmeye e-posta gönderilmedi. Bilgileri güvenli bir kanaldan iletin; işletme ilk girişte şifresini değiştirebilir.</p>
          <Button size="sm" variant="outline" onClick={() => void copy(credentials, "Giriş bilgileri")}>
            <CopyIcon size={14} />
            Giriş bilgilerini kopyala
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/admin/businesses/${created.id}`} className={buttonClass("primary")}>
            İşletme sayfası
          </Link>
          <Link href={`/admin/businesses/${created.id}/menu`} className={buttonClass("outline")}>
            Menü içeriği
          </Link>
          <a href={menuUrl(created.slug)} target="_blank" rel="noreferrer" className={buttonClass("outline")}>
            Canlı menü
          </a>
          {/* Tam sayfa yükleme: sihirbazın bütün durumu sıfırlansın. */}
          <a href="/admin/businesses/new" className={buttonClass("ghost")}>
            Yeni işletme aç
          </a>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <SectionHeader title="Hesap" description="İşletmenin panele giriş bilgileri ve menü adresi. Doğrulama kodu istenmez." className="mb-5" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="İşletme adı" error={errors.name}>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} disabled={locked} />
          </Field>
          <Field id="slug" label="Menü adresi" error={errors.slug} hint={slug ? <span className="break-all">buyur.in/{slug}</span> : "İşletme adından önerilir."}>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
              maxLength={60}
              disabled={locked}
            />
          </Field>
          <Field id="email" label="E-posta" error={errors.email} hint="Başka hesapta kayıtlıysa da olur; giriş için takma ad üretilir.">
            <Input id="email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} disabled={locked} />
          </Field>
          <Field id="phone" label="Telefon (isteğe bağlı)" error={errors.phone} hint="Her biçim kabul edilir.">
            <Input id="phone" type="tel" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="05xx xxx xx xx" disabled={locked} />
          </Field>
          <Field id="password" label="Şifre" error={errors.password} hint="Otomatik üretildi; değiştirebilirsiniz.">
            <div className="flex gap-2">
              <Input id="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="font-mono" disabled={locked} />
              <Button variant="outline" onClick={() => setPassword(generatePassword())} disabled={locked}>
                Yenile
              </Button>
            </div>
          </Field>
          <Field id="sector" label="İşletme türü" error={errors.sector} hint="Menünün görünümünü belirler.">
            <Select id="sector" value={sector} onChange={(event) => setSector(event.target.value)} disabled={locked}>
              {SECTOR_TEMPLATES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Plan" className="mb-5" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="plan" label="Plan" error={errors.plan}>
            <Select id="plan" value={plan} onChange={(event) => setPlan(event.target.value)} disabled={locked}>
              {plans.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                  {entry.trial_months > 0 ? ` (${entry.trial_months} ay)` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="expiresOn" label="Bitiş tarihi" error={errors.expiresOn} hint={planEnd ? `Boş bırakılırsa ${planEnd}.` : "Boş bırakılırsa süresiz."}>
            <Input id="expiresOn" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} disabled={locked} />
          </Field>
          <Field id="mainLanguage" label="Menü dili" error={errors.mainLanguage} hint="Ek dil sonra panelden eklenir.">
            <Select id="mainLanguage" value={mainLanguage} onChange={(event) => setMainLanguage(event.target.value as Locale)} disabled={locked}>
              {SUPPORTED_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {localeNamesTr[locale]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <MenuAssistant session={session} businessName={name} userName={userName} disabled={busy} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {created ? "Hesap açıldı, menü yazılamadı" : stats.products > 0 ? `${stats.categories} kategori, ${stats.products} ürünle açılacak` : "Menüsüz açılacak"}
            </p>
            <p className="mt-0.5 text-ink-soft">
              {importFailed ? "Tekrar denediğinizde yalnızca eksik ürünler yazılır." : "Onaylamadan önce bütün bilgileri bir pencerede özetleriz."}
            </p>
          </div>
          <Button onClick={openConfirm} disabled={busy}>
            {created ? "Menüyü tekrar yaz" : "İşletmeyi oluştur"}
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        dismissable={!busy}
        size="lg"
        title={created ? "Menüyü tekrar yaz" : "İşletmeyi oluştur"}
        description={created ? "Hesap açıldı; yalnızca menüde eksik kalan ürünler yazılır." : "Bilgileri kontrol edin; onayladığınızda hesap açılır ve menü yazılır."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={() => void submit()} loading={busy} disabled={stats.missingPrices > 0}>
              {created ? "Menüyü yaz" : "Onayla ve oluştur"}
            </Button>
          </>
        }
      >
        <dl>
          <SummaryRow label="İşletme">
            {name || "—"} <span className="text-ink-soft">· buyur.in/{slug || "—"}</span>
          </SummaryRow>
          <SummaryRow label="Giriş e-postası">
            {created ? created.loginEmail : email.trim().toLowerCase() || "—"}
            {!created && <span className="block text-xs text-ink-soft">Başka hesapta kayıtlıysa takma adla açılır.</span>}
          </SummaryRow>
          <SummaryRow label="Telefon">{phone.trim() || "—"}</SummaryRow>
          <SummaryRow label="Plan">
            {selectedPlan?.name ?? plan} <span className="text-ink-soft">· bitiş: {endLabel}</span>
          </SummaryRow>
          <SummaryRow label="Menü">
            {stats.products > 0 ? statsLine(stats) : "Menüsüz açılır; içerik sonra eklenebilir."}
            <span className="block text-xs text-ink-soft">
              {localeNamesTr[mainLanguage]} · {SECTOR_TEMPLATES.find((item) => item.key === sector)?.label}
            </span>
          </SummaryRow>
        </dl>

        <div className="mt-4 rounded-md border border-line bg-crema/40 p-3">
          <Switch
            checked={publish}
            onChange={setPublish}
            label="Menüyü hemen yayına al"
            description="Kapalıysa hesap ve ürünler taslak açılır; işletme panelden yayına alır."
          />
        </div>

        {stats.missingPrices > 0 && (
          <p className="mt-4 rounded-md border border-paprika/40 bg-paprika/5 px-3 py-2 text-sm text-paprika-deep">
            {stats.missingPrices} ürünün fiyatı eksik. Önizlemede sarı işaretli ürünlerin fiyatını yazın ya da asistana söyleyin.
          </p>
        )}
        {(busy || progress) && (
          <p className="mt-4 text-sm text-ink-soft" role="status">
            {progress ? `Menü yazılıyor: ${progress.done}/${progress.total} kategori…` : "Hesap açılıyor…"}
          </p>
        )}
        {summary && summary.errors.length > 0 && (
          <ul className="mt-4 space-y-0.5 text-xs text-paprika-deep">
            {summary.errors.map((error) => (
              <li key={error} className="break-words">
                {error}
              </li>
            ))}
          </ul>
        )}
        <ErrorText>{formError}</ErrorText>
      </Modal>
    </div>
  );
}
