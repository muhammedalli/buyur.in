"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChartSkeleton } from "@/components/panel/charts/frame";
import type { AnalyticsError } from "@/lib/analytics/panel-client";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

// Analiz sayfalarının ortak durumları: yükleniyor, hata, plan kilidi, veri yok.
// Hiçbirinde uydurma sayı göstermiyoruz — veri yoksa ne yapılması gerektiğini
// anlatıyoruz.

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-28 animate-pulse rounded-md bg-crema/70" />
        ))}
      </div>
      <div className="rounded-md border border-line bg-paper p-5">
        <ChartSkeleton height={240} />
      </div>
    </div>
  );
}

export function AnalyticsErrorState({ error, onRetry }: { error: AnalyticsError; onRetry: () => void }) {
  const { t } = useUiLocale();
  if (error.isUnauthenticated) {
    return (
      <div className="rounded-md border border-line bg-paper p-8 text-center">
        <p className="font-display text-lg font-bold">{t("Oturumun sona ermiş")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("Analizleri görmek için tekrar giriş yapman gerekiyor.")}</p>
        <Link
          href="/panel/login"
          className="mt-4 inline-block rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-paprika"
        >
          {t("Giriş yap")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-paper p-8 text-center">
      <p className="font-display text-lg font-bold">{t("Analiz verileri şu anda yüklenemiyor")}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("Lütfen birkaç dakika sonra tekrar deneyin.")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md border border-line px-5 py-2.5 text-sm font-medium transition-colors hover:border-paprika hover:text-paprika"
      >
        {t("Tekrar dene")}
      </button>
    </div>
  );
}

export function NoDataYet({ title = msg("Henüz yeterli veri yok"), description, action }: { title?: string; description: string; action?: ReactNode }) {
  const { t } = useUiLocale();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line px-6 py-16 text-center">
      <p className="font-display text-lg font-bold">{t(title)}</p>
      <p className="max-w-md text-sm text-ink-soft">{t(description)}</p>
      {action}
    </div>
  );
}

/** Yenileme sırasında içeriği soluklaştıran sarmalayıcı. */
export function Refreshable({ refreshing, children }: { refreshing: boolean; children: ReactNode }) {
  return (
    <div className={refreshing ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
      {children}
    </div>
  );
}
