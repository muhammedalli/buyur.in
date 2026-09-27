"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronsUpDownIcon, PanelLeftIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// shadcn/ui Sidebar'ın sadeleştirilmiş hâli — işletme paneli ve yönetim
// panelinin ortak kabuğu. Aynı ağaç iki yerde çizilir: lg ve üstünde ekranın
// tam boyunda yapışkan sol sütun (ikon genişliğine daraltılabilir), daha dar
// ekranda başlıktaki tetikleyicinin açtığı yaprak (Sheet). Yerleşim tek yerde
// çözüldüğü için ekranlar genişlik/taşma hesabı yapmaz.
//
// Metinler dışarıdan verilir: yönetim paneli dil sağlayıcısı olmadan çalışır.

const DESKTOP_QUERY = "(min-width: 1024px)";

type Variant = "desktop" | "mobile";

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);
const VariantContext = createContext<Variant>("desktop");

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar, SidebarProvider içinde kullanılmalı.");
  return ctx;
}

/** Bu öğe masaüstü sütununda mı, mobil yaprakta mı çiziliyor. */
export function useSidebarVariant() {
  return useContext(VariantContext);
}

export function SidebarProvider({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Daraltma tercihi cihaz bazında hatırlanır; okunamazsa (gizli pencere) açık başlar.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(storageKey) === "1");
    } catch {
      /* yoksay */
    }
  }, [storageKey]);

  // Yapraktan bir sayfaya geçilince yaprak kapanır.
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = useCallback(() => {
    if (!window.matchMedia(DESKTOP_QUERY).matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* yoksay */
      }
      return next;
    });
  }, [storageKey]);

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, setMobileOpen, toggle }}>
      {/* --app-header-h: yapışkan eylem çubuğu ve bölüm menüsü başlığın altına oturur. */}
      <div className="flex min-h-dvh w-full overflow-x-clip bg-paper [--app-header-h:64px]">{children}</div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ label, closeLabel, children }: { label: string; closeLabel: string; children: ReactNode }) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  return (
    <>
      <aside
        aria-label={label}
        data-collapsed={collapsed || undefined}
        className="group/rail sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-crema/50 transition-[width] duration-200 ease-out data-[collapsed]:w-14 lg:flex"
      >
        <VariantContext.Provider value="desktop">{children}</VariantContext.Provider>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" aria-describedby={undefined} className="bg-crema">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          <div className="group/rail flex min-h-0 flex-1 flex-col">
            <VariantContext.Provider value="mobile">{children}</VariantContext.Provider>
          </div>
          <SheetClose
            aria-label={closeLabel}
            className="absolute end-2 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-paper hover:text-paprika"
          >
            <XIcon size={18} />
          </SheetClose>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SidebarHeader({ children }: { children: ReactNode }) {
  const variant = useSidebarVariant();
  // Mobilde sağ üstte kapatma butonu durur; içerik onun altına girmesin.
  return <div className={cn("p-2", variant === "mobile" && "pe-12")}>{children}</div>;
}

export function SidebarContent({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 py-2">{children}</div>;
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="border-t border-line p-2">{children}</div>;
}

export function SidebarGroup({ label, className, children }: { label?: string | null; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      {label && (
        <p className="mb-1 truncate px-2.5 text-xs font-medium text-ink-soft/80 group-data-[collapsed]/rail:sr-only">{label}</p>
      )}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

const ITEM =
  "flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-start text-sm transition-colors group-data-[collapsed]/rail:justify-center group-data-[collapsed]/rail:px-0 disabled:cursor-not-allowed disabled:opacity-50";
const ITEM_ACTIVE = "bg-paprika/10 font-semibold text-paprika";
const ITEM_IDLE = "text-ink-soft hover:bg-crema hover:text-ink";

/** Yan menü satırı: `href` verilirse bağlantı, verilmezse buton. Daraltılmış
 *  sütunda yalnızca ikon görünür; adı tooltip söyler. */
export function SidebarItem({
  href,
  external,
  onClick,
  icon,
  label,
  active,
  disabled,
}: {
  href?: string;
  /** Yeni sekmede açılır (ör. yardım merkezi: açık formdaki değişiklik kaybolmasın). */
  external?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const { collapsed } = useSidebar();
  const variant = useSidebarVariant();
  const className = cn(ITEM, active ? ITEM_ACTIVE : ITEM_IDLE);
  const body = (
    <>
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className="truncate group-data-[collapsed]/rail:sr-only">{label}</span>
    </>
  );

  let node: ReactNode;
  if (href && external) {
    node = (
      <a href={href} target="_blank" rel="noopener" className={className}>
        {body}
      </a>
    );
  } else if (href) {
    node = (
      <Link href={href} aria-current={active ? "page" : undefined} className={className}>
        {body}
      </Link>
    );
  } else {
    node = (
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        {body}
      </button>
    );
  }

  return (
    <li>
      {collapsed && variant === "desktop" ? (
        <Tooltip content={label} side="right">
          {node}
        </Tooltip>
      ) : (
        node
      )}
    </li>
  );
}

/** Sütunun üstündeki marka/işletme bloğu ve altındaki hesap bloğunun ortak
 *  görünümü: kare avatar + iki satır. */
function ProfileBody({ avatar, title, subtitle, chevron }: { avatar: ReactNode; title: string; subtitle?: string; chevron?: boolean }) {
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">{avatar}</span>
      <span className="min-w-0 flex-1 text-start leading-tight group-data-[collapsed]/rail:hidden">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        {subtitle && <span className="block truncate text-xs text-ink-soft">{subtitle}</span>}
      </span>
      {chevron && <ChevronsUpDownIcon size={16} className="shrink-0 text-ink-soft group-data-[collapsed]/rail:hidden" />}
    </>
  );
}

const PROFILE_ROW =
  "flex w-full items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-crema group-data-[collapsed]/rail:justify-center group-data-[collapsed]/rail:p-0.5";

export function SidebarBrand({ href, avatar, title, subtitle }: { href: string; avatar: ReactNode; title: string; subtitle?: string }) {
  return (
    <Link href={href} className={PROFILE_ROW} aria-label={title}>
      <ProfileBody avatar={avatar} title={title} subtitle={subtitle} />
    </Link>
  );
}

/** Hesap bloğu: tıklanınca hesap işlemlerinin menüsü açılır (children =
 *  DropdownMenuItem'lar). */
export function SidebarAccount({
  avatar,
  title,
  subtitle,
  menuLabel,
  children,
}: {
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  menuLabel: string;
  children: ReactNode;
}) {
  const variant = useSidebarVariant();
  return (
    // modal=false: menüden açılan pencere (ör. "Şifreyi değiştir") odak kilidiyle çakışmasın.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label={menuLabel} className={cn(PROFILE_ROW, "data-[state=open]:bg-crema")}>
        <ProfileBody avatar={avatar} title={title} subtitle={subtitle} chevron />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={menuLabel}
        side={variant === "desktop" ? "right" : "top"}
        align="end"
        className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Adının baş harfleriyle kare avatar (logo/görsel yoksa). */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase("tr"))
      .join("") || "?";
  return (
    <span className={cn("flex h-full w-full items-center justify-center bg-ink font-display text-xs font-bold text-paper", className)}>
      {initials}
    </span>
  );
}

export function SidebarTrigger({ label }: { label: string }) {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="-ms-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-crema hover:text-ink"
    >
      <PanelLeftIcon size={18} />
    </button>
  );
}

/** Sütunun yanındaki içerik alanı: yapışkan başlık + sayfa. */
export function SidebarInset({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-40 flex h-[var(--app-header-h)] shrink-0 items-center gap-2 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-6">
        {header}
      </header>
      {children}
    </div>
  );
}
