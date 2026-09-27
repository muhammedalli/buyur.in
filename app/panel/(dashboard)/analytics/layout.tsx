"use client";

import { usePathname } from "next/navigation";
import { AnalyticsFilterProvider } from "@/components/panel/analytics/filters";
import { NavTabs } from "@/components/panel/ui";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

// Analiz merkezi kabuğu: bölüm sekmeleri + filtre bağlamı. Filtreler sekmeler
// arasında korunur (bkz. components/panel/analytics/filters.tsx). Sekmeler dar
// ekranda açılır menüye döner (NavTabs).

const TABS = [
  { href: "/panel/analytics", label: msg("Genel bakış") },
  { href: "/panel/analytics/products", label: msg("Ürünler") },
  { href: "/panel/analytics/categories", label: msg("Kategoriler") },
  { href: "/panel/analytics/acquisition", label: msg("Trafik") },
  { href: "/panel/analytics/activity", label: msg("Aktivite") },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useUiLocale();

  return (
    <AnalyticsFilterProvider>
      <div>
        <NavTabs
          label={t("Analiz bölümleri")}
          items={TABS.map((tab) => ({
            href: tab.href,
            label: t(tab.label),
            active: tab.href === "/panel/analytics" ? pathname === tab.href : pathname.startsWith(tab.href),
          }))}
        />
        {children}
      </div>
    </AnalyticsFilterProvider>
  );
}
