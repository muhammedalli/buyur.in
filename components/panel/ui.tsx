"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  ComponentProps,
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import Link from "next/link";
import { ChevronDownIcon, LockIcon, SparklesIcon } from "@/components/icons";
import { formatSavedTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOptionalUiLocale } from "@/components/ui-locale-provider";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
export { Tooltip } from "@/components/ui/tooltip";
export {
  InitialsAvatar,
  Sidebar,
  SidebarAccount,
  SidebarBrand,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Panel ve yönetim ekranlarının tek UI kiti. Pencere, yaprak (Sheet), açılır
// menü ve tooltip shadcn/ui katmanından (components/ui, Radix) gelir;
// ekranlar onları buradan alır. Kitin kendi metinleri (Kaydet, Kapat, kayıt
// durumu…) arayüz dilindedir; yönetim paneli dil sağlayıcısı olmadan
// kullandığı için useOptionalUiLocale Türkçeye düşer.
//
// Köşe yarıçapı standardı 6px'tir (`rounded-md`): buton, alan, kart, tablo,
// pencere ve açılır menü aynı dili konuşur. Hap (pill) biçimi yalnızca anahtar
// (switch) ve durum noktası gibi gerçekten yuvarlak öğelerde kalır.
//
// Kesin kural: hiçbir bileşen yatayda kaydırılan şerit üretmez. Sığmayan sekme
// açılır menüye döner (Tabs, NavTabs), bölüm menüsü dar ekranda açılır menüdür
// (SectionNav), tablo dar ekranda ikincil sütunları gizler.

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  const { className = "", ...rest } = props;
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-ink", className)}
      {...rest}
    />
  );
}

// Odakta marka renginde yumuşak halka (shadcn `ring-3` deseni): kenarlık
// rengi tek başına ince çizgide zor seçiliyordu.
const FIELD_BASE =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-ink-soft/50 focus:border-paprika focus:ring-3 focus:ring-paprika/15 disabled:cursor-not-allowed disabled:bg-crema/40 disabled:text-ink-soft";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={cn(FIELD_BASE, "min-h-10", className)} {...rest} />;
}

// React 19: ref prop olarak iletilir (ör. sohbet kutusuna odak vermek için).
export function Textarea(props: ComponentProps<"textarea">) {
  const { className = "", ...rest } = props;
  return <textarea className={cn(FIELD_BASE, className)} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={cn(FIELD_BASE, "min-h-10", className)} {...rest} />;
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-paprika/25 disabled:cursor-not-allowed disabled:opacity-50";

// Boyut `size` ile seçilir. Sınıflar cn (tailwind-merge) ile birleştiği için
// className'deki çakışan sınıf kazanır: ekranlar yalnızca yerleşim ayarı
// (ör. `w-full sm:w-auto`, `hidden sm:inline-flex`) ekler.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "min-h-10 px-4 py-2 text-sm",
  sm: "min-h-8 px-3 py-1 text-[13px]",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper shadow-xs hover:bg-paprika",
  outline: "border border-line bg-paper text-ink shadow-xs hover:bg-crema",
  ghost: "text-ink-soft hover:bg-crema hover:text-ink",
  danger: "border border-paprika/40 text-paprika hover:bg-paprika hover:text-paper",
};

// Bağlantıya (a / next Link) buton görünümü verir. Panelde el yazımı buton
// sınıfı kullanılmaz; tıklanabilir her şey aynı dili konuşsun diye stil
// tek yerden, buradan alınır.
export function buttonClass(variant: ButtonVariant = "primary", className = "", size: ButtonSize = "md") {
  return cn(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className);
}

export function Button({ variant = "primary", size = "md", loading, className = "", disabled, children, ...rest }: ButtonProps) {
  const { t } = useOptionalUiLocale();
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
          <span className="sr-only">{t("İşleniyor")}</span>
        </span>
      )}
    </button>
  );
}

