import type { Metadata } from "next";
import { cookies } from "next/headers";
import { UiLocaleProvider } from "@/components/ui-locale-provider";
import { normalizeUiLocale, UI_LOCALE_COOKIE } from "@/lib/ui-locales";

// Panel işletme sahiplerine özel yönetim alanı — arama motorlarına kapalı.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Arayüz dili çerezden okunur ki ilk boyama (giriş ekranı dahil) doğru dilde
// gelsin; oturum açılınca işletme kaydındaki tercih esas alınır
// (components/panel/language-switcher.tsx).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = normalizeUiLocale(store.get(UI_LOCALE_COOKIE)?.value);
  return (
    <UiLocaleProvider initialLocale={locale}>
      {children}
    </UiLocaleProvider>
  );
}
