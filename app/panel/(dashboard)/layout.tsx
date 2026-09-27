"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/use-auth";
import { pb } from "@/lib/pocketbase";
import { BusinessProvider, useBusiness } from "@/components/panel/business-context";
import { ToastProvider } from "@/components/panel/toast";
import { TrialBanner } from "@/components/panel/trial-banner";
import { SuspensionBanner } from "@/components/panel/suspension-banner";
import { Button, Card } from "@/components/panel/ui";
import { PanelLanguageSwitcher, PanelLocaleSync } from "@/components/panel/language-switcher";
import { GuideButton, GuideProvider } from "@/components/panel/guide";
import { PanelMobileNav, PanelSidebar } from "@/components/panel/panel-nav";
import { useUiLocale } from "@/components/ui-locale-provider";
import { menuPageUrl } from "@/lib/storefront";
import { ExternalLinkIcon, LogoutIcon } from "@/components/icons";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { business, isLoading, loadError, refresh } = useBusiness();
  const { t } = useUiLocale();

  // Kurulumu (ad/menü adresi) bitmemiş hesap yalnızca kurulum ekranını görür;
  // başka bir panel sayfasına doğrudan gelirse boş sayfa yerine oraya yönlenir.
  useEffect(() => {
    if (!isLoading && !business && !loadError && pathname !== "/panel") router.replace("/panel");
  }, [isLoading, business, loadError, pathname, router]);

  function handleLogout() {
    // Çıkış denetim kaydına yazılsın (app/api/auth/logout). Beklenmez:
    // keepalive isteği sayfa değişse de gider, çıkış bu isteğe bağlı değildir.
    const token = pb.authStore.token;
    if (token) {
      fetch("/api/auth/logout", { method: "POST", headers: { Authorization: token }, keepalive: true }).catch(() => undefined);
    }
    pb.authStore.clear();
    router.replace("/panel/login");
  }

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-soft">{t("Yükleniyor…")}</div>;
  }

  return (
    <GuideProvider>
    <PanelLocaleSync />
    <div className="min-h-dvh overflow-x-clip bg-crema/30 [--app-header-h:69px] [--panel-header-h:69px]">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-[calc(var(--panel-header-h)-1px)] max-w-6xl items-center justify-between gap-2 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-1.5">
            {business && (
              <PanelMobileNav
                businessName={business.name || t("İşletmen")}
                onLogout={handleLogout}
                languageSwitcher={<PanelLanguageSwitcher />}
              />
            )}
            <Link href="/panel" className="shrink-0">
              <Logo />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {business && (
              <a
                href={menuPageUrl(business.slug)}
                target="_blank"
                rel="noreferrer"
                aria-label={t("Menüyü gör")}
                className="inline-flex items-center gap-2 rounded-md bg-herb px-3 py-2 font-mono text-[12px] uppercase tracking-wider text-paper shadow-sm transition-colors hover:bg-herb/90 sm:px-3.5"
              >
                <ExternalLinkIcon size={15} strokeWidth={2} />
                <span className="hidden sm:inline">{t("Menüyü gör")}</span>
              </a>
            )}
            {/* Dar ekranda kılavuz, dil ve çıkış menü yaprağındadır. */}
            {business && (
              <span className="hidden sm:inline-flex">
                <GuideButton />
              </span>
            )}
            <PanelLanguageSwitcher className={business ? "hidden sm:block" : ""} />
            <button
              onClick={handleLogout}
              aria-label={t("Çıkış")}
              className={`${business ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-2 rounded-md border border-line px-3 py-2 font-mono text-[12px] uppercase tracking-wider text-ink transition-colors hover:border-paprika hover:text-paprika sm:px-3.5`}
            >
              <LogoutIcon size={15} strokeWidth={2} />
              <span className="hidden md:inline">{t("Çıkış")}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 sm:px-5">
        {business && <PanelSidebar />}
        <main className="min-w-0 flex-1 py-10">
          {loadError && !business ? (
            <Card className="mx-auto max-w-md text-center">
              <p className="font-display text-lg font-bold">{t("İşletme bilgileri yüklenemedi")}</p>
              <p className="mt-1 text-sm text-ink-soft">{t("Bağlantıda geçici bir sorun olabilir. Verilerin güvende.")}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => refresh()}>
                {t("Tekrar dene")}
              </Button>
            </Card>
          ) : (
            <>
              <SuspensionBanner />
              <TrialBanner />
              {children}
            </>
          )}
        </main>
      </div>
    </div>
    </GuideProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useUiLocale();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/panel/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-soft">{t("Yükleniyor…")}</div>;
  }

  return (
    <BusinessProvider>
      <ToastProvider>
        <DashboardShell>{children}</DashboardShell>
      </ToastProvider>
    </BusinessProvider>
  );
}
