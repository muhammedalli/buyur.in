"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/chrome";
import { useAuth } from "@/lib/use-auth";
import { pb } from "@/lib/pocketbase";
import { BusinessProvider, useBusiness } from "@/components/panel/business-context";
import { ToastProvider } from "@/components/panel/toast";
import { TrialBanner } from "@/components/panel/trial-banner";
import { Button, Card } from "@/components/panel/ui";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { menuUrl } from "@/lib/site";
import {
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  LayoutIcon,
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

const navItems = [
  { href: "/panel", label: "Genel bakış", Icon: LayoutIcon, prefixes: ["/panel"] },
  { href: "/panel/analytics", label: "Analiz", Icon: TrendingUpIcon, prefixes: ["/panel/analytics"] },
  { href: "/panel/categories", label: "Kategoriler", Icon: FolderIcon, prefixes: ["/panel/categories", "/panel/category/"] },
  { href: "/panel/products", label: "Ürünler", Icon: PackageIcon, prefixes: ["/panel/products", "/panel/product/"] },
  { href: "/panel/ai", label: "Yapay Zeka", Icon: SparklesIcon, prefixes: ["/panel/ai"] },
  { href: "/panel/popups", label: "Kampanyalar", Icon: MegaphoneIcon, prefixes: ["/panel/popups", "/panel/popup/"] },
  { href: "/panel/qr", label: "QR kodlar", Icon: QrCodeIcon, prefixes: ["/panel/qr"] },
  { href: "/panel/website", label: "Web sitesi", Icon: GlobeIcon, prefixes: ["/panel/website"] },
  { href: "/panel/reports", label: "Raporlar", Icon: FileTextIcon, prefixes: ["/panel/reports"] },
  { href: "/panel/reviews", label: "Değerlendirmeler", Icon: StarIcon, prefixes: ["/panel/reviews"] },
  { href: "/panel/plan", label: "Plan", Icon: SparkIcon, prefixes: ["/panel/plan"] },
  { href: "/panel/settings", label: "Ayarlar", Icon: SettingsIcon, prefixes: ["/panel/settings"] },
];

function isNavItemActive(pathname: string, item: (typeof navItems)[number]) {
  if (item.href === "/panel") return pathname === "/panel";
  return item.prefixes.some((prefix) => pathname.startsWith(prefix));
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { business, isLoading, loadError, refresh } = useBusiness();

  const mobileNavRef = useRef<HTMLDivElement | null>(null);

  // Kurulumu (ad/menü adresi) bitmemiş hesap yalnızca kurulum ekranını görür;
  // başka bir panel sayfasına doğrudan gelirse boş sayfa yerine oraya yönlenir.
  useEffect(() => {
    if (!isLoading && !business && !loadError && pathname !== "/panel") router.replace("/panel");
  }, [isLoading, business, loadError, pathname, router]);

  // Mobil menü yatay kaydığı için aktif sekme ekran dışında kalabiliyor
  // (ör. "Ayarlar"); sayfa değişince görünür alana getirilir.
  useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname, business]);

  function handleLogout() {
    pb.authStore.clear();
    router.replace("/panel/login");
  }

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-soft">Yükleniyor…</div>;
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-crema/30 [--panel-header-h:69px]">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-[calc(var(--panel-header-h)-1px)] max-w-6xl items-center justify-between px-5">
          <Link href="/panel">
            <Logo />
          </Link>
          <div className="flex items-center gap-2.5">
            {business && (
              <a
                href={menuUrl(business.slug)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-herb px-3.5 py-2 font-mono text-[12px] uppercase tracking-wider text-paper shadow-sm transition-colors hover:bg-herb/90"
              >
                <ExternalLinkIcon size={15} strokeWidth={2} />
                <span className="hidden sm:inline">Menüyü gör</span>
              </a>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-md border border-line px-3.5 py-2 font-mono text-[12px] uppercase tracking-wider text-ink transition-colors hover:border-paprika hover:text-paprika"
            >
              <LogoutIcon size={15} strokeWidth={2} />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
        {/* Mobil/tablet: yatay kaydırılabilir kompakt menü. Sidebar 1024px ve üstünde;
            768px'te yan menü içeriği ~490px'e sıkıştırıp kartları bozuyordu. */}
        {business && (
          <nav aria-label="Panel menüsü" className="border-t border-line/60 lg:hidden">
            <HorizontalScroll
              innerRef={(element) => {
                mobileNavRef.current = element;
              }}
              className="mx-auto max-w-6xl"
              innerClassName="flex gap-5 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft"
              moreLabel="Diğer menü öğeleri"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isNavItemActive(pathname, item) ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap transition-colors hover:text-paprika ${isNavItemActive(pathname, item) ? "text-paprika" : ""
                    }`}
                >
                  {item.label}
                </Link>
              ))}
            </HorizontalScroll>
          </nav>
        )}
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-5">
        {/* Masaüstü (lg+): sol sidebar */}
        {business && (
          <aside className="sticky top-[var(--panel-header-h)] hidden h-[calc(100dvh-var(--panel-header-h))] w-52 shrink-0 overflow-y-auto py-8 lg:block">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm transition-colors ${active
                        ? "bg-paprika/10 font-semibold text-paprika"
                        : "text-ink-soft hover:bg-crema/70 hover:text-ink"
                      }`}
                  >
                    <item.Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1 py-10">
          {loadError && !business ? (
            <Card className="mx-auto max-w-md text-center">
              <p className="font-display text-lg font-bold">İşletme bilgileri yüklenemedi</p>
              <p className="mt-1 text-sm text-ink-soft">Bağlantıda geçici bir sorun olabilir. Verilerin güvende.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => refresh()}>
                Tekrar dene
              </Button>
            </Card>
          ) : (
            <>
              <TrialBanner />
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/panel/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-soft">Yükleniyor…</div>;
  }

  return (
    <BusinessProvider>
      <ToastProvider>
        <DashboardShell>{children}</DashboardShell>
      </ToastProvider>
    </BusinessProvider>
  );
}
