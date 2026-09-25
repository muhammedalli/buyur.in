"use client";

import { useBusiness } from "@/components/panel/business-context";
import { UpgradeNotice } from "@/components/panel/ui";
import {
  PLAN_LABELS_DATIVE,
  PLAN_LABELS_LOCATIVE,
  PLAN_ORDER,
  isSubscriptionActive,
  normalizePlan,
  requiredPlanFor,
  upgradeTargetFor,
  type Feature,
} from "@/lib/entitlements";

// Kilitli özellik kartının tek kaynağı. Sayfalar yalnızca hangi özelliğin
// kilitli olduğunu ve konusunu söyler; başlıktaki plan adı ile "X'e yükselt"
// butonu işletmenin GERÇEK planından (buyur_businesses.plan + canlı katalog)
// hesaplanır. Böylece:
//   Freemium → özelliğin açıldığı plan önerilir (çoğunlukla Premium)
//   Premium  → yalnızca Elite özellikleri kilitli görünür, CTA "Elite'e yükselt"
//   Elite    → yükseltme CTA'sı hiç çizilmez

export function FeatureLocked({
  feature,
  subject,
  description,
}: {
  feature: Feature;
  /** Kilitli bölümün adı: "Ürün analitiği", "Rapor merkezi"… */
  subject: string;
  /** Bölümün ne sunduğu — plan adı içermemeli, başlık onu söylüyor. */
  description: string;
}) {
  const { business } = useBusiness();
  const current = normalizePlan(business?.plan);
  const required = requiredPlanFor(feature);
  const target = business ? upgradeTargetFor(business, feature) : null;

  // Özellik bu planda varsa kilidin sebebi plan değil, dolan Freemium limitidir.
  const needsHigherPlan = required !== null && PLAN_ORDER.indexOf(required) > PLAN_ORDER.indexOf(current);
  const limitReached = !needsHigherPlan && business !== null && !isSubscriptionActive(business);

  let title = `${subject} planınızda kapalı`;
  let detail = description;
  if (needsHigherPlan) {
    title = `${subject} ${PLAN_LABELS_LOCATIVE[required]}`;
  } else if (limitReached) {
    title = `${subject} şu an kapalı`;
    detail = `${description} Freemium kullanımınız dolduğu için şu an erişilemiyor; yükselttiğinizde verileriniz olduğu gibi açılır.`;
  }

  return (
    <UpgradeNotice
      title={title}
      description={detail}
      ctaLabel={target ? `${PLAN_LABELS_DATIVE[target]} yükselt` : null}
    />
  );
}
