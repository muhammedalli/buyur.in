"use client";

import { useEffect } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { LockIcon, SparklesIcon } from "@/components/icons";
import { formatSavedTime } from "@/lib/format";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  const { className = "", ...rest } = props;
  return (
    <label
      className={`mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft ${className}`}
      {...rest}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/50 focus:border-paprika ${className}`}
      {...rest}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={`w-full rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/50 focus:border-paprika ${className}`}
      {...rest}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      className={`w-full rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-paprika ${className}`}
      {...rest}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  loading?: boolean;
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-mono text-[13px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<string, string> = {
  primary: "bg-ink text-paper hover:bg-paprika",
  outline: "border border-line text-ink hover:border-paprika hover:text-paprika",
  ghost: "text-ink-soft hover:text-paprika",
  danger: "border border-paprika/40 text-paprika hover:bg-paprika hover:text-paper",
};

// Bağlantıya (a / next Link) buton görünümü verir. Panelde el yazımı buton
// sınıfı kullanılmaz; tıklanabilir her şey aynı dili konuşsun diye stil
// tek yerden, buradan alınır.
export function buttonClass(variant: "primary" | "outline" | "ghost" | "danger" = "primary", className = "") {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`;
}

export function Button({ variant = "primary", loading, className = "", disabled, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, className)} disabled={disabled || loading} {...rest}>
      {loading ? "..." : children}
    </button>
  );
}

export function AiButton({ className = "", children = "Yapay Zeka ile Tara", ...rest }: ButtonProps) {
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

      <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-3 hidden w-64 md:block -translate-x-1/2 -translate-y-2 rounded-2xl border border-line bg-paper p-3 opacity-0 shadow-xl transition-all duration-300 group-hover/aibtn:translate-y-0 group-hover/aibtn:opacity-100">
        <p className="mb-2 text-center text-xs font-medium leading-relaxed text-ink">
          Fiziksel menünüzün fotoğrafını çekin, yapay zeka ürünleri otomatik okuyup listeye eklesin.
        </p>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-crema border border-line/50">
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

// Form çubuğuna sığan kompakt yapay zekâ eylem butonu. AiButton ile aynı
// görsel dili taşır (gradyan + kıvılcım) ama tanıtım balonu yoktur: burada
// kullanıcı ne olacağını zaten bağlamdan bilir.
export function AiActionButton({ className = "", loading, disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md bg-gradient-to-br from-paprika to-paprika-deep px-4 py-2 font-mono text-[12px] uppercase tracking-wider text-paper shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      {loading ? (
        <Spinner className="relative z-10 h-4 w-4" />
      ) : (
        <SparklesIcon size={15} className="relative z-10" />
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
    <div className={`rounded-2xl border border-line bg-paper p-6 ${className}`} {...rest}>
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

/** Formun kayıt durumu: yayınlanmış son kayıt mı, yoksa yayınlanmamış yerel
 *  taslak mı daha yeni — kullanıcı neyin canlıda olduğunu her an bilsin. */
export function SaveStatus({
  saving,
  savedAt,
  draftSavedAt,
}: {
  saving?: boolean;
  /** Son başarılı kayıt (ms) ya da kaydın `updated` alanı. */
  savedAt?: number | string | null;
  draftSavedAt?: number | null;
}) {
  if (saving) return <span className="text-ink-soft">Kaydediliyor…</span>;
  const savedMs = typeof savedAt === "string" ? Date.parse(savedAt.replace(" ", "T")) : (savedAt ?? null);
  const hasSaved = savedMs !== null && Number.isFinite(savedMs);
  if (draftSavedAt && (!hasSaved || draftSavedAt > (savedMs as number))) {
    return <span className="text-ink-soft">Taslak kaydedildi · {formatSavedTime(draftSavedAt)} · henüz yayında değil</span>;
  }
  if (hasSaved) return <span className="text-herb">Son kaydedildi · {formatSavedTime(savedMs as number)}</span>;
  return null;
}

/** Önceki oturumdan kalmış, kaydedilmemiş taslak bildirimi. */
export function DraftBanner({ savedAt, onRestore, onDiscard }: { savedAt: number; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paprika/30 bg-paprika/5 px-4 py-3 text-sm">
      <p>
        <span className="font-semibold">Kaydedilmemiş bir taslağın var</span>
        <span className="text-ink-soft"> · {formatSavedTime(savedAt)}</span>
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onDiscard}>
          Sil
        </Button>
        <Button type="button" onClick={onRestore}>
          Geri yükle
        </Button>
      </div>
    </div>
  );
}

// Formların sağ üstüne yerleşen kaydet/vazgeç çubuğu — kullanıcının kaydetmek
// için sayfayı en alta kaydırması gerekmez. `toggle` verilirse (ör. "Menüde
// Göster") kaydet butonunun hemen soluna kompakt bir switch olarak eklenir.
export function FormActions({
  saving,
  saved,
  status,
  onCancel,
  saveLabel = "Kaydet",
  cancelLabel = "Vazgeç",
  toggle,
  extra,
}: {
  saving?: boolean;
  saved?: boolean;
  /** Serbest durum satırı (ör. <SaveStatus />); verilirse `saved` yerine gösterilir. */
  status?: ReactNode;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  toggle?: { checked: boolean; onChange: (checked: boolean) => void; label: string };
  /** Kaydet'in solunda duran ek eylem (ör. yapay zekâ ile dilleri tamamla). */
  extra?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-end gap-3 border-b border-line pb-4">
      {extra}
      {toggle && <Switch compact checked={toggle.checked} onChange={toggle.onChange} label={toggle.label} />}
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" loading={saving}>
        {saveLabel}
      </Button>
    </div>
  );
}

// Formun sağ alt köşesindeki kayıt durumu satırı — FormActions ile eşleşir.
// Butonlar sağ üstte, bildirim sağ altta: her panel formunda aynı düzen.
export function FormStatusFooter({ status, saved }: { status?: ReactNode; saved?: boolean }) {
  const content = status ?? (saved ? <span className="text-herb">Kaydedildi ✓</span> : null);
  return <FooterNote>{content}</FooterNote>;
}

// Yatay sekme çubuğu — aktif sekmenin altında vurgu çizgisi (referans görsel gibi).
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="mb-6 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`relative -mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[13px] font-semibold uppercase tracking-wide transition-colors ${isActive ? "border-paprika text-paprika" : "border-transparent text-ink-soft hover:text-ink"
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-paprika/40 bg-paprika/5 px-6 py-14 text-center sm:py-16">
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
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-paper shadow-[0_30px_70px_-25px_rgba(35,24,18,0.55)] sm:rounded-2xl ${MODAL_WIDTHS[size]}`}
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
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika"
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
