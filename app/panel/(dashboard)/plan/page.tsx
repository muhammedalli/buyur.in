"use client";

import { useEffect, useState } from "react";
import { useBusiness } from "@/components/panel/business-context";
import { buttonClass, PageHeader } from "@/components/panel/ui";
import { PlanUsageCard } from "@/components/panel/plan-usage";
import { CheckCircleIcon, SparkIcon, WhatsappIcon } from "@/components/icons";
import { planUpgradeWhatsappLink, planWhatsappLink } from "@/lib/site";
import { PLAN_LABELS, PLAN_ORDER, featureMatrix, freemiumLimits, freemiumUsage, normalizePlan } from "@/lib/entitlements";
import { MONTHS_IN_YEAR, formatTL, planPricing } from "@/lib/pricing";
import { clearPlanIntent, readPlanIntent, type IntentBilling } from "@/lib/plan-intent";
import { trackMarketingEvent } from "@/lib/marketing-events";
import type { Business, Plan } from "@/lib/types";

// Plan sayfası: mevcut plan, Freemium kullanımı ve planların karşılaştırması.
// Tablo lib/entitlements.ts'ten geliyor — pazarlama sitesiyle aynı kaynak,
// dolayısıyla "sitede yazan" ile "panelde uygulanan" ayrışamaz.
//
// Panel içi destek modülü kaldırıldığı için yükseltme talebi WhatsApp üzerinden
// yürür: "Premium'u başlat" işletmeyi ve seçilen ödeme dönemini taşıyan hazır
// bir mesaj açar, ödeme ve aktivasyon o görüşmede tamamlanır.

/** Plan kısa tanıtımı. Freemium cümlesi canlı limitlerden kurulur. */
function planPitch(plan: Plan): string {
  if (plan === "freemium") return `${freemiumLimits().summary} — hangisi önce dolarsa. Ürün sınırı yok.`;
  return plan === "premium"
    ? "Süre sınırı yok; kampanyalar, gelişmiş analizler ve markasız menü."
    : "Web sitesi, rapor merkezi ve dışa aktarma.";
}

const START_LABELS: Record<Plan, string> = {
  freemium: "Freemium'a geç",
  premium: "Premium'u başlat",
  elite: "Elite'i başlat",
};

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="font-mono text-[12px] uppercase tracking-wider">{value}</span>;
  }
  return value ? (
    <span className="inline-flex text-herb" aria-label="var">
      <CheckCircleIcon size={16} />
    </span>
  ) : (
    <span className="text-ink-soft/40" aria-label="yok">
      —
    </span>
  );
}

function UpgradeCard({
  plan,
  business,
  preferredBilling,
  onStart,
}: {
  plan: Plan;
  business: Business;
  preferredBilling: IntentBilling;
  onStart: (plan: Plan, billing: IntentBilling) => void;
}) {
  const [billing, setBilling] = useState<IntentBilling>(preferredBilling);
  // Fiyat canlı `buyur_plans` kaydından gelir; okunamadıysa rakam gösterilmez.
  const pricing = planPricing(plan);

  useEffect(() => {
    setBilling(preferredBilling);
  }, [preferredBilling]);

  return (
    <div className="flex flex-col rounded-md border border-line bg-paper p-5">
      <p className="font-display text-lg font-bold">{PLAN_LABELS[plan]}</p>
      <p className="mt-1 text-sm text-ink-soft">{planPitch(plan)}</p>

      {pricing ? (
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ödeme dönemi">
        {(["yearly", "monthly"] as const).map((option) => {
          const active = billing === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setBilling(option)}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${active ? "border-paprika bg-paprika/5" : "border-line hover:border-ink/30"
                }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                {option === "yearly" ? "Yıllık" : "Aylık"}
              </span>
              <span className="block font-display text-base font-bold">
                {formatTL(option === "yearly" ? pricing.yearlyMonthly : pricing.monthly)}
                <span className="font-mono text-[10px] font-normal text-ink-soft"> / ay</span>
              </span>
              <span className="block text-[11px] text-ink-soft">
                {option === "yearly" ? `${formatTL(pricing.yearlyMonthly * MONTHS_IN_YEAR)} peşin` : "Taahhüt yok"}
              </span>
            </button>
          );
        })}
      </div>
      ) : (
        <p className="mt-4 rounded-md border border-line px-3 py-2.5 text-sm text-ink-soft">
          Güncel fiyat için bize WhatsApp&apos;tan yazın.
        </p>
      )}

      <a
        href={planUpgradeWhatsappLink(PLAN_LABELS[plan], billing, business.name, business.slug)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onStart(plan, billing)}
        className={buttonClass("primary", "mt-4 w-full")}
      >
        <WhatsappIcon size={15} /> {START_LABELS[plan]}
      </a>
      <p className="mt-2 text-xs text-ink-soft">
        WhatsApp üzerinden açılır; ödeme ve aktivasyon adımlarını oradan paylaşırız.
      </p>
    </div>
  );
}