export function AiButton({
  className = "",
  children,
  ...rest
}: Omit<ButtonProps, "variant" | "size" | "loading">) {
  const { t } = useOptionalUiLocale();
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
        className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-gradient-to-br from-paprika to-paprika-deep min-h-10 px-4 py-2 text-sm text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <div className="absolute top-0 bottom-0 w-12 bg-white/20 blur-[2px]" style={{ animation: "ai-shimmer 2.5s infinite linear" }} />
        </div>
        <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />

        <div style={{ animation: "ai-sparkle 2s infinite ease-in-out" }} className="relative z-10 drop-shadow-md">
          <SparklesIcon size={18} />
        </div>

        <span className="relative z-10 font-semibold drop-shadow-sm">{children ?? t("Yapay Zeka ile Tara")}</span>
      </button>

      {/* Önizleme butonun sağ kenarına hizalanır: buton her ekranda sağdadır
          (sayfa başlığı eylemi, kart altı), ortalanınca dar masaüstünde taşıyordu. */}
      <div className="pointer-events-none absolute top-full right-0 z-50 mt-3 hidden w-64 max-w-[calc(100vw-2rem)] md:block -translate-y-2 rounded-md border border-line bg-paper p-3 opacity-0 shadow-xl transition-all duration-300 group-hover/aibtn:translate-y-0 group-hover/aibtn:opacity-100">
        <p className="mb-2 text-center text-xs font-medium leading-relaxed text-ink">
          {t("Fiziksel menünüzün fotoğrafını çekin, yapay zeka ürünleri otomatik okuyup listeye eklesin.")}
        </p>
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-crema border border-line/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/ai-scan.jpg" alt={t("Yapay zekâ tarama örneği")} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="absolute -top-[8px] right-10 h-0 w-0 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent border-b-line">
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
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md bg-gradient-to-br from-paprika to-paprika-deep min-h-8 px-3 py-1 text-[13px] text-paper shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      {loading ? (
        <Spinner className="relative z-10 h-3.5 w-3.5" />
      ) : (
        <SparklesIcon size={14} className="relative z-10" />
      )}
      <span className="relative z-10 font-semibold">{children}</span>
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
    <div className={cn("rounded-md border border-line bg-paper p-6 shadow-xs", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
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
export function UpdatedAt({ at, label }: { at?: number | string | null; label?: string }) {
  const { t, tag } = useOptionalUiLocale();
  const ms = typeof at === "string" ? Date.parse(at.replace(" ", "T")) : (at ?? null);
  if (ms === null || !Number.isFinite(ms)) return null;
  return (
    <span className="text-xs text-ink-soft">
      {label ?? t("Son güncelleme")} · {formatSavedTime(ms as number, tag)}
    </span>
  );
}

/** Önceki oturumdan kalmış, kaydedilmemiş taslak bildirimi. */
export function DraftBanner({ savedAt, onRestore, onDiscard }: { savedAt: number; onRestore: () => void; onDiscard: () => void }) {
  const { t, tag } = useOptionalUiLocale();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paprika/30 bg-paprika/5 px-4 py-3 text-sm">
      <p>
        <span className="font-semibold">{t("Kaydedilmemiş bir taslağın var")}</span>
        <span className="text-ink-soft"> · {formatSavedTime(savedAt, tag)}</span>
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          {t("Sil")}
        </Button>
        <Button type="button" size="sm" onClick={onRestore}>
          {t("Geri yükle")}
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
  const { t, tag } = useOptionalUiLocale();
  const savedMs = toMs(savedAt);
  let tone = "text-ink-soft";
  let dot = "";
  let long: ReactNode = null;
  let short: ReactNode = null;

  if (saving) {
    long = short = t("Kaydediliyor…");
  } else if (error) {
    tone = "text-paprika-deep";
    dot = "bg-paprika";
    long = short = error;
  } else if (dirty || (draftSavedAt && (savedMs === null || draftSavedAt > savedMs))) {
    tone = "text-ink";
    dot = "bg-paprika";
    long = draftSavedAt
      ? t("Kaydedilmemiş değişiklikler · taslak {time}", { time: formatSavedTime(draftSavedAt, tag) })
      : t("Kaydedilmemiş değişiklikler");
    short = t("Kaydedilmedi");
  } else if (savedMs !== null) {
    tone = "text-herb";
    dot = "bg-herb";
    long = t("Son kaydedildi · {time}", { time: formatSavedTime(savedMs, tag) });
    short = t("Kaydedildi");
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
  saveLabel,
  cancelLabel,
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
  const { t } = useOptionalUiLocale();
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
            {cancelLabel ?? t("Vazgeç")}
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {saveLabel ?? t("Kaydet")}
        </Button>
      </div>
    </div>
  );
}

/** Sekme şeridi kabın genişliğine sığıyor mu? Görünmez bir ölçüm kopyası
 *  doğal genişliği verir; sığmıyorsa şerit açılır menüye döner. Boyamadan önce
 *  ölçülür (useLayoutEffect), dar ekranda şerit bir an bile taşmaz. */
function useFitsInline() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(true);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = measureRef.current;
    if (!container || !content) return;
    setFits(content.scrollWidth <= container.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, measureRef, fits };
}

// Bölümlü kontrol (shadcn Tabs): krema zemin üzerinde seçili sekme kâğıt
// renginde yükselir.
const TAB_ROW = "flex w-fit max-w-full gap-1 rounded-md bg-crema p-1";
const TAB_ITEM =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-paprika/25";
const TAB_ACTIVE = "bg-paper text-ink shadow-xs";
const TAB_IDLE = "text-ink-soft hover:text-ink";

/** Dar ekranda sekmelerin yerine geçen açılır menü: seçili sekme görünür,
 *  diğerleri listede. */
function TabsDropdown({ label, current, children }: { label: string; current: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        className="group flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-line bg-paper px-3 py-2 text-left text-sm font-medium text-ink shadow-xs transition-colors hover:bg-crema"
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">{current}</span>
        <ChevronDownIcon size={15} className="shrink-0 text-ink-soft transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={label} className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Sekme şeridi — aktif sekmenin altında vurgu çizgisi. Kaba sığmazsa (dar
// ekran, uzun etiket) aynı seçenekleri açılır menü olarak gösterir; yatay
// kaydırma yoktur.
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = "mb-6",
  label,
}: {
  tabs: { key: T; label: ReactNode; ariaLabel?: string }[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
  /** Sekme grubunun ekran okuyucu adı. */
  label?: string;
}) {
  const { t } = useOptionalUiLocale();
  const { containerRef, measureRef, fits } = useFitsInline();
  const groupLabel = label ?? t("Bölümler");
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];

  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === active);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length;
    const key = tabs[next]?.key;
    if (key === undefined) return;
    onChange(key);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${key}"]`)?.focus();
  }

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <div ref={measureRef} aria-hidden className={cn(TAB_ROW, "pointer-events-none invisible absolute left-0 top-0 w-max")}>
        {tabs.map((tab) => (
          <span key={tab.key} className={cn(TAB_ITEM, TAB_IDLE)}>
            {tab.label}
          </span>
        ))}
      </div>
      {fits ? (
        <div role="tablist" aria-label={groupLabel} onKeyDown={onKey} className={cn(TAB_ROW, "overflow-hidden")}>
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                data-tab={tab.key}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                aria-label={tab.ariaLabel}
                onClick={() => onChange(tab.key)}
                className={cn(TAB_ITEM, isActive ? TAB_ACTIVE : TAB_IDLE)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : (
        <TabsDropdown label={groupLabel} current={current?.label}>
          {tabs.map((tab) => (
            <DropdownMenuItem
              key={tab.key}
              aria-label={tab.ariaLabel}
              onSelect={() => onChange(tab.key)}
              className={cn("items-center gap-1.5", tab.key === active && "font-semibold text-paprika")}
            >
              {tab.label}
            </DropdownMenuItem>
          ))}
        </TabsDropdown>
      )}
    </div>
  );
}

export interface NavTab {
  href: string;
  label: string;
  active: boolean;
}

// Bağlantı sekmeleri (alt sayfalar arası geçiş: analiz bölümleri, sistem
// ekranı). Tabs ile aynı görünüm ve aynı kural: sığmazsa açılır menü.
export function NavTabs({ items, label, className = "mb-6" }: { items: NavTab[]; label: string; className?: string }) {
  const { containerRef, measureRef, fits } = useFitsInline();
  const current = items.find((item) => item.active) ?? items[0];

  return (
    <nav ref={containerRef} aria-label={label} className={cn("relative min-w-0", className)}>
      <div ref={measureRef} aria-hidden className={cn(TAB_ROW, "pointer-events-none invisible absolute left-0 top-0 w-max")}>
        {items.map((item) => (
          <span key={item.href} className={cn(TAB_ITEM, TAB_IDLE)}>
            {item.label}
          </span>
        ))}
      </div>
      {fits ? (
        <div className={cn(TAB_ROW, "overflow-hidden")}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(TAB_ITEM, item.active ? TAB_ACTIVE : TAB_IDLE)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : (
        <TabsDropdown label={label} current={current?.label}>
          {items.map((item) => (
            <DropdownMenuItem key={item.href} asChild className={cn(item.active && "font-semibold text-paprika")}>
              <Link href={item.href} aria-current={item.active ? "page" : undefined}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </TabsDropdown>
      )}
    </nav>
  );
}

export interface SectionNavItem<T extends string> {
  key: T;
  label: string;
  /** Liste öğesinin solundaki ikon (lg ve üstündeki yan menüde). */
  icon?: ReactNode;
}

// Çok bölümlü ekranların (ör. işletme ayarları) bölüm menüsü: masaüstünde
// (lg+) içeriğin solunda yapışkan dikey liste, daha dar ekranda tam genişlik
// açılır menü. Sayfa bunu `SECTION_LAYOUT` ızgarasının ilk sütununa koyar.
export const SECTION_LAYOUT = "grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8";

export function SectionNav<T extends string>({
  items,
  active,
  onChange,
  label,
}: {
  items: SectionNavItem<T>[];
  active: T;
  onChange: (key: T) => void;
  label: string;
}) {
  const current = items.find((item) => item.key === active) ?? items[0];
  return (
    <>
      <div className="lg:hidden">
        <TabsDropdown
          label={label}
          current={
            <>
              {current?.icon}
              {current?.label}
            </>
          }
        >
          {items.map((item) => (
            <DropdownMenuItem
              key={item.key}
              onSelect={() => onChange(item.key)}
              className={cn("items-center gap-2.5", item.key === active && "font-semibold text-paprika")}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </TabsDropdown>
      </div>
      <nav aria-label={label} className="hidden lg:block">
        <ul className="sticky top-[calc(var(--app-header-h,69px)+5.5rem)] space-y-0.5">
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onChange(item.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    isActive ? "bg-paprika/10 font-semibold text-paprika" : "text-ink-soft hover:bg-crema/70 hover:text-ink"
                  )}
                >
                  {item.icon}
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
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
        <span className="text-sm text-ink-soft">{label}</span>
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
  ctaLabel,
}: {
  title: string;
  description: string;
  /** null: yükseltme bağlantısı çizilmez (en üst plan). Verilmezse "Planımı yükselt". */
  ctaLabel?: string | null;
}) {
  const { t } = useOptionalUiLocale();
  const label = ctaLabel === undefined ? t("Planımı yükselt") : ctaLabel;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-paprika/40 bg-paprika/5 px-6 py-14 text-center sm:py-16">
      <LockIcon size={22} className="text-paprika" />
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="max-w-md text-sm text-ink-soft">{description}</p>
      {label && (
        <Link href="/panel/plan" className={buttonClass("primary", "mt-1")}>
          {label}
        </Link>
      )}
    </div>
  );
}

// Panelin tek modal kabuğu (shadcn/ui Dialog üzerinde). Onay diyaloğundan
// (confirm-dialog.tsx) farkı: içine serbest içerik alır — görsel ızgarası,
// uzun liste, form parçası. Mobilde alttan açılan yaprak, masaüstünde
// ortalanmış pencere olur. Odak tuzağı, Esc ve kaydırma kilidi Radix'ten.
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
  const { t } = useOptionalUiLocale();
  const block = (event: Event) => {
    if (!dismissable) event.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={MODAL_WIDTHS[size]}
        onEscapeKeyDown={block}
        onInteractOutside={block}
        // Pencere React ağacında açıldığı yerin içindedir; tıklama oradaki
        // bir karta/satıra kabarıp onu da tetiklemesin.
        onClick={(event) => event.stopPropagation()}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
          <DialogClose
            aria-label={t("Kapat")}
            disabled={!dismissable}
            className="-mr-1 shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </DialogClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-crema/40 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Açılır eylem menüsü (shadcn/ui DropdownMenu üzerinde): sık kullanılmayan
// ya da ikincil eylemleri tek bir butonun altında toplar (ör. işletme
// işlemleri, hesap menüsü). Klavye, odak ve ekran kenarına göre yerleşim
// Radix'ten gelir; menü görünür alanın dışına taşmaz.
export type DropdownEntry =
  | { label: string; onSelect: () => void; tone?: "danger"; disabled?: boolean; description?: string }
  | "separator";

export function Dropdown({
  trigger,
  items,
  align = "end",
  label,
  triggerClassName,
  chevron = true,
}: {
  /** Butonun içeriği. */
  trigger: ReactNode;
  items: DropdownEntry[];
  align?: "start" | "end";
  /** Ekran okuyucu için menü adı. */
  label: string;
  triggerClassName?: string;
  /** false: ikon tetikleyicide (⋯) aşağı ok çizilmez. */
  chevron?: boolean;
}) {
  return (
    // modal=false: menüden açılan pencere (ör. "Şifreyi değiştir") odak ve
    // tıklama kilidiyle çakışmasın.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={cn("group", triggerClassName ?? buttonClass("outline", "", "sm"))}>
        {trigger}
        {chevron && <ChevronDownIcon size={14} className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} aria-label={label}>
        {items.map((item, index) =>
          item === "separator" ? (
            <DropdownMenuSeparator key={`sep-${index}`} />
          ) : (
            <DropdownMenuItem key={item.label} disabled={item.disabled} tone={item.tone} onSelect={item.onSelect} className="flex-col gap-0">
              <span>{item.label}</span>
              {item.description && <span className="max-w-full truncate text-xs text-ink-soft">{item.description}</span>}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Özet sayı kartları (shadcn panel deseni): her metrik kendi kartında, etiket
// ve isteğe bağlı ikon üstte, değer altında. Ekranlar metrik kartını elle
// yazmaz; sayıları hep bu ızgara gösterir.
export interface StatItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  /** Etiketin sağındaki küçük ikon. */
  icon?: ReactNode;
}

export function StatGroup({
  items,
  className = "",
  columns,
  size = "md",
}: {
  items: StatItem[];
  className?: string;
  /** sm ve üstündeki sütun sayısı; verilmezse her öğe bir sütun. Çok öğeli
   *  ızgarada (ör. 6 para değeri) satır başına 3 vermek değerleri sığdırır. */
  columns?: number;
  /** "sm": uzun değerler (para tutarı) için küçük punto. */
  size?: "md" | "sm";
}) {
  return (
    <div
      style={{ "--stat-cols": columns ?? items.length } as CSSProperties}
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[repeat(var(--stat-cols),minmax(0,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1",
        // Dört ve daha az kart sm'de de tek satıra sığar.
        (columns ?? items.length) <= 4 && "sm:grid-cols-[repeat(var(--stat-cols),minmax(0,1fr))] sm:[&>*:last-child:nth-child(odd)]:col-span-1",
        className
      )}
    >
      {items.map((item) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-medium text-ink-soft">{item.label}</p>
              {item.icon && <span className="shrink-0 text-ink-soft/70">{item.icon}</span>}
            </div>
            <p className={cn("mt-2 font-display font-bold leading-tight text-ink", size === "sm" ? "text-lg sm:text-xl" : "text-2xl")}>
              {item.value}
            </p>
            {item.hint && <p className="mt-1 text-xs text-ink-soft">{item.hint}</p>}
          </>
        );
        const card = "block min-w-0 rounded-md border border-line bg-paper p-4 shadow-xs sm:p-5";
        return item.href ? (
          <Link key={item.label} href={item.href} className={cn(card, "transition-colors hover:border-paprika/40 hover:bg-crema/40")}>
            {body}
          </Link>
        ) : (
          <div key={item.label} className={card}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

// Tablo kabuğu. Hücre stilleri burada tek yerden verilir; sayfalar düz
// <table> işaretlemesi yazar (thead/th/td), görünüm her ekranda aynı olur.
// Dar ekranda ikincil sütunlar `hidden sm:table-cell` / `md:table-cell` ile
// gizlenir, ikincil bilgi ana hücrenin altına iner ve kısaltılacak metnin
// hücresi `w-full max-w-0` alır (truncate tabloyu genişletmesin, kalan yeri o
// hücre alsın): tablo 320px'te bile kabına sığacak şekilde yazılır. Kap yine
// de `overflow-x-auto`'dur — bir şey taşarsa taşan tablonun kendisi olur, sayfa değil.
export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-md border border-line bg-paper shadow-xs", className)}>
      <table className="w-full border-collapse text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-crema/40 [&_td]:px-3 [&_td]:py-3 [&_td]:align-middle sm:[&_td]:px-4 [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-3 sm:[&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:text-ink-soft [&_thead]:bg-crema/40">
        {children}
      </table>
    </div>
  );
}
