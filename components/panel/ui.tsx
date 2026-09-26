"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { ChevronDownIcon, LockIcon, SparklesIcon } from "@/components/icons";
import { formatSavedTime } from "@/lib/format";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

// Panel ve yönetim ekranlarının tek UI kiti. Köşe yarıçapı standardı 6px'tir
// (`rounded-md`): buton, alan, kart, tablo, pencere ve açılır menü aynı dili
// konuşur. Hap (pill) biçimi yalnızca anahtar (switch) ve durum noktası gibi
// gerçekten yuvarlak öğelerde kalır.

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  const { className = "", ...rest } = props;
  return (
    <label
      className={`mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft ${className}`}
      {...rest}
    />
  );
}

const FIELD_BASE =
  "w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/50 focus:border-paprika disabled:cursor-not-allowed disabled:bg-crema/40 disabled:text-ink-soft";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${FIELD_BASE} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${FIELD_BASE} ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`${FIELD_BASE} ${className}`} {...rest} />;
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-mono uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50";

// Boyut ayrı tutulur: className ile dolgu ezmek Tailwind'de sıraya bağlı
// kaldığı için güvenilir değil.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-[13px]",
  sm: "px-3 py-1.5 text-[11px]",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-paprika",
  outline: "border border-line bg-paper text-ink hover:border-paprika hover:text-paprika",
  ghost: "text-ink-soft hover:text-paprika",
  danger: "border border-paprika/40 text-paprika hover:bg-paprika hover:text-paper",
};

