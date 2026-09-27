import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createServerPB } from "@/lib/pocketbase";
import { isSubscriptionActive } from "@/lib/entitlements";
import { isSuspended } from "@/lib/business-suspension";
import { ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { buildSiteContent } from "@/lib/site-content";
import { brandStyle } from "@/lib/brand-style";
import { menuUrl } from "@/lib/site";
import { shareImages } from "@/lib/seo";
import { hasActiveWebsite, menuPageUrl } from "@/lib/storefront";
import { localeTags, mainLocale } from "@/lib/i18n";
import { MenuUnavailable } from "@/app/[slug]/unavailable";
import {
  ProductCards,
  SiteAbout,
  SiteContact,
  SiteFooter,
  SiteHero,
  SiteLocation,
  SiteMenuList,
  SiteReservationCta,
  SiteSection,
} from "@/components/site/sections";
import { MenuSlider } from "@/components/site/elite-parts";
import { SiteHeader, SiteMarquee } from "@/components/site/site-chrome";
import { SiteLocaleProvider } from "@/components/site/site-locale";
import { BusinessWelcome } from "@/components/site/business-welcome";
import type { Business, Category, Product } from "@/lib/types";

// İşletmenin VİTRİNİ: isletme.buyur.in kökü (middleware /site/{slug}'a yazar;
// eski isletme.buyur.in/site bağlantıları da buraya gelir).
//
//   · Web sitesi yayındaysa (Elite + sahibi kapatmamış, lib/storefront.ts) →
//     otomatik restoran sitesi. İçerik tamamen mevcut buyur verisinden türetilir
//     (lib/site-content.ts); site kurucu ya da ikinci bir ürün yönetimi yoktur.
//   · Değilse → işletme bilgilerinden otomatik karşılama sayfası; ana eylem
//     "Menüyü gör" (components/site/business-welcome.tsx).
//
// Menü /menu adresindedir; masadaki QR taraması vitrine uğramaz. Sunucuda render
// edilir ve dakikada bir tazelenir (menüyle aynı hız bütçesi).

export const revalidate = 60;

const getBusiness = cache(async (slug: string): Promise<Business | null> => {
  const pb = createServerPB();
  try {
    const [business] = await Promise.all([
      pb
        .collection("buyur_businesses")
        .getFirstListItem<Business>(pb.filter("slug = {:slug} && is_active = true", { slug }), { requestKey: null }),
      ensurePlanCatalog(pb),
    ]);
    return business;
  } catch {
    return null;
  }
});

const getMenu = cache(async (businessId: string) => {
  const pb = createServerPB();
  const [categories, products] = await Promise.all([
    pb.collection("buyur_categories").getFullList<Category>({
      filter: pb.filter("business = {:id} && is_active = true", { id: businessId }),
      sort: "order,created",
      requestKey: null,
    }),
    pb.collection("buyur_products").getFullList<Product>({
      filter: pb.filter("business = {:id} && is_available = true", { id: businessId }),
      sort: "order,created",
      requestKey: null,
    }),
  ]);
  return { categories, products };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business || isSuspended(business)) return {};

  const description =
    business.description || `${business.name} — menü, çalışma saatleri, konum ve iletişim bilgileri.`;
  const images = shareImages(business.cover_url);
  const url = menuUrl(business.slug);
  const ogLocale = localeTags[mainLocale(business)].replace("-", "_");

  return {
    // İşletmenin kendi vitrini: platform adı başlığa eklenmez.
    title: { absolute: business.name },
    description,
    openGraph: {
      title: business.name,
      description,
      url,
      siteName: business.name,
      locale: ogLocale,
      images,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: business.name, description, images },
    alternates: { canonical: url },
    icons: business.logo_url ? { icon: business.logo_url } : undefined,
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusiness(slug);
  if (!business) notFound();

  // Menü yayında değilse (Freemium limiti doldu / yönetim askıya aldı) vitrin de
  // menüyle aynı sade ekranı gösterir; veri silinmez.
  if (isSuspended(business) || !isSubscriptionActive(business)) {
    return <MenuUnavailable business={business} />;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: business.name,
    description: business.description || undefined,
    image: business.cover_url || business.logo_url || undefined,
    telephone: business.phone || undefined,
    address: business.address || undefined,
    url: menuUrl(business.slug),
    openingHours: business.working_hours || undefined,
    hasMenu: menuPageUrl(business.slug),
  };

  if (!hasActiveWebsite(business)) {
    return (
      <SiteLocaleProvider business={business}>
        <div style={brandStyle(business, { surface: true })}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <BusinessWelcome business={business} />
        </div>
      </SiteLocaleProvider>
    );
  }

  // Web sitesi yalnızca Elite'te var ve tek bir deneyim sunuyor (animasyon, slider, galeri).
  const rich = true;
  const { categories, products } = await getMenu(business.id);
  const content = buildSiteContent({ business, categories, products, rich });
  const { sections } = content;

  return (
    <SiteLocaleProvider business={business}>
      <div style={brandStyle(business)} className="min-h-dvh bg-paper text-ink">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <SiteHeader business={business} />
        <SiteHero content={content} rich={rich} />
        <SiteMarquee business={business} />

        <SiteAbout content={content} />

        {sections.featured && (
          <SiteSection titleKey="siteFeatured" subtitleKey="siteFeaturedSubtitle" tone="crema">
            <ProductCards products={content.featured} columns={rich ? 4 : 2} />
          </SiteSection>
        )}

        {sections.menu &&
          (rich ? (
            <SiteSection titleKey="siteMenuTitle" subtitleKey="siteMenuSubtitle">
              <MenuSlider groups={content.groups} slug={business.slug} />
            </SiteSection>
          ) : (
            <SiteSection titleKey="siteMenuTitle">
              <SiteMenuList groups={content.groups} />
            </SiteSection>
          ))}

        {rich && sections.gallery && (
          <SiteSection titleKey="siteGallery" tone="crema">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {content.gallery.map((image, index) => (
                <div
                  key={image}
                  data-reveal
                  style={{ transitionDelay: `${Math.min(index, 8) * 60}ms` }}
                  className="aspect-square overflow-hidden rounded-2xl bg-crema"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </SiteSection>
        )}

        {sections.reservation && (
          <section className="bg-ink text-paper">
            <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
              <SiteReservationCta content={content} />
            </div>
          </section>
        )}

        {sections.location && (
          <SiteSection titleKey="locationLabel">
            <SiteLocation content={content} />
          </SiteSection>
        )}

        {sections.contact && (
          <SiteSection titleKey="siteContact" tone="crema">
            <SiteContact content={content} />
          </SiteSection>
        )}

        <SiteFooter content={content} />
      </div>
    </SiteLocaleProvider>
  );
}
