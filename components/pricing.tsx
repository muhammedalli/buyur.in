import Link from "next/link";
import { sectionId } from "@/lib/landing-sections";
import { whatsappLink } from "@/lib/site";
import { ArrowRightIcon, CheckCircleIcon, WhatsappIcon } from "@/components/icons";
import { Marquee } from "@/components/marquee";
import { PlanGrid, type PlanText } from "@/components/pricing-plans";
import { PLAN_LABELS, PLAN_ORDER, featureMatrix, freemiumLimits } from "@/lib/entitlements";
import { loadedPlanRecords } from "@/lib/plan-catalog-loader";
import { PLAN_SEEDS } from "@/scripts/plan-catalog.mjs";
import type { Plan } from "@/lib/types";
import { MONTHS_IN_YEAR, formatTL, planPricing, yearlyDiscountPercent } from "@/lib/pricing";
import { siteTranslator } from "@/lib/ui-messages/site";
import { msg, uiLocaleTags, type Translator, type UiLocale } from "@/lib/ui-i18n";

/** Paket metni arayüz dilinde. Türkçede canlı kayıt (yoksa tohum katalog);
 *  diğer dillerde canlı Türkçe metnin çevirisi, çevirisi yoksa (yönetim metni
 *  değiştirmişse) tohum metnin çevirisi — İngilizce sayfada Türkçe paket
 *  metni görünmesin. */
function localizedText(t: Translator, locale: UiLocale, live: string | undefined, seed: string | undefined): string {
  if (locale === "tr") return live || seed || "";
  if (live) {
    const translated = t(live);
    if (translated !== live) return translated;
  }
  return seed ? t(seed) : live ?? "";
}

function localizedFeatures(t: Translator, locale: UiLocale, live: string[] | undefined, seed: string[]): string[] {
  const source = live && live.length > 0 ? live : seed;
  if (locale === "tr") return source;
  const translated = source.map((feature) => t(feature));
  return translated.every((feature, index) => feature !== source[index]) ? translated : seed.map((feature) => t(feature));
}

/** Fiyat kartlarının sunucuda, arayüz dilinde hazırlanan metinleri. */
function planTexts(t: Translator, locale: UiLocale): PlanText[] {
  const records = loadedPlanRecords();
  return PLAN_ORDER.map((key) => {
    const record = records.find((entry) => entry.key === key);
    const seed = PLAN_SEEDS.find((entry) => entry.key === key);
    const liveFeatures = Array.isArray(record?.features) ? (record.features as string[]) : undefined;
    return {
      key,
      name: record?.name || seed?.name || key,
      description: localizedText(t, locale, record?.description, seed?.description),
      features: localizedFeatures(t, locale, liveFeatures, seed?.features ?? []),
      trial_months: record?.trial_months ?? seed?.trial_months ?? 0,
      monthly: planPricing(key as Plan)?.monthly ?? null,
      yearlyMonthly: planPricing(key as Plan)?.yearlyMonthly ?? null,
    };
  });
}

export function Pricing({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);
  const freemium = freemiumLimits(t, uiLocaleTags[locale]);

  return (
    <section id={sectionId("pricing")} data-track-view="pricing_viewed" className="mx-auto max-w-6xl px-5 py-24">
      <div data-reveal>
        <p className="text-center font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Hesap lütfen")}</p>
        <h2 className="mt-3 text-center font-display text-4xl font-extrabold tracking-tight md:text-5xl">
          {t("Baskı maliyetinden ucuz")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-ink-soft">
          {t("Bir kez menü bastırmanın parasıyla aylarca dijital kalın. Ücretsiz başlayın, işinize yaradığında devam edin.")}
        </p>
      </div>

      <PlanGrid texts={planTexts(t, locale)} freemiumViews={freemium.viewsLabel} locale={locale} />

      <p className="mx-auto mt-10 max-w-2xl rounded-2xl border border-line bg-crema/40 px-5 py-4 text-center text-sm text-ink-soft">
        <span className="font-semibold text-ink">{t("Freemium: {summary} kadar ücretsiz.", { summary: freemium.summary })}</span>{" "}
        {t(
          "İki limitten hangisi önce dolarsa Freemium sona erer. Ürün ve kategori sayısı hiçbir planda sınırlı değildir — menünüzün tamamını girebilirsiniz. Premium ve Elite'te süre ya da görüntülenme sınırı yoktur."
        )}
      </p>

      <PlanComparison t={t} locale={locale} />

      <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft/70">
        {t("Ücretsiz planda kredi kartı istemiyoruz · İstediğiniz an bırakabilirsiniz")}
      </p>
    </section>
  );
}

