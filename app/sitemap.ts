import type { MetadataRoute } from "next";
import { createServerPB } from "@/lib/pocketbase";
import { ROOT_DOMAIN, menuHost } from "@/lib/site";
import { LEGAL_DOCS, legalPath } from "@/lib/legal";
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businessUrls = await getActiveBusinessUrls();

  return [
    {
      url: `https://${ROOT_DOMAIN}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...legalUrls(),
    ...businessUrls,
  ];
}
