import type { MetadataRoute } from "next";
import { createServerPB } from "@/lib/pocketbase";
import { ROOT_DOMAIN, menuHost } from "@/lib/site";
import { LEGAL_DOCS, legalPath } from "@/lib/legal";
import { DOC_GUIDES, RELEASE_NOTES_SLUG, docPath, docsHome } from "@/lib/docs";
import { UI_LOCALES, type UiLocale } from "@/lib/ui-locales";
import { latestRelease } from "@/lib/release-notes";
import { isSuspended } from "@/lib/business-suspension";

async function getActiveBusinessUrls(): Promise<MetadataRoute.Sitemap> {
  const pb = createServerPB();
  try {
    const businesses = await pb.collection("buyur_businesses").getFullList<{
      slug: string;
      updated: string;
      suspended_at?: string;
    }>({
      filter: 'is_active = true && slug != ""',
      fields: "slug,updated,suspended_at",
      requestKey: null,
    });

    // Her işletme için vitrin (kök) ve menü (/menu) ayrı sayfalardır.
    return businesses
      .filter((business) => !isSuspended(business))
      .flatMap((business) => [
        {
          url: `https://${menuHost(business.slug)}`,
          lastModified: business.updated,
          changeFrequency: "daily" as const,
          priority: 0.7,
        },
        {
          url: `https://${menuHost(business.slug)}/menu`,
          lastModified: business.updated,
          changeFrequency: "daily" as const,
          priority: 0.7,
        },
      ]);
  } catch {
    // PocketBase'e ulaşılamıyorsa sitemap yalnızca statik sayfalarla döner.
    return [];
  }
}

/** Yasal metinler: ödeme sağlayıcıları ve arama motorları bu adresleri bulabilsin. */
function legalUrls(): MetadataRoute.Sitemap {
  return [
    { url: `https://${ROOT_DOMAIN}/yasal`, changeFrequency: "yearly", priority: 0.3 },
    ...LEGAL_DOCS.map((doc) => ({
      url: `https://${ROOT_DOMAIN}${legalPath(doc.slug)}`,
      lastModified: new Date(doc.updated),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}

/** Yardım merkezi ve sürüm notları, her arayüz dilinde (dil eşleriyle). */
function docUrls(): MetadataRoute.Sitemap {
  const entry = (pathFor: (locale: UiLocale) => string) =>
    UI_LOCALES.map((locale) => ({
      url: `https://${ROOT_DOMAIN}${pathFor(locale)}`,
      alternates: {
        languages: Object.fromEntries(UI_LOCALES.map((option) => [option, `https://${ROOT_DOMAIN}${pathFor(option)}`])),
      },
    }));
  return [
    ...entry(docsHome).map((item) => ({ ...item, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...DOC_GUIDES.flatMap((guide) =>
      entry((locale) => docPath(guide.slug, locale)).map((item) => ({
        ...item,
        lastModified: new Date(guide.updated),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      }))
    ),
    ...entry((locale) => docPath(RELEASE_NOTES_SLUG, locale)).map((item) => ({
      ...item,
      lastModified: new Date(latestRelease().date),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businessUrls = await getActiveBusinessUrls();

  return [
    {
      url: `https://${ROOT_DOMAIN}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      // Pazarlama sitesinin dil alternatifleri (hreflang).
      alternates: { languages: { tr: `https://${ROOT_DOMAIN}`, en: `https://${ROOT_DOMAIN}/en` } },
    },
    {
      url: `https://${ROOT_DOMAIN}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: { tr: `https://${ROOT_DOMAIN}`, en: `https://${ROOT_DOMAIN}/en` } },
    },
    ...docUrls(),
    ...legalUrls(),
    ...businessUrls,
  ];
}
