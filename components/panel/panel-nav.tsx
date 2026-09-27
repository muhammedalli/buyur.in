"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/panel/ui";
import { useGuide } from "@/components/panel/guide";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";
import {
  CompassIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  LayoutIcon,
  LifeBuoyIcon,
  LogoutIcon,
  MegaphoneIcon,
  MenuIcon,
  PackageIcon,
  QrCodeIcon,
  SettingsIcon,
  SparkIcon,
  SparklesIcon,
  StarIcon,
  TrendingUpIcon,
  XIcon,
} from "@/components/icons";

// İşletme panelinin gezinmesi. Aynı gruplu liste iki yerde çizilir:
// masaüstünde (lg+) sol yan menü, daha dar ekranda başlıktaki menü
// butonunun açtığı yaprak (Sheet). Yatay kayan şerit kullanılmaz.

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Bu öneklerle başlayan adresler de bu öğeyi etkin gösterir. */
  prefixes: string[];
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const PANEL_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/panel", label: msg("Genel bakış"), Icon: LayoutIcon, prefixes: ["/panel"] }],
  },
  {
    label: msg("Menü"),
    items: [
      { href: "/panel/categories", label: msg("Kategoriler"), Icon: FolderIcon, prefixes: ["/panel/categories", "/panel/category/"] },
      { href: "/panel/products", label: msg("Ürünler"), Icon: PackageIcon, prefixes: ["/panel/products", "/panel/product/"] },
      { href: "/panel/ai", label: msg("Yapay Zeka"), Icon: SparklesIcon, prefixes: ["/panel/ai"] },
      { href: "/panel/popups", label: msg("Kampanyalar"), Icon: MegaphoneIcon, prefixes: ["/panel/popups", "/panel/popup/"] },
    ],
  },
  {
    label: msg("Paylaşım"),
    items: [
      { href: "/panel/qr", label: msg("QR kodlar"), Icon: QrCodeIcon, prefixes: ["/panel/qr"] },
      { href: "/panel/website", label: msg("Web sitesi"), Icon: GlobeIcon, prefixes: ["/panel/website"] },
    ],
  },
  {
    label: msg("Performans"),
    items: [
      { href: "/panel/analytics", label: msg("Analiz"), Icon: TrendingUpIcon, prefixes: ["/panel/analytics"] },
      { href: "/panel/reports", label: msg("Raporlar"), Icon: FileTextIcon, prefixes: ["/panel/reports"] },
      { href: "/panel/reviews", label: msg("Değerlendirmeler"), Icon: StarIcon, prefixes: ["/panel/reviews"] },
    ],
  },
  {
    label: msg("Hesap"),
    items: [
      { href: "/panel/plan", label: msg("Plan"), Icon: SparkIcon, prefixes: ["/panel/plan"] },
      { href: "/panel/settings", label: msg("Ayarlar"), Icon: SettingsIcon, prefixes: ["/panel/settings"] },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/panel") return pathname === "/panel";
  return item.prefixes.some((prefix) => pathname.startsWith(prefix));
}

const ROW = "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors";
const ROW_ACTIVE = "bg-paprika/10 font-semibold text-paprika";
const ROW_IDLE = "text-ink-soft hover:bg-crema/70 hover:text-ink";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useUiLocale();
  return (
    <div className="space-y-5">
      {PANEL_NAV_GROUPS.map((group) => (
        <div key={group.label ?? "root"}>
          {group.label && (
            <p className="mb-1 px-3 font-mono text-[10px] uppercase tracking-wider text-ink-soft/80">{t(group.label)}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(ROW, active ? ROW_ACTIVE : ROW_IDLE)}
                  >
                    <item.Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Masaüstü (lg+) sol yan menü. */
export function PanelSidebar() {
  const { t } = useUiLocale();
  return (
    <aside className="sticky top-[var(--panel-header-h)] hidden h-[calc(100dvh-var(--panel-header-h))] w-52 shrink-0 overflow-y-auto py-8 lg:block">
      <nav aria-label={t("Panel menüsü")}>
        <NavList />
      </nav>
      {/* Yeni sekmede açılır: yardım okurken açık formdaki değişiklik kaybolmasın. */}
      <a
        href="/docs"
        target="_blank"
        rel="noopener"
        className="mt-6 block border-t border-line/60 px-3 pt-4 text-xs text-ink-soft transition-colors hover:text-paprika"
      >
        {t("Yardım merkezi")} ↗
      </a>
    </aside>
  );
}

/** Mobil/tablet (lg altı): başlıktaki menü butonu ve açtığı yaprak. Başlıkta
 *  yer kalmayan hesap işlemleri (kılavuz, panel dili, çıkış) dar ekranda
 *  buradadır. */
export function PanelMobileNav({
  businessName,
  onLogout,
  languageSwitcher,
}: {
  businessName: string;
  onLogout: () => void;
  languageSwitcher: React.ReactNode;
}) {
  const { t } = useUiLocale();
  const { enabled: guideEnabled, active: guideActive, start: startGuide } = useGuide();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("Menüyü aç")}
        className="-ml-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-crema hover:text-paprika lg:hidden"
      >
        <MenuIcon size={22} />
      </SheetTrigger>
      <SheetContent side="start" aria-describedby={undefined}>
        <div className="flex items-center justify-between gap-3 border-b border-line py-3 pl-5 pr-3">
          <Logo className="h-7" />
          <SheetClose
            aria-label={t("Kapat")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-crema hover:text-paprika"
          >
            <XIcon size={18} />
          </SheetClose>
        </div>
        {/* Tek kaydırılan alan: kısa ekranda menünün sonu da hesap işlemleri de erişilebilir. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <SheetTitle className="mb-4 truncate px-3 text-base">{businessName}</SheetTitle>
          <SheetDescription className="sr-only">{t("Panel menüsü")}</SheetDescription>
          <nav aria-label={t("Panel menüsü")}>
            <NavList onNavigate={close} />
          </nav>
          <div className="mt-5 space-y-0.5 border-t border-line pt-4">
            {guideEnabled && (
              <button
                type="button"
                disabled={guideActive}
                onClick={() => {
                  close();
                  startGuide();
                }}
                className={cn(ROW, ROW_IDLE, "disabled:opacity-50")}
              >
                <CompassIcon size={17} />
                {t("Kılavuzu başlat")}
              </button>
            )}
            <a href="/docs" target="_blank" rel="noopener" className={cn(ROW, ROW_IDLE)}>
              <LifeBuoyIcon size={17} />
              {t("Yardım merkezi")} ↗
            </a>
            <div className="flex items-center justify-between gap-3 px-3 py-1.5 sm:hidden">
              <span className="text-sm text-ink-soft">{t("Panel dili")}</span>
              {languageSwitcher}
            </div>
            <button type="button" onClick={onLogout} className={cn(ROW, ROW_IDLE, "sm:hidden")}>
              <LogoutIcon size={17} />
              {t("Çıkış")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
