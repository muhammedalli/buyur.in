import type { MetadataRoute } from "next";
import { createServerPB } from "@/lib/pocketbase";
import { ROOT_DOMAIN, menuHost } from "@/lib/site";
import { LEGAL_DOCS, legalPath } from "@/lib/legal";
import { DOC_GUIDES, RELEASE_NOTES_SLUG, docPath } from "@/lib/docs";
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

    return businesses.filter((business) => !isSuspended(business)).map((business) => ({
      url: `https://${menuHost(business.slug)}`,
      lastModified: business.updated,
      changeFrequency: "daily",
      priority: 0.7,
    }));
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

/** Yardım merkezi ve sürüm notları. */
function docUrls(): MetadataRoute.Sitemap {
  return [
    { url: `https://${ROOT_DOMAIN}/docs`, changeFrequency: "weekly", priority: 0.5 },
    ...DOC_GUIDES.map((guide) => ({
      url: `https://${ROOT_DOMAIN}${docPath(guide.slug)}`,
      lastModified: new Date(guide.updated),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    {
      url: `https://${ROOT_DOMAIN}${docPath(RELEASE_NOTES_SLUG)}`,
      lastModified: new Date(latestRelease().date),
      changeFrequency: "weekly",
      priority: 0.4,
    },
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
    },
    ...docUrls(),
    ...legalUrls(),
    ...businessUrls,
  ];
}
