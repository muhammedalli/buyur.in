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
import { Button, buttonClass, Card, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/panel/ui";
import { PanelLanguageSwitcher, PanelLocaleSync } from "@/components/panel/language-switcher";
import { GuideButton, GuideProvider } from "@/components/panel/guide";
import { PanelBreadcrumb, PanelSidebar } from "@/components/panel/panel-nav";
import { useUiLocale } from "@/components/ui-locale-provider";
import { menuPageUrl } from "@/lib/storefront";
import { setChartLocale } from "@/components/panel/charts/chart-utils";
import { ExternalLinkIcon, LogoutIcon } from "@/components/icons";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { business, isLoading, loadError, refresh } = useBusiness();
  const { t, locale } = useUiLocale();
  // Grafik ve analiz biçimleri (tarih, yüzde, süre) arayüz diline uysun. Boyama
  // sırasında çağrılır ki alt ağaç aynı turda doğru dille biçimlensin.
  setChartLocale(locale);

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

  const body =
    loadError && !business ? (
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
    );

  return (
    <GuideProvider>
      <PanelLocaleSync />
      <SidebarProvider storageKey="buyur-panel-sidebar">
        {/* Kurulumu bitmemiş hesapta gezinecek bir şey yok: yan menü çizilmez. */}
        {business && <PanelSidebar business={business} onLogout={handleLogout} />}
        <SidebarInset
          header={
            <>
              {business ? (
                <>
                  <SidebarTrigger label={t("Menüyü aç")} />
                  <span aria-hidden className="h-5 w-px shrink-0 bg-line" />
                  <PanelBreadcrumb />
                </>
              ) : (
                <Link href="/panel" className="shrink-0">
                  <Logo className="h-7" />
                </Link>
              )}
              <div className="ms-auto flex shrink-0 items-center gap-2">
                {business && (
                  <a
                    href={menuPageUrl(business.slug)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("Menüyü gör")}
                    className={buttonClass("primary", "bg-herb hover:bg-herb/90", "sm")}
                  >
                    <ExternalLinkIcon size={15} strokeWidth={2} />
                    <span className="hidden sm:inline">{t("Menüyü gör")}</span>
                  </a>
                )}
                {business && (
                  <span className="hidden sm:inline-flex">
                    <GuideButton />
                  </span>
                )}
                <PanelLanguageSwitcher />
                {/* Kurulum ekranında hesap menüsü (yan menü) yok: çıkış burada. */}
                {!business && (
                  <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                    <LogoutIcon size={15} strokeWidth={2} />
                    {t("Çıkış")}
                  </Button>
                )}
              </div>
            </>
          }
        >
          <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{body}</main>
        </SidebarInset>
      </SidebarProvider>
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
