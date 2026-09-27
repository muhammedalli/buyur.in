import { ROOT_DOMAIN, whatsappLink } from "@/lib/site";
import { msg } from "@/lib/ui-i18n";

/**
 * Site genelinde tek doğru kaynak: adres, marka metinleri, paylaşım görseli ve
 * yapılandırılmış veri (JSON-LD). Sayfalar kendi başlıklarını buradan türetir;
 * böylece bir metin değiştiğinde OG, Twitter ve schema.org birlikte güncellenir.
 */

export const SITE_URL = `https://${ROOT_DOMAIN}`;
export const SITE_NAME = "buyur";
export const SITE_EMAIL = "merhaba@buyur.in";

/** 51 karakter — arama sonucunda kırpılmadan görünür. */
export const SITE_TITLE = msg("buyur — Restoran ve Kafeler için Dijital QR Menü");

/** ~155 karakter: masaüstü ve mobil snippet sınırının içinde kalır. */
export const SITE_DESCRIPTION = msg(
  "Restoran, kafe, pastane ve oteller için QR menü. Menünüzü 5 dakikada kurun, fiyatları anında güncelleyin, ne satıldığını analizlerden görün. Ücretsiz başlayın."
);

/** Sosyal kartlarda başlık zaten göründüğü için burada vaadi tekrarlamıyoruz. */
export const SHARE_DESCRIPTION = msg("Menünü bir kez kur, her masada güncel kalsın. Kredi kartı yok, 5 dakikada kurulum.");

export const SITE_KEYWORDS = [
  "qr menü",
  "dijital menü",
  "karekod menü",
  "restoran menüsü",
  "kafe menüsü",
  "online menü",
  "temassız menü",
  "qr kod menü oluşturma",
  "dijital menü programı",
  "restoran yönetim yazılımı",
  "menü analizi",
];

/** OG/Twitter görseli — 1200x630, public/assets/og.jpg (kaynak: BUYUR_image). */
export const OG_IMAGE = {
  url: "/assets/og.jpg",
  width: 1200,
  height: 630,
  alt: msg("buyur — masada QR menü: telefonda açılmış dijital menü ve masa üstü QR standı"),
} as const;

/** Kurum logosu: schema.org ve arama sonucu için kare marka ikonu. */
export const BRAND_ICON = `${SITE_URL}/icon-512.png`;

/** Sayfaların kendi görseli yoksa markalı paylaşım görseline düşer. */
export function shareImages(url?: string | null) {
  return url ? [url] : [OG_IMAGE];
}

export function absoluteUrl(path = "/"): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Organization + WebSite: her sayfada bir kez basılır. Google marka panelini
 * (knowledge panel) ve site adını bu iki düğümden okur.
 */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: "buyur.in",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: BRAND_ICON,
          width: 512,
          height: 512,
        },
        image: absoluteUrl(OG_IMAGE.url),
        description: SITE_DESCRIPTION,
        email: SITE_EMAIL,
        areaServed: { "@type": "Country", name: "Türkiye" },
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: SITE_EMAIL,
            url: whatsappLink("Merhaba, buyur hakkında bilgi almak istiyorum."),
            availableLanguage: ["tr"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "tr-TR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}

/** Blog yazısı ve yasal metinlerde kırıntı navigasyonu. */
export function breadcrumbJsonLd(
  trail: { name: string; path: string }[],
  home: { name: string; path: string } = { name: "Ana sayfa", path: "/" }
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [home, ...trail].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** JSON-LD'yi tek satırda, XSS'e kapalı biçimde basar. */
export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