// Bağlantıya (a / next Link) buton görünümü verir. Panelde el yazımı buton
// sınıfı kullanılmaz; tıklanabilir her şey aynı dili konuşsun diye stil
// tek yerden, buradan alınır.
export function buttonClass(variant: ButtonVariant = "primary", className = "", size: ButtonSize = "md") {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`;
}

export function Button({ variant = "primary", size = "md", loading, className = "", disabled, children, ...rest }: ButtonProps) {
  // Yüklenirken etiket görünmez olur ama yerini korur: buton daralıp
  // yanındakileri kaydırmasın.
  return (
    <button
      className={buttonClass(variant, `relative ${className}`, size)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={`inline-flex items-center gap-2 ${loading ? "invisible" : ""}`}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className="h-4 w-4" />
          <span className="sr-only">İşleniyor</span>
        </span>
      )}
    </button>
  );
}

export function AiButton({
  className = "",
  children = "Yapay Zeka ile Tara",
  ...rest
}: Omit<ButtonProps, "variant" | "size" | "loading">) {
  return (
    <div className="relative group/aibtn inline-block">
      <style>{`
        @keyframes ai-sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.15) rotate(15deg); }
        }
        @keyframes ai-shimmer {
          0% { left: -50%; transform: skewX(-20deg); }
          100% { left: 150%; transform: skewX(-20deg); }
        }
      `}</style>
      <button
        {...rest}
        className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-gradient-to-br from-paprika to-paprika-deep px-5 py-2.5 font-mono text-[13px] uppercase tracking-wider text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <div className="absolute top-0 bottom-0 w-12 bg-white/20 blur-[2px]" style={{ animation: "ai-shimmer 2.5s infinite linear" }} />
        </div>
        <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />

        <div style={{ animation: "ai-sparkle 2s infinite ease-in-out" }} className="relative z-10 drop-shadow-md">
          <SparklesIcon size={18} />
        </div>

        <span className="relative z-10 font-bold drop-shadow-sm">{children}</span>
      </button>

      <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-3 hidden w-64 md:block -translate-x-1/2 -translate-y-2 rounded-md border border-line bg-paper p-3 opacity-0 shadow-xl transition-all duration-300 group-hover/aibtn:translate-y-0 group-hover/aibtn:opacity-100">
        <p className="mb-2 text-center text-xs font-medium leading-relaxed text-ink">
          Fiziksel menünüzün fotoğrafını çekin, yapay zeka ürünleri otomatik okuyup listeye eklesin.
        </p>
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-crema border border-line/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/ai-scan.jpg" alt="Yapay zekâ tarama örneği" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="absolute -top-[8px] left-1/2 h-0 w-0 -translate-x-1/2 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent border-b-line">
          <div className="absolute top-[2px] left-1/2 h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-b-[7px] border-transparent border-b-paper" />
        </div>
      </div>
    </div>
  );
}

// Bir alanın ya da alan grubunun yanına yerleşen kompakt yapay zekâ eylem
// butonu. AiButton ile aynı görsel dili taşır (gradyan + kıvılcım) ama
// tanıtım balonu yoktur: kullanıcı ne olacağını yanındaki alandan bilir.
export function AiActionButton({
  className = "",
  loading,
  disabled,
  children,
  ...rest
}: Omit<ButtonProps, "variant" | "size">) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md bg-gradient-to-br from-paprika to-paprika-deep px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-paper shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      {loading ? (
        <Spinner className="relative z-10 h-3.5 w-3.5" />
      ) : (
        <SparklesIcon size={14} className="relative z-10" />
      )}
      <span className="relative z-10 font-bold">{children}</span>
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

export function Card({ children, className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-md border border-line bg-paper p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-soft">{description}</p>}
      </div>
      {/* Eylemler her ekranda aynı yerde: sağ üst. */}
      {action && <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">{action}</div>}
    </div>
  );
}

// Kart ya da bölüm başlığı: başlık solda, eylem sağ üstte. Panelin her
// ekranında aynı hizayı korumak için elle başlık yazmak yerine bu kullanılır.
export function SectionHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <p className="font-display text-lg font-bold">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {action && <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">{action}</div>}
    </div>
  );
}

// Bir bölümün sağ alt köşesine yerleşen bilgi satırı: kaydetme durumu, son
// güncelleme tarihi, küçük uyarılar. Panelde bu tür bildirimler her zaman
// sağ altta durur; kullanıcı nereye bakacağını bir kez öğrenir.
export function FooterNote({ children, className = "" }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div className={`mt-4 flex flex-wrap items-center justify-end gap-2 text-right text-xs text-ink-soft ${className}`}>
      {children}
    </div>
  );
}

// Kaydın son güncellenme zamanı — sağ alt bilgi satırında kullanılır.
export function UpdatedAt({ at, label = "Son güncelleme" }: { at?: number | string | null; label?: string }) {
  const ms = typeof at === "string" ? Date.parse(at.replace(" ", "T")) : (at ?? null);
  if (ms === null || !Number.isFinite(ms)) return null;
  return (
    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
      {label} · {formatSavedTime(ms as number)}
    </span>
  );
}

/** Önceki oturumdan kalmış, kaydedilmemiş taslak bildirimi. */
export function DraftBanner({ savedAt, onRestore, onDiscard }: { savedAt: number; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paprika/30 bg-paprika/5 px-4 py-3 text-sm">
      <p>
        <span className="font-semibold">Kaydedilmemiş bir taslağın var</span>
        <span className="text-ink-soft"> · {formatSavedTime(savedAt)}</span>
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          Sil
        </Button>
        <Button type="button" size="sm" onClick={onRestore}>
          Geri yükle
        </Button>
      </div>
    </div>
  );
}

// Sabit eylem çubuğu (kaydet/yayınla çubuğu). Formun en önemli eylemleri
// sayfa kaydırılınca kaybolmasın diye çubuk yapışkandır: masaüstünde
// başlığın hemen altında, mobilde ekranın altında (başparmak erişimi) durur.
// Soldaki durum satırı kullanıcıya neyin canlıda olduğunu söyler; kayıt
// durumu ayrıca formun altında tekrar edilmez.
//
// Çubuğun mobilde alta inebilmesi için formun `flex flex-col` olması gerekir
// (`order` ile yer değiştirir); bkz. FORM_STACK.
export const FORM_STACK = "flex flex-col gap-6";

let actionBarCount = 0;

/** Mobilde alttaki çubuk görünürken bildirimler (toast) onun üstüne çıkar. */
function useActionBarMarker() {
  useEffect(() => {
    actionBarCount += 1;
    document.documentElement.dataset.actionBar = "1";
    return () => {
      actionBarCount -= 1;
      if (actionBarCount <= 0) delete document.documentElement.dataset.actionBar;
    };
  }, []);
}

function toMs(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = typeof value === "string" ? Date.parse(value.replace(" ", "T")) : value;
  return Number.isFinite(ms) ? ms : null;
}

function ActionBarStatus({
  saving,
  dirty,
  savedAt,
  draftSavedAt,
  error,
}: {
  saving?: boolean;
  dirty?: boolean;
  savedAt?: number | string | null;
  draftSavedAt?: number | null;
  error?: ReactNode;
}) {
  const savedMs = toMs(savedAt);
  let tone = "text-ink-soft";
  let dot = "";
  let long: ReactNode = null;
  let short: ReactNode = null;

  if (saving) {
    long = short = "Kaydediliyor…";
  } else if (error) {
    tone = "text-paprika-deep";
    dot = "bg-paprika";
    long = short = error;
  } else if (dirty || (draftSavedAt && (savedMs === null || draftSavedAt > savedMs))) {
    tone = "text-ink";
    dot = "bg-paprika";
    long = draftSavedAt
      ? `Kaydedilmemiş değişiklikler · taslak ${formatSavedTime(draftSavedAt)}`
      : "Kaydedilmemiş değişiklikler";
    short = "Kaydedilmedi";
  } else if (savedMs !== null) {
    tone = "text-herb";
    dot = "bg-herb";
    long = `Son kaydedildi · ${formatSavedTime(savedMs)}`;
    short = "Kaydedildi";
  }

  return (
    <p role="status" aria-live="polite" className={`flex min-w-0 flex-1 items-center gap-2 text-xs sm:text-sm ${tone}`}>
      {saving ? <Spinner className="h-3.5 w-3.5 shrink-0" /> : dot ? <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} /> : null}
      <span className="hidden truncate sm:inline">{long}</span>
      <span className="truncate sm:hidden">{short}</span>
    </p>
  );
}

export function FormActions({
  saving,
  dirty,
  savedAt,
  draftSavedAt,
  error,
  onCancel,
  saveLabel = "Kaydet",
  cancelLabel = "Vazgeç",
  toggle,
  extra,
}: {
  saving?: boolean;
  /** Form kayıtlı hâlinden farklı mı (useFormDraft().dirty). */
  dirty?: boolean;
  /** Son başarılı kayıt (ms) ya da kaydın `updated` alanı. */
  savedAt?: number | string | null;
  /** Bu oturumda yerel taslağın en son saklandığı an. */
  draftSavedAt?: number | null;
  /** Kısa hata metni; durum satırında gösterilir. */
  error?: ReactNode;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  toggle?: { checked: boolean; onChange: (checked: boolean) => void; label: string };
  /** Formun genel eylemi (tek bir alana bağlı olmayan). Alana bağlı yapay
   *  zekâ eylemleri alanın yanında durur, burada tekrar edilmez. */
  extra?: ReactNode;
}) {
  useActionBarMarker();
  return (
    <div
      className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 order-last lg:bottom-auto lg:top-[calc(var(--app-header-h,69px)+0.75rem)] lg:order-first"
    >
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper/95 px-3 py-2 shadow-lg shadow-ink/10 backdrop-blur sm:gap-3 sm:px-4">
        <ActionBarStatus saving={saving} dirty={dirty} savedAt={savedAt} draftSavedAt={draftSavedAt} error={error} />
        {extra}
        {toggle && <Switch compact checked={toggle.checked} onChange={toggle.onChange} label={toggle.label} />}
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="hidden sm:inline-flex">
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

// Yatay sekme çubuğu — aktif sekmenin altında vurgu çizgisi.
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = "mb-6",
}: {
  tabs: { key: T; label: ReactNode; ariaLabel?: string }[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={t.ariaLabel}
            onClick={() => onChange(t.key)}
            className={`relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 pt-1 text-[13px] font-semibold uppercase tracking-wide transition-colors ${
              isActive ? "border-paprika text-paprika" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Aç/kapa anahtarı (checkbox yerine). Sağda yeşil switch, solda etiket/açıklama.
// `compact` verilirse (ör. FormActions içinde kaydet butonunun yanında)
// açıklamasız, küçük, tek satırlık hâli kullanılır.
export function Switch({
  checked,
  onChange,
  label,
  description,
  compact,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <label className="flex shrink-0 cursor-pointer items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-herb" : "bg-ink/20"
            }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-paper shadow transition-transform ${checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
              }`}
          />
        </button>
      </label>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-herb" : "bg-ink/20"
          }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-paper shadow transition-transform ${checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
            }`}
        />
      </button>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-paprika-deep">{children}</p>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line px-6 py-14 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
      {action}
    </div>
  );
}

