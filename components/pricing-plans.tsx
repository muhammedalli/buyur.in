"use client";

import { useState } from "react";
import Link from "next/link";
import { whatsappLink } from "@/lib/site";
import { CheckCircleIcon, WhatsappIcon } from "@/components/icons";
import { MONTHS_IN_YEAR, formatTL, yearlyDiscountPercent } from "@/lib/pricing";
import { PLAN_ORDER } from "@/lib/entitlements";
import { siteClientTranslator } from "@/lib/ui-messages/site-client";
import type { Translator, UiLocale } from "@/lib/ui-i18n";
import type { Plan } from "@/lib/types";

// Fiyat kartları. İçerik (ad, açıklama, özellikler) sunucuda arayüz dilinde
// hazırlanıp gelir (components/pricing.tsx → planTexts: canlı `buyur_plans`,
// yoksa tohum katalog); rakamlar ilan fiyatının tek kaynağından (lib/pricing.ts).
// Burada yalnızca dönem seçimi ve kartın sabit metinleri var.

interface PlanCard {
  key: Plan;
  name: string;
  desc: string;
  features: string[];
  /** Ücretli planda kayıt okunamadıysa null: rakam uydurulmaz. */
  monthly: number | null;
  yearlyMonthly: number | null;
  trialMonths: number;
  highlight: boolean;
  badge?: string;
}

/** Sunucudan gelen, arayüz diline çevrilmiş paket metinleri. */
export interface PlanText {
  key: Plan;
  name?: string;
  description?: string;
  features?: string[];
  trial_months?: number;
  /** Canlı ilan fiyatı (lib/pricing.ts → planPricing); bilinmiyorsa null. */
  monthly?: number | null;
  yearlyMonthly?: number | null;
}

function buildCards(texts: PlanText[], t: Translator): PlanCard[] {
  return PLAN_ORDER.map((key) => {
    const live = texts.find((entry) => entry.key === key);
    return {
      key,
      name: live?.name || key,
      desc: live?.description ?? "",
      features: live?.features ?? [],
      // Kodda fiyat yok: ilan fiyatı `buyur_plans`'tan gelir. Ücretsiz plan tanım
      // gereği 0₺; ücretli planda kayıt okunamadıysa null kalır.
      monthly: key === "freemium" ? 0 : (live?.monthly ?? null),
      yearlyMonthly: key === "freemium" ? 0 : (live?.yearlyMonthly ?? null),
      trialMonths: live?.trial_months ?? 0,
      // "En çok tercih edilen" vurgusu bilinçli olarak orta katmana sabit.
      highlight: key === "premium",
      badge: key === "premium" ? t("En çok tercih edilen") : undefined,
    };
  });
}

type Billing = "monthly" | "yearly";

