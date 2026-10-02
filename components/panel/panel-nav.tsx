"use client";

import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  InitialsAvatar,
  Sidebar,
  SidebarAccount,
  SidebarBrand,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  useSidebar,
} from "@/components/panel/ui";
import { useGuide } from "@/components/panel/guide";
import { useUiLocale } from "@/components/ui-locale-provider";
import { menuPageUrl } from "@/lib/storefront";
import { menuUrl } from "@/lib/site";
import { msg } from "@/lib/ui-i18n";
import type { Business } from "@/lib/types";
import {
  CompassIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  LayoutIcon,
  LifeBuoyIcon,
  LogoutIcon,
  MegaphoneIcon,
  PackageIcon,
  QrCodeIcon,
  SettingsIcon,
  SparkIcon,
  SparklesIcon,
  StarIcon,
  TrendingUpIcon,
} from "@/components/icons";
import { businessLogoUrl } from "@/lib/files";

// İşletme panelinin gezinmesi (components/ui/sidebar.tsx kabuğunda). Aynı
// gruplu liste lg ve üstünde tam boy sol sütun (ikonlara daraltılabilir),
// daha dar ekranda başlıktaki tetikleyicinin açtığı yaprak olarak çizilir.
// Hesap işlemleri (kılavuz, yardım, çıkış) sütunun altındaki hesap menüsündedir.

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

/** Başlıkta gösterilen konum: "Menü › Ürünler". */
export function PanelBreadcrumb() {
  const pathname = usePathname();
  const { t } = useUiLocale();
  for (const group of PANEL_NAV_GROUPS) {
    const item = group.items.find((entry) => isActive(pathname, entry));
    if (!item) continue;
    return (
      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm">
        {group.label && <span className="hidden text-ink-soft sm:inline">{t(group.label)}</span>}
        {group.label && <span className="hidden text-ink-soft/60 sm:inline">›</span>}
        <span className="truncate font-semibold text-ink">{t(item.label)}</span>
      </p>
    );
  }
  return null;
}

export function PanelSidebar({ business, onLogout }: { business: Business; onLogout: () => void }) {
  const pathname = usePathname();
  const { t } = useUiLocale();
  const { enabled: guideEnabled, active: guideActive, start: startGuide } = useGuide();
  const { setMobileOpen } = useSidebar();
  const name = business.name || t("İşletmen");
  const host = menuUrl(business.slug).replace(/^https?:\/\//, "");

  return (
    <Sidebar label={t("Panel menüsü")} closeLabel={t("Kapat")}>
      <SidebarHeader>
        <SidebarBrand
          href="/panel"
          title="BUYUR"
          subtitle={t("İşletme paneli")}
          // eslint-disable-next-line @next/next/no-img-element
          avatar={<img src="/icon-192.png" alt="" className="h-full w-full" />}
        />
      </SidebarHeader>
      <SidebarContent>
        {PANEL_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label ?? "root"} label={group.label ? t(group.label) : null}>
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  active={active}
                  label={t(item.label)}
                  icon={<item.Icon size={17} strokeWidth={active ? 2.1 : 1.8} />}
                />
              );
            })}
          </SidebarGroup>
        ))}
        <SidebarGroup className="mt-auto">
          {/* Yeni sekmede açılır: yardım okurken açık formdaki değişiklik kaybolmasın. */}
          <SidebarItem href="/docs" external label={t("Yardım merkezi")} icon={<LifeBuoyIcon size={17} />} />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarAccount
          menuLabel={t("Hesap menüsü")}
          title={name}
          subtitle={host}
          avatar={
            businessLogoUrl(business, "small") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={businessLogoUrl(business, "small")} alt="" className="h-full w-full bg-paper object-contain" />
            ) : (
              <InitialsAvatar name={name} />
            )
          }
        >
          <DropdownMenuItem asChild className="items-center gap-2.5">
            <a href={menuPageUrl(business.slug)} target="_blank" rel="noreferrer">
              <ExternalLinkIcon size={16} />
              {t("Menüyü gör")}
            </a>
          </DropdownMenuItem>
          {guideEnabled && (
            <DropdownMenuItem disabled={guideActive} onSelect={() => {
                // Kılavuz sayfadaki öğeleri gösterir; yaprak açık kalırsa üstünü örter.
                setMobileOpen(false);
                startGuide();
              }} className="items-center gap-2.5">
              <CompassIcon size={16} />
              {t("Kılavuzu başlat")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onLogout} className="items-center gap-2.5">
            <LogoutIcon size={16} />
            {t("Çıkış")}
          </DropdownMenuItem>
        </SidebarAccount>
      </SidebarFooter>
    </Sidebar>
  );
}