export default function PlanPage() {
  const { business } = useBusiness();
  const [preferredBilling, setPreferredBilling] = useState<IntentBilling>("yearly");

  useEffect(() => {
    const intent = readPlanIntent();
    if (intent) setPreferredBilling(intent.billing);
  }, []);

  if (!business) return null;

  const current = normalizePlan(business.plan);
  const usage = freemiumUsage(business);
  // Yalnızca mevcut plandan DAHA YÜKSEK planlar "yükseltme" olarak gösterilir.
  // Elite (en üst plan) için bu liste boş kalır — "geç" seçeneği anlamsız olurdu.
  const upgrades = PLAN_ORDER.filter((plan) => PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(current));

  // Talep WhatsApp'a taşındığı için burada yalnızca niyet temizlenir ve
  // pazarlama olayı yazılır; kayıt oluşturulmaz.
  function startUpgrade(plan: Plan, billing: IntentBilling) {
    clearPlanIntent();
    trackMarketingEvent("upgrade_requested", { plan, billing });
  }

  return (
    <div>
      <PageHeader
        title="Plan ve kullanım"
        description="Hangi plandasınız, ne kadar kullandınız ve yükseltince ne kazanırsınız"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanUsageCard business={business} />

        <div className="rounded-md border border-line bg-paper p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Planınızda neler var</p>
          <ul className="mt-3 space-y-2 text-sm">
            {featureMatrix().filter((row) => row.values[current] !== false).map((row) => (
              <li key={row.label} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-herb" aria-hidden>
                  <CheckCircleIcon size={15} />
                </span>
                <span>
                  {row.label}
                  {typeof row.values[current] === "string" && (
                    <span className="text-ink-soft"> — {row.values[current] as string}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {usage.limited && (
            <p className="mt-4 rounded-md bg-crema/70 px-4 py-3 text-xs leading-relaxed text-ink-soft">
              Freemium&apos;da süre ve menü görüntülenme birlikte izlenir; hangisi önce dolarsa plan sona erer.
              Verileriniz silinmez — yükselttiğinizde menünüz ve analizleriniz olduğu gibi devam eder.
            </p>
          )}
        </div>
      </div>

      {upgrades.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {upgrades.map((plan) => (
            <UpgradeCard
              key={plan}
              plan={plan}
              business={business}
              preferredBilling={preferredBilling}
              onStart={startUpgrade}
            />
          ))}
        </div>
      ) : (
        <div className="relative mt-6 overflow-hidden rounded-md border border-ink bg-ink px-8 py-10 text-center text-paper">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{ background: "radial-gradient(60% 90% at 50% 0%, var(--color-paprika), transparent)" }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-3">
            <span className="inline-flex rounded-md bg-paprika/15 p-3 text-paprika">
              <SparkIcon size={22} />
            </span>
            <p className="font-mono text-[11px] uppercase tracking-wider text-paper/60">En üst seviye</p>
            <p className="font-display text-xl font-bold sm:text-2xl">Elite plandasınız</p>
            <p className="max-w-md text-sm leading-relaxed text-paper/70">
              buyur&apos;nın tüm özellikleri sizde açık: sınırsız kullanım, gelişmiş analizler, otomatik web
              sitesi, gelişmiş raporlar ve dışa aktarma. Yükseltilecek başka bir plan yok.
            </p>
            <a
              href={planWhatsappLink(PLAN_LABELS.elite)}
              target="_blank"
              rel="noopener noreferrer"
              // Kitin açık zeminli hâli koyu kartta okunur. Rengi className ile
              // ezmek (text-paper) açık zeminde açık yazı bırakıp etiketi
              // görünmez yapıyordu.
              className={buttonClass("outline", "mt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika")}
            >
              <WhatsappIcon size={14} /> WhatsApp ile iletişime geç
            </a>
          </div>
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-md border border-line bg-paper">
        <table className="w-full text-[13px] sm:min-w-[640px] sm:text-sm">
          <thead>
            <tr className="border-b border-line bg-crema/50 text-left">
              <th className="px-2.5 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-soft sm:px-5">Özellik</th>
              {PLAN_ORDER.map((plan) => (
                <th key={plan} className="px-1.5 py-3 text-center sm:px-5">
                  <span className={`font-display text-[13px] font-bold sm:text-base ${plan === current ? "text-paprika" : ""}`}>
                    {PLAN_LABELS[plan]}
                  </span>
                  {plan === current && (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-paprika">
                      Mevcut plan
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureMatrix().map((row) => (
              <tr key={row.label} className="border-b border-line/60 last:border-0">
                <td className="px-2.5 py-3 sm:px-5">{row.label}</td>
                {PLAN_ORDER.map((plan) => (
                  <td key={plan} className={`px-1.5 py-3 text-center sm:px-5 ${plan === current ? "bg-paprika/5" : ""}`}>
                    <Cell value={row.values[plan]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
