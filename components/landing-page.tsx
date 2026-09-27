import { Footer } from "@/components/chrome";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Platform } from "@/components/platform";
import { FeatureGrid } from "@/components/feature-grid";
import { HowItWorks, ProblemSolution } from "@/components/features";
import { LiveMenu } from "@/components/live-menu";
import { PanelShowcase } from "@/components/panel-showcase";
import { Analytics } from "@/components/analytics";
import { Showcase } from "@/components/showcase";
import { Pricing, FAQ, ClosingCTA, getFaqs } from "@/components/pricing";
import { Comparison } from "@/components/comparison";
import { LandingTracker } from "@/components/landing-tracker";
import { DocumentLang } from "@/components/document-lang";
import { LegacyAnchorRedirect } from "@/components/legacy-anchor-redirect";
import { DEMO_SLUG, loadShowcase } from "@/lib/showcase";
import { BRAND_ICON, OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl, jsonLdScript } from "@/lib/seo";
import { planPricing } from "@/lib/pricing";
import { freemiumLimits } from "@/lib/entitlements";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { createServerPB } from "@/lib/pocketbase";
import { siteTranslator } from "@/lib/ui-messages/site";
import { siteLocalePath, uiLocaleTags, type Translator, type UiLocale } from "@/lib/ui-i18n";

// Pazarlama sitesinin ana sayfası — Türkçe (/) ve İngilizce (/en) aynı
// bileşenden, dile göre metinle üretilir (lib/ui-i18n.ts). Sosyal kanıt kartları
// ve plan/fiyat bilgisi canlı kayıtlardan (menüler, `buyur_plans`) okunur.
//
// Akış: sonuç odaklı hero → tek platform (panel → vitrin → menü) → üç
// sorun/çözüm → canlı menü → özellikler → panel ekranları → analitik → nasıl
// çalışır → canlı menüler → paketler → karşılaştırma → SSS → kapanış.

// Ürün kartı: Google "yazılım" sonuçlarında fiyat aralığını ve özellikleri
// buradan okur. Fiyatlar lib/pricing.ts'teki tek kaynaktan gelir.
function buildProductJsonLd(t: Translator, locale: UiLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: t("QR Menü"),
    operatingSystem: "Web, iOS, Android",
    url: absoluteUrl(siteLocalePath(locale)),
    logo: BRAND_ICON,
    screenshot: absoluteUrl(OG_IMAGE.url),
    inLanguage: uiLocaleTags[locale],
    description: t(SITE_DESCRIPTION),
    publisher: { "@id": `${SITE_URL}/#organization` },
    featureList: [
      t("Dakikalar içinde kurulan QR menü"),
      t("Anında fiyat ve stok güncelleme"),
      t("Masa bazlı QR kod üretimi"),
      t("Menü görüntülenme ve ürün analizleri"),
      t("Kampanya ve öne çıkarma araçları"),
      t("Sekiz dilde menü (Türkçe, İngilizce, Almanca, Arapça, Fransızca, İspanyolca, İtalyanca, Rusça)"),
      t("İşletme bilgilerinden otomatik karşılama sayfası"),
      t("Menüden otomatik oluşan web sitesi"),
    ],
    offers: [
      {
        "@type": "Offer",
        name: "Freemium",
        price: "0",
        priceCurrency: "TRY",
        description: t("{summary} kadar ücretsiz. Kredi kartı istenmez.", {
          summary: freemiumLimits(t, uiLocaleTags[locale]).summary,
        }),
        availability: "https://schema.org/InStock",
      },
      // Fiyatı bilinmeyen (kayıt okunamamış) plan için teklif üretilmez: rakam uydurulmaz.
      ...(["premium", "elite"] as const).flatMap((key) => {
        const pricing = planPricing(key);
        if (!pricing) return [];
        return [
          {
            "@type": "Offer" as const,
            name: key === "premium" ? "Premium" : "Elite",
            price: String(pricing.monthly),
            priceCurrency: "TRY",
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: String(pricing.monthly),
              priceCurrency: "TRY",
              referenceQuantity: {
                "@type": "QuantitativeValue",
                value: 1,
                unitCode: "MON",
              },
            },
          },
        ];
      }),
    ],
  };
}

// Sık sorulanlar bölümünün makine okunur karşılığı — arama sonucunda açılır
// cevap olarak görünebilir. Plan limitleri canlı katalogdan geldiği için render
// anında kurulur.
function buildFaqJsonLd(locale: UiLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absoluteUrl(siteLocalePath(locale))}#faq`,
    inLanguage: uiLocaleTags[locale],
    mainEntity: getFaqs(locale).map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export async function LandingPage({ locale }: { locale: UiLocale }) {
  const t = siteTranslator(locale);
  // Plan limitleri ve paket metinleri canlı `buyur_plans` kaydından gelir.
  const [showcase] = await Promise.all([loadShowcase(), ensurePlanCatalog(createServerPB())]);
  const proof = showcase[0] ?? null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(buildProductJsonLd(t, locale))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(buildFaqJsonLd(locale))} />
      <DocumentLang lang={locale} />
      <LegacyAnchorRedirect />
      {/* lang sarmalayıcısı: CSS büyük harf dönüşümü (İngilizce "i" → "I", Türkçe
          "i" → "İ") ilk boyamadan itibaren doğru dilde yapılsın. */}
      <div lang={locale} className="contents">
        <Navbar locale={locale} />
        <main>
          <Hero proof={proof} locale={locale} />
          <Platform locale={locale} />
          <ProblemSolution locale={locale} />
          <LiveMenu
            slug={proof?.slug ?? DEMO_SLUG}
            name={proof?.name ?? "Demo"}
            kind={proof?.kind ?? "demo"}
            stats={proof ? { categories: proof.categories, products: proof.products, languages: proof.languages } : null}
            locale={locale}
          />
          <FeatureGrid locale={locale} />
          <PanelShowcase locale={locale} />
          <Analytics locale={locale} />
          <HowItWorks locale={locale} />
          <Showcase items={showcase} locale={locale} />
          <Pricing locale={locale} />
          <Comparison locale={locale} />
          <FAQ locale={locale} />
          <ClosingCTA locale={locale} />
        </main>
        <Footer locale={locale} />
      </div>
      <LandingTracker />
    </>
  );
}
