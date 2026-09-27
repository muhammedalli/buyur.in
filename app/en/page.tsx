import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { OG_IMAGE, SHARE_DESCRIPTION, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import { siteTranslator } from "@/lib/ui-messages/site";

// Pazarlama sitesinin İngilizce ana sayfası (buyur.in/en). Türkçesiyle aynı
// bileşen; metinler lib/ui-messages/en kataloglarından.
export const revalidate = 60;

const t = siteTranslator("en");

export const metadata: Metadata = {
  title: { absolute: t(SITE_TITLE) },
  description: t(SITE_DESCRIPTION),
  alternates: {
    canonical: "/en",
    languages: { tr: "/", en: "/en", "x-default": "/" },
  },
  openGraph: {
    title: t(SITE_TITLE),
    description: t(SHARE_DESCRIPTION),
    url: `${SITE_URL}/en`,
    siteName: SITE_NAME,
    locale: "en_US",
    alternateLocale: ["tr_TR"],
    type: "website",
    images: [{ ...OG_IMAGE, alt: t(OG_IMAGE.alt) }],
  },
  twitter: {
    card: "summary_large_image",
    title: t(SITE_TITLE),
    description: t(SHARE_DESCRIPTION),
    images: [OG_IMAGE],
  },
};

export default function EnglishHome() {
  return <LandingPage locale="en" />;
}
