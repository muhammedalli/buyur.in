"use client";

import Link from "next/link";
import { useBusiness } from "@/components/panel/business-context";
import { buttonClass, Card, PageHeader, Spinner } from "@/components/panel/ui";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { MenuImport } from "@/components/panel/ai/menu-import";
import { useUiLocale } from "@/components/ui-locale-provider";
import { PLAN_LABELS, PLAN_LABELS_DATIVE, aiUsage, entitlementsFor, isFeatureAvailable, upgradePlans } from "@/lib/entitlements";
import { SparklesIcon } from "@/components/icons";

// Yapay Zeka — fiziksel menüyü dijitale taşıyan tek ekran.
//
// Çoklu dil üretimi bilinçli olarak buradan kaldırıldı: toplu çeviri her
// basışta tüm menüyü yeniden çeviriyordu. Artık çeviri, kategori/ürün formunun
// sağ üstündeki "AI ile tamamla" butonuyla yalnızca düzenlenen kayıt
// için çalışır (bkz. components/panel/ai/translate-button.tsx).

export default function AiPage() {
  const { business, isLoading } = useBusiness();
  const { t } = useUiLocale();

  if (isLoading || !business) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6 text-paprika" />
      </div>
    );
  }

  if (!isFeatureAvailable(business, "ai_menu_import")) {
    return (
      <>
        <PageHeader title={t("Yapay Zeka")} description={t("Menünüzü yapay zekâ ile hazırlayın.")} />
        <FeatureLocked
          feature="ai_menu_import"
          subject={t("Yapay zekâ ile menü aktarımı")}
          description={t("Fiziksel menünüzün fotoğrafından ürünler otomatik okunup listeye eklenir.")}
        />
      </>
    );
  }

  const usage = aiUsage(business);
  // "Daha fazlası için yükselt" yalnızca gerçekten daha çok hak veren bir üst
  // plan varsa söylenir — en üst planda (Elite) böyle bir yol yok.
  const moreScansPlan = upgradePlans(business.plan).find((plan) => {
    const limit = entitlementsFor(plan).limits.aiScansPerMonth;
    return limit === null || (usage.limit !== null && limit > usage.limit);
  });

  return (
    <>
      <PageHeader
        title={t("Yapay Zeka")}
        description={t("Fiziksel menünüzün fotoğrafını yükleyin, ürünler otomatik okunup listeye eklensin.")}
        action={
          <div className="flex items-center gap-2 rounded-md border border-line bg-crema/40 px-4 py-2">
            <SparklesIcon size={16} className="text-paprika" />
            <span className="text-xs font-medium text-ink-soft">
              {usage.limit === null
                ? t("Sınırsız tarama")
                : t("Bu ay {used}/{limit} tarama", { used: usage.used, limit: usage.limit })}
            </span>
          </div>
        }
      />

      {usage.exhausted ? (
        <Card className="border-paprika/40 bg-paprika/5 text-center">
          <p className="font-display text-lg font-bold">{t("Bu ayki tarama hakkınız doldu")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            {t("{count} taramanın tamamını kullandınız. Hakkınız gelecek ay yenilenir.", { count: usage.limit ?? 0 })}
            {moreScansPlan &&
              ` ${t("Daha fazla tarama için {planDative} yükseltebilirsiniz.", { planDative: PLAN_LABELS_DATIVE[moreScansPlan], plan: PLAN_LABELS[moreScansPlan] })}`}
          </p>
          {moreScansPlan && (
            <Link href="/panel/plan" className={buttonClass("primary", "mt-4")}>
              {t("{planDative} yükselt", { planDative: PLAN_LABELS_DATIVE[moreScansPlan], plan: PLAN_LABELS[moreScansPlan] })}
            </Link>
          )}
        </Card>
      ) : (
        <MenuImport business={business} />
      )}
    </>
  );
}