/** Plan karşılaştırması — panelle aynı kaynaktan (lib/entitlements.ts). */
function PlanComparison({ t, locale }: { t: Translator; locale: UiLocale }) {
  return (
    <div data-reveal className="mt-10 overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-line bg-crema/50 text-left">
            <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t("Özellik")}</th>
            {PLAN_ORDER.map((plan) => (
              <th key={plan} className="px-5 py-3 text-center font-display text-base font-bold">
                {PLAN_LABELS[plan]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureMatrix(t, uiLocaleTags[locale]).map((row) => (
            <tr key={row.label} className="border-b border-line/60 transition-colors last:border-0 hover:bg-crema/30">
              <td className="px-5 py-3">{row.label}</td>
              {PLAN_ORDER.map((plan) => {
                const value = row.values[plan];
                return (
                  <td key={plan} className="px-5 py-3 text-center">
                    {typeof value === "string" ? (
                      <span className="font-mono text-[12px] uppercase tracking-wider">{value}</span>
                    ) : value ? (
                      <span className="inline-flex text-herb" aria-label={t("var")}>
                        <CheckCircleIcon size={16} />
                      </span>
                    ) : (
                      <span className="text-ink-soft/40" aria-label={t("yok")}>
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Landing sayfası bu listeden FAQPage yapılandırılmış verisi de üretiyor
// (components/landing-page.tsx) — soru/cevap metinleri tek yerde dursun.
export function getFaqs(locale: UiLocale = "tr") {
  const t = siteTranslator(locale);
  const freemium = freemiumLimits(t, uiLocaleTags[locale]);
  const premium = planPricing("premium");
  const elite = planPricing("elite");
  return [
    {
      q: t("buyur sipariş alıyor mu?"),
      a: t(
        "Bugün sipariş ya da ödeme almıyor. Müşteri beğendiklerini sepette toplar, toplamı görür ve ekranı garsona gösterir; siparişi garsonunuz alır. Yanlış ya da eksik sipariş azalır, mevcut düzeniniz değişmez."
      ),
    },
    {
      q: t("Web sitem yoksa isletmem.buyur.in adresinde ne görünür?"),
      a: t(
        "İşletme bilgilerinizden otomatik oluşan bir karşılama sayfası: logo, kapak görseli, açıklama, adres, çalışma saatleri, iletişim ve sosyal medya; en üstte “Menüyü gör” butonu. Elite'te web siteniz yayındaysa ziyaretçi doğrudan sitenize girer. Masadaki QR ise her durumda doğrudan menüyü açar."
      ),
    },
    {
      q: t("Freemium ne kadar süre ücretsiz?"),
      a: t(
        "Freemium plan {summary} kadar ücretsizdir. Bu iki limitten hangisi önce dolarsa Freemium sona erer. Kredi kartı istemiyoruz.",
        { summary: freemium.summary }
      ),
    },
    {
      q: t("Freemium'da kaç ürün girebilirim?"),
      a: t(
        "Sınırsız. Hiçbir planda ürün ya da kategori limiti yoktur; menünüzün tamamını eksiksiz girebilirsiniz. Freemium'ın tek sınırı süre ve görüntülenmedir: {summary}.",
        { summary: freemium.summary }
      ),
    },
    {
      q: t("Premium ve Elite arasındaki fark nedir?"),
      a: t(
        "Premium; kampanyalar, gelişmiş analizler, buyur markası olmadan profesyonel menü içerir. Elite bunlara menünüzden otomatik oluşan web sitesini (animasyonlu tanıtım, menü slider'ı, galeri), rapor merkezini (PDF ve CSV dışa aktarma) ve öncelikli teknik desteği ekler."
      ),
    },
    {
      q: t("Premium'a nasıl geçerim?"),
      a: t(
        "Ücretsiz hesabınızı açın, ardından panelde Plan sayfasından “Premium'u başlat” deyin. Talebiniz ekibimize düşer; ödeme ve aktivasyon adımlarını destek talebiniz üzerinden tamamlarız. Menünüz ve verileriniz olduğu gibi kalır."
      ),
    },
    {
      q: t("Aylık mı yıllık mı ödemeliyim?"),
      a:
        premium && elite
          ? t(
              "İkisi de mümkün. Yıllık ödemede aylık maliyet %{discount} düşer: Premium ayda {premiumMonthly} yerine {premiumYearlyMonthly} (yıllık {premiumYearly} peşin), Elite ayda {eliteMonthly} yerine {eliteYearlyMonthly} (yıllık {eliteYearly} peşin). Aylık ödemede taahhüt yok, istediğiniz dönem sonunda bırakabilirsiniz.",
              {
                discount: yearlyDiscountPercent(premium),
                premiumMonthly: formatTL(premium.monthly),
                premiumYearlyMonthly: formatTL(premium.yearlyMonthly),
                premiumYearly: formatTL(premium.yearlyMonthly * MONTHS_IN_YEAR),
                eliteMonthly: formatTL(elite.monthly),
                eliteYearlyMonthly: formatTL(elite.yearlyMonthly),
                eliteYearly: formatTL(elite.yearlyMonthly * MONTHS_IN_YEAR),
              }
            )
          : t(
              "İkisi de mümkün. Yıllık ödemede aylık maliyet düşer; güncel fiyatlar için bize yazın. Aylık ödemede taahhüt yok, istediğiniz dönem sonunda bırakabilirsiniz."
            ),
    },
    {
      q: t("Freemium süresi dolunca verilerim silinir mi?"),
      a: t(
        "Hayır. Menünüz, ürünleriniz, görselleriniz ve analiz geçmişiniz olduğu gibi kalır. Yalnızca menünüzün yayını ve gelişmiş özellikler durur; bir plana geçtiğinizde her şey kaldığı yerden devam eder."
      ),
    },
    {
      q: t("Fiyat değiştirdiğimde müşteri ne zaman görür?"),
      a: t("Anında. Kaydet dediğiniz saniyede, açık olan tüm menülerde yeni fiyat görünür. Baskı beklemek yok."),
    },
    {
      q: t("QR kodu nasıl alacağım?"),
      a: t(
        "Kayıt olduğunuzda otomatik oluşur. Panelden yüksek çözünürlüklü indirir, dilediğiniz boyutta bastırırsınız. Masa numaralı QR'ları toplu oluşturup tek PDF olarak alabilir, hangi masanın QR'ının menüyü açtırıp sepete dönüştüğünü ayrı ayrı görebilirsiniz."
      ),
    },
    {
      q: t("Menüm hangi dillerde gösterilebilir?"),
      a: t(
        "Türkçe, İngilizce, Almanca, Arapça, Fransızca, İspanyolca, İtalyanca ve Rusça. Ana dilinizi seçer, ona en fazla üç dil eklersiniz; misafir menüde dilini seçer. Yapay zekâ boş kalan çevirileri tamamlar, siz kontrol edip kaydedersiniz."
      ),
    },
    {
      q: t("Analizler tam olarak neyi gösteriyor?"),
      a: t(
        "Menünüzün kaç kez açıldığını, hangi ürünlerin incelenip sepete eklendiğini, müşterinin menüde ne kadar kaldığını ve trafiğin nereden geldiğini. Freemium'da temel özet, Premium ve Elite'te ürün, kategori, kaynak ve QR kırılımları."
      ),
    },
    {
      q: t("Teknik bilgim yok, kullanabilir miyim?"),
      a: t(
        "Kesinlikle. Panel ilk girişte sizi adım adım gezdiren bir kılavuzla açılır; ürün eklemek fotoğraf paylaşmak kadar kolay. İsterseniz menünüzü gönderin, demo menünüzü biz hazırlayalım."
      ),
    },
  ];
}

export function FAQ({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);
  return (
    <section id={sectionId("faq")} className="border-t border-line bg-crema/40">
      <div className="mx-auto max-w-3xl px-5 py-24">
        <h2 data-reveal className="text-center font-display text-4xl font-extrabold tracking-tight">
          {t("Sık sorulanlar")}
        </h2>
        <div className="mt-10 divide-y divide-line">
          {getFaqs(locale).map((f) => (
            <details key={f.q} data-reveal className="faq-item group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold transition-colors hover:text-paprika">
                {f.q}
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xl text-paprika transition-transform duration-300 group-open:rotate-45 group-open:border-paprika"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="faq-answer mt-3 leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>

        <div data-reveal className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-line bg-paper p-8 text-center">
          <p className="font-display text-xl font-bold">{t("Sorunuz listede yok mu?")}</p>
          <p className="max-w-md text-sm text-ink-soft">
            {t("Yazın, gerçek bir insan cevaplasın. Satış konuşması değil — sadece merak ettiğinizi öğrenin.")}
          </p>
          <a
            href={whatsappLink(t("Merhaba, buyur hakkında bir sorum var:"))}
            target="_blank"
            rel="noopener noreferrer"
            data-track="whatsapp_lead"
            data-track-location="faq"
            className="inline-flex items-center gap-2 rounded-md border border-ink px-6 py-3 font-mono text-[13px] uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
          >
            <WhatsappIcon size={15} />
            {t("WhatsApp'tan sorun")}
          </a>
        </div>
      </div>
    </section>
  );
}

// Kapanış CTA'sı herkese hitap etmeli: tek bir "restoran sahibi" tipi
// yok — mahalle kafesi de, otel de aynı yerden başlıyor.
const audiences = [
  msg("Kafeler"),
  msg("Restoranlar"),
  msg("Pastaneler"),
  msg("Oteller"),
  msg("Barlar"),
  msg("Kahvaltı salonları"),
  msg("Food truck'lar"),
  msg("Bulut mutfaklar"),
];

export function ClosingCTA({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);
  return (
    <section className="relative overflow-hidden bg-paprika">
      {/* Zeminde yavaşça sürüklenen sıcak ışık */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="blob-drift absolute -left-20 -top-32 h-[28rem] w-[28rem] rounded-full bg-paper/10 blur-3xl" />
        <div
          className="blob-drift absolute -bottom-40 -right-20 h-[26rem] w-[26rem] rounded-full bg-ink/10 blur-3xl"
          style={{ animationDelay: "-8s" }}
        />
      </div>

      <div data-reveal className="relative mx-auto flex max-w-3xl flex-col items-center gap-7 px-5 py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/70">{t("Bir sonraki servis")}</p>

        <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-paper md:text-5xl">
          {t("Bir sonraki servise güncel menüyle başlayın.")}
        </h2>

        <p className="max-w-lg leading-relaxed text-paper/80">
          {t("Kredi kartı girmeden hesabınızı açın ya da mevcut menünüzü gönderin, ilk kurulumu birlikte yapalım.")}
        </p>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/panel/register"
            data-track="cta_click"
            data-track-location="final"
            data-track-cta="create_free"
            className="cta-nudge shine-on-hover relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-ink px-9 py-4 text-center font-mono text-sm uppercase tracking-wider text-paper transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-12px_rgba(35,24,18,0.7)]"
          >
            {t("Ücretsiz menünü oluştur")}
            <ArrowRightIcon size={16} className="cta-arrow" />
          </Link>
          <a
            href={whatsappLink(t("Merhaba! Menümü göndermek istiyorum, ilk kurulumu birlikte yapabilir miyiz?"))}
            target="_blank"
            rel="noopener noreferrer"
            data-track="whatsapp_lead"
            data-track-location="final"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-paper/40 px-9 py-4 text-center font-mono text-sm uppercase tracking-wider text-paper transition-all duration-300 hover:-translate-y-0.5 hover:border-paper hover:bg-paper hover:text-paprika"
          >
            <WhatsappIcon size={15} />
            {t("Menümü gönder")}
          </a>
        </div>

        {/* Kimler kullanıyor — kayan şerit */}
        <Marquee
          items={audiences.map((audience) => t(audience))}
          tone="bare"
          label={t("Kimler kullanıyor")}
          className="mt-6 w-full text-paper/80"
          separator={null}
          renderItem={(item) => (
            <span className="me-3 whitespace-nowrap rounded-full border border-paper/25 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-paper/80">
              {item}
            </span>
          )}
        />
      </div>
    </section>
  );
}