function BillingToggle({
  billing,
  onChange,
  discount,
  t,
}: {
  billing: Billing;
  onChange: (b: Billing) => void;
  discount: number;
  t: Translator;
}) {
  const options: { value: Billing; label: string }[] = [
    { value: "monthly", label: t("Aylık") },
    { value: "yearly", label: t("Yıllık") },
  ];

  return (
    <div className="mt-10 flex justify-center">
      <div className="relative inline-flex items-center gap-1 rounded-full border border-line bg-crema/60 p-1">
        {options.map((option) => {
          const active = billing === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-full px-5 py-2 font-mono text-[12px] uppercase tracking-wider transition-all duration-300 ${
                active ? "bg-ink text-paper shadow-[0_8px_18px_-10px_rgba(35,24,18,0.9)]" : "text-ink-soft hover:text-ink"
              }`}
            >
              {option.label}
              {option.value === "yearly" && discount > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide ${
                    active ? "bg-paprika text-paper" : "bg-paprika/10 text-paprika"
                  }`}
                >
                  −%{discount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Yıllıkta büyük rakam aylık karşılıktır; peşin tutar hemen altında AYNI
 *  okunurlukta yazılır ("Aylık karşılığı 199,20₺ — yıllık 2.390,40₺ peşin"). */
function PlanPrice({
  card,
  billing,
  freemiumViews,
  t,
}: {
  card: PlanCard;
  billing: Billing;
  freemiumViews: string;
  t: Translator;
}) {
  const soft = card.highlight ? "text-paper/60" : "text-ink-soft";
  const eyebrow = `mt-4 font-mono text-[10px] uppercase tracking-wider ${soft}`;

  if (card.monthly === 0) {
    return (
      <>
        <p className={eyebrow}>
          {card.trialMonths > 0 ? t("{count} ay ücretsiz", { count: card.trialMonths }) : t("Ücretsiz")}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-4xl font-extrabold lg:text-5xl">0₺</span>
        </div>
        <p className="mt-2 text-sm font-semibold">
          {card.trialMonths > 0
            ? t("{count} ay veya {views} görüntülenme", { count: card.trialMonths, views: freemiumViews })
            : t("Süre sınırı yok")}
        </p>
        <p className={`text-xs ${soft}`}>{t("Kredi kartı istenmez")}</p>
      </>
    );
  }

  // Ücretli planın fiyatı okunamadıysa rakam uydurmak yerine açıkça yönlendiriyoruz.
  if (card.monthly === null || card.yearlyMonthly === null) {
    return (
      <>
        <p className={eyebrow}>{t("Fiyat")}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-2xl font-extrabold lg:text-3xl">{t("Bize yazın")}</span>
        </div>
        <p className="mt-2 text-sm font-semibold">{t("Güncel fiyat için WhatsApp'tan ulaşın")}</p>
      </>
    );
  }

  const saving = Math.round((1 - card.yearlyMonthly / card.monthly) * 100);

  // key={billing}: dönem değişince rakam kısa bir geçişle yeniden girer.
  if (billing === "yearly") {
    return (
      <div key="yearly" className="billing-swap">
        <p className={eyebrow}>{t("Aylık karşılığı")}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-4xl font-extrabold lg:text-5xl">{formatTL(card.yearlyMonthly)}</span>
          <span className={`font-mono text-xs uppercase tracking-wider ${soft}`}>{t("/ ay")}</span>
        </div>
        <p className="mt-2 text-sm font-semibold">
          {t("Yıllık {amount} peşin", { amount: formatTL(card.yearlyMonthly * MONTHS_IN_YEAR) })}
        </p>
        <p className={`text-xs ${soft}`}>
          {saving > 0 ? t("Aylık ödemeye göre %{saving} tasarruf", { saving }) : t("Tek seferde tahsil edilir")}
        </p>
      </div>
    );
  }

  return (
    <div key="monthly" className="billing-swap">
      <p className={eyebrow}>{t("Aylık ödeme")}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-4xl font-extrabold lg:text-5xl">{formatTL(card.monthly)}</span>
        <span className={`font-mono text-xs uppercase tracking-wider ${soft}`}>{t("/ ay")}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{t("Her ay faturalanır · taahhüt yok")}</p>
      <p className={`text-xs ${soft}`}>{t("Yıllık ödersen ayda {amount}", { amount: formatTL(card.yearlyMonthly) })}</p>
    </div>
  );
}

/** Satın alma yolları: Freemium ve Premium kayıt akışından başlar (WhatsApp'a
 *  bağımlı değil); Elite bir demo görüşmesiyle başlar. */
function PlanCta({ card, billing, t }: { card: PlanCard; billing: Billing; t: Translator }) {
  const style = card.highlight
    ? "bg-paprika text-paper hover:bg-paprika-deep hover:shadow-[0_16px_34px_-12px_rgba(232,73,31,0.9)]"
    : "border border-ink text-ink hover:bg-ink hover:text-paper";
  const className = `shine-on-hover relative mt-8 flex items-center justify-center gap-2 overflow-hidden rounded-md py-3.5 text-center font-mono text-[13px] uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5 ${style}`;
  const note = `mt-2.5 text-center text-[11px] ${card.highlight ? "text-paper/50" : "text-ink-soft/80"}`;

  if (card.key === "freemium") {
    return (
      <>
        <Link href="/panel/register" data-track="plan_cta" data-track-plan="freemium" className={className}>
          {t("Ücretsiz oluştur")}
        </Link>
        <p className={note}>{t("Menünü kur, QR'ını yayına al")}</p>
      </>
    );
  }

  if (card.key === "premium") {
    return (
      <>
        <Link
          href={`/panel/register?plan=premium&billing=${billing}`}
          data-track="plan_cta"
          data-track-plan="premium"
          data-track-billing={billing}
          className={className}
        >
          {t("Premium'u başlat")}
        </Link>
        <p className={note}>{t("Hesabını aç, ödemeyi panelden başlat")}</p>
      </>
    );
  }

  return (
    <>
      <a
        href={whatsappLink(t("Merhaba! buyur Elite paketi için demo görmek istiyorum."))}
        target="_blank"
        rel="noopener noreferrer"
        data-track="plan_cta"
        data-track-plan="elite"
        className={className}
      >
        {t("Elite demo al")}
      </a>
      <p className={note}>{t("Demo görüşmesi WhatsApp'tan planlanır")}</p>
    </>
  );
}

export function PlanGrid({
  texts = [],
  freemiumViews = "5.000",
  locale = "tr",
}: {
  texts?: PlanText[];
  freemiumViews?: string;
  locale?: UiLocale;
}) {
  const t = siteClientTranslator(locale);
  const CARDS = buildCards(texts, t);
  // Varsayılan yıllık: ilan edilen fiyat yıllık kurguya göre belirlendi.
  const [billing, setBilling] = useState<Billing>("yearly");
  const premium = CARDS.find((card) => card.key === "premium");

  return (
    <>
      <BillingToggle
        billing={billing}
        onChange={setBilling}
        t={t}
        discount={
          premium?.monthly && premium.yearlyMonthly !== null
            ? yearlyDiscountPercent({ monthly: premium.monthly, yearlyMonthly: premium.yearlyMonthly })
            : 0
        }
      />

      <div className="mt-12 grid items-start gap-5 md:grid-cols-3">
        {CARDS.map((card, i) => (
          <div
            key={card.key}
            data-reveal
            style={{ transitionDelay: `${i * 90}ms` }}
            className={`plan-card relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1.5 ${
              card.highlight
                ? "border-paprika bg-ink text-paper shadow-[0_24px_50px_-20px_rgba(232,73,31,0.4)] hover:shadow-[0_34px_60px_-20px_rgba(232,73,31,0.55)] md:-mt-4"
                : "border-line bg-paper hover:border-ink/30 hover:shadow-[0_24px_50px_-28px_rgba(35,24,18,0.5)]"
            }`}
          >
            {card.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-paprika px-3.5 py-1 font-mono text-[10px] uppercase tracking-wider text-paper">
                {card.badge}
              </span>
            )}

            <h3 className="font-display text-xl font-bold">{card.name}</h3>
            <p className={`mt-1 text-sm ${card.highlight ? "text-paper/60" : "text-ink-soft"}`}>{card.desc}</p>
            <PlanPrice card={card} billing={billing} freemiumViews={freemiumViews} t={t} />

            <ul className="mt-6 flex-1 space-y-2.5 border-t border-current/10 pt-6 text-sm">
              {card.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-herb" aria-hidden>
                    <CheckCircleIcon size={15} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <PlanCta card={card} billing={billing} t={t} />
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-ink-soft">
        {t("Karar vermeden önce sormak mı istiyorsunuz?")}{" "}
        <a
          href={whatsappLink(t("Merhaba, buyur paketleri hakkında bir sorum var:"))}
          target="_blank"
          rel="noopener noreferrer"
          data-track="whatsapp_lead"
          data-track-location="pricing"
          className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:text-paprika"
        >
          <WhatsappIcon size={13} /> {t("WhatsApp'tan yazın")}
        </a>
      </p>
    </>
  );
}
