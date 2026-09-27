"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/components/panel/business-context";
import { PopupForm } from "@/components/panel/popup-form";
import { PageHeader } from "@/components/panel/ui";
import { isFeatureAvailable } from "@/lib/entitlements";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";

export default function NewAnnouncementPage() {
  const { business, isLoading } = useBusiness();
  const { t } = useUiLocale();
  const router = useRouter();
  // Kampanya kapısı canlı plan kaydından okunur (BusinessProvider katalogu yükler).
  const campaignsAllowed = business ? isFeatureAvailable(business, "campaigns") : null;


  if (isLoading || !business || campaignsAllowed === null) {
    return <p className="text-ink-soft">{t("Yükleniyor…")}</p>;
  }

  if (!campaignsAllowed) {
    return (
      <FeatureLocked
        feature="campaigns"
        subject={t("Kampanyalar")}
        description={t("Menü açıldığında gösterilen kampanya ve duyuru pencereleri.")}
      />
    );
  }

  return (
    <div>
      <PageHeader title={t("Yeni duyuru")} />
      <PopupForm business={business} onSaved={() => router.replace("/panel/popups")} onCancel={() => router.back()} />
    </div>
  );
}
