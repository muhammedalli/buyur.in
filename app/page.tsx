import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

// Pazarlama sitesinin Türkçe ana sayfası. İngilizcesi: app/en/page.tsx.
// Sosyal kanıt kartları ve plan/fiyat bilgisi canlı kayıtlardan okunuyor;
// sayfa statik üretilip dakikada bir tazelenir.
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { tr: "/", en: "/en", "x-default": "/" },
  },
};

export default function Home() {
  return <LandingPage locale="tr" />;
}