// Bir özellik mevcut planda kapalıysa gösterilen kilitli-özellik kartı.
// EmptyState'ten farkı: "boş" değil "erişimin yok" mesajı verir ve plan sayfasına
// yönlendirir — yükseltme akışı orada başlar. Hangi planın önerileceğine burada
// karar verilmez: sayfalar components/panel/plan-gate.tsx → FeatureLocked'u
// kullanır, o da CTA'yı lib/entitlements.ts'ten kurar. ctaLabel null ise
// (en üst plan) yükseltme bağlantısı hiç çizilmez.
export function UpgradeNotice({
  title,
  description,
  ctaLabel = "Planımı yükselt",
}: {
  title: string;
  description: string;
  ctaLabel?: string | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-paprika/40 bg-paprika/5 px-6 py-14 text-center sm:py-16">
      <LockIcon size={22} className="text-paprika" />
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="max-w-md text-sm text-ink-soft">{description}</p>
      {ctaLabel && (
        <Link href="/panel/plan" className={buttonClass("primary", "mt-1")}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

// Panelin tek modal kabuğu. Onay diyaloğundan (confirm-dialog.tsx) farkı:
// içine serbest içerik alır — görsel ızgarası, uzun liste, form parçası.
// Mobilde alttan açılan yaprak, masaüstünde ortalanmış pencere olur.
const MODAL_WIDTHS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
} as const;

export function Modal({
  open,
  title,
  description,
  size = "md",
  onClose,
  footer,
  children,
  /** Kritik bir işlem sürerken dışarı tıklayarak/ESC ile kapatmayı kapatır. */
  dismissable = true,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof MODAL_WIDTHS;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  dismissable?: boolean;
}) {
  // Arkadaki sayfa kaymasın — mobilde modal içi kaydırma karışıyor.
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissable) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={() => dismissable && onClose()}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-md border border-line bg-paper shadow-2xl shadow-ink/30 sm:rounded-md ${MODAL_WIDTHS[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="-mr-1 shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-crema/40 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Açılır eylem menüsü: sık kullanılmayan ya da ikincil eylemleri tek bir
// butonun altında toplar (ör. işletme işlemleri, hesap menüsü). Dışarı
// tıklayınca, Esc'e basınca ve bir öğe seçilince kapanır; ok tuşlarıyla
// gezilir.
export type DropdownEntry =
  | { label: string; onSelect: () => void; tone?: "danger"; disabled?: boolean; description?: string }
  | "separator";

export function Dropdown({
  trigger,
  items,
  align = "end",
  label,
  triggerClassName,
}: {
  /** Butonun içeriği. */
  trigger: ReactNode;
  items: DropdownEntry[];
  align?: "start" | "end";
  /** Ekran okuyucu için menü adı. */
  label: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    // Açılınca ilk öğeye odaklan: klavyeyle hemen gezilebilsin.
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMenuKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? nodes.length - 1
          : event.key === "ArrowDown"
            ? (index + 1) % nodes.length
            : (index - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName ?? buttonClass("outline", "", "sm")}
      >
        {trigger}
        <ChevronDownIcon size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={`absolute top-full z-50 mt-2 w-max min-w-[13rem] max-w-[calc(100vw-2.5rem)] rounded-md border border-line bg-paper p-1 shadow-xl shadow-ink/15 ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, index) =>
            item === "separator" ? (
              <div key={`sep-${index}`} role="separator" className="my-1 border-t border-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-crema focus-visible:bg-crema disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.tone === "danger" ? "text-paprika-deep" : "text-ink"
                }`}
              >
                <span>{item.label}</span>
                {item.description && <span className="text-xs text-ink-soft">{item.description}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Özet sayı şeridi: birkaç metriği tek çerçevede, ince çizgilerle ayrılmış
// hücrelerde gösterir. Her sayıyı ayrı karta bölmek yerine kullanılır.
export interface StatItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}

export function StatGroup({ items, className = "" }: { items: StatItem[]; className?: string }) {
  return (
    <div
      style={{ "--stat-cols": items.length } as CSSProperties}
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-[repeat(var(--stat-cols),minmax(0,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 ${className}`}
    >
      {items.map((item) => {
        const body = (
          <>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{item.label}</p>
            <p className="mt-1 font-display text-2xl font-bold leading-tight text-ink">{item.value}</p>
            {item.hint && <p className="mt-0.5 text-xs text-ink-soft">{item.hint}</p>}
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="block min-w-0 bg-paper px-5 py-4 transition-colors hover:bg-crema/50">
            {body}
          </Link>
        ) : (
          <div key={item.label} className="min-w-0 bg-paper px-5 py-4">
            {body}
          </div>
        );
      })}
    </div>
  );
}

// Tablo kabuğu. Hücre stilleri burada tek yerden verilir; sayfalar düz
// <table> işaretlemesi yazar (thead/th/td), görünüm her ekranda aynı olur.
// Dar ekranda ikincil sütunlar `hidden sm:table-cell` ile gizlenir; sığmayan
// tablo yatay kaydırılır, sayfa taşmaz.
export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-md border border-line bg-paper ${className}`}>
      <table className="w-full border-collapse text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-crema/40 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-mono [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-ink-soft [&_thead]:bg-crema/50">
        {children}
      </table>
    </div>
  );
}
