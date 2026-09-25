import { mainLocale, tField, type Locale } from "@/lib/i18n";
import type { Business, Category, Product } from "@/lib/types";
import { telHref, whatsappDigits } from "@/lib/phone";
import { publicContactEmail } from "@/lib/business-account";

// Otomatik web sitesinin içerik türetimi.
//
// Kural: web sitesi ayrı bir içerik sistemi DEĞİL, mevcut buyur verisinin
// sunum katmanıdır. Burada hiçbir yeni alan, hiçbir "site içeriği" kavramı yok;
// işletme panelde ne girdiyse site ondan üretilir. Bilgi yoksa ilgili bölüm
// gösterilmez — boş bölüm çıkmaz.

export type SectionKey =
  | "hero"
  | "about"
  | "featured"
  | "menu"
  | "gallery"
  | "info"
  | "reservation"
  | "hours"
  | "location"
  | "contact";

export interface ReservationAction {
  /** Öncelik: mevcut rezervasyon adresi → telefon → WhatsApp. Etiket render
   *  sırasında dile göre üretilir (bkz. components/site/sections.tsx). */
  kind: "url" | "phone" | "whatsapp";
  href: string;
}

export interface ContactLink {
  kind: "phone" | "email" | "whatsapp" | "instagram" | "facebook" | "tiktok" | "youtube" | "maps" | "review";
  value: string;
  href: string;
}

export interface MenuHighlightGroup {
  category: Category;
  products: Product[];
}

export interface SiteContent {
  business: Business;
  /** Hangi bölümlerin gösterileceği — veri yoksa bölüm yok. */
  sections: Record<SectionKey, boolean>;
  hero: {
    /** Başlık/tanıtım metni render sırasında content.business üzerinden
     *  tf(business, "name"|"description") ile okunur — burada tekrar
     *  saklanmıyor, tek kaynak dile göre değişebilsin diye. */
    image: string | null;
    logo: string | null;
  };
  /** Elite'te animasyonlu tipografi için kısa ifadeler — yalnızca "var mı yok
   *  mu" göstergesi (işletmenin ana dilinde); gösterilen ifadeler render
   *  sırasında seçili dile göre yeniden türetilir (bkz. Typewriter). */
  typewriter: string[];
  featured: Product[];
  groups: MenuHighlightGroup[];
  gallery: string[];
  hours: string[];
  reservation: ReservationAction | null;
  contact: ContactLink[];
  location: { address: string; mapsUrl: string | null } | null;
  highlights: Business["highlights"];
}

/** Öne çıkarılacak ürünler: önce rozetli (şefin önerisi/popüler/yeni), sonra
 *  menü sırası. Yeni bir "site ürünü" kavramı yaratmıyoruz. */
const BADGE_PRIORITY: Record<string, number> = {
  sefin_onerisi: 0,
  populer: 1,
  yeni: 2,
};

function featuredProducts(products: Product[], limit: number): Product[] {
  const scored = products
    .filter((product) => product.is_available)
    .map((product) => {
      const badgeScore = Math.min(
        ...[...(product.badges ?? []).map((badge) => BADGE_PRIORITY[badge] ?? 9), 9]
      );
      return { product, badgeScore, hasImage: (product.images?.[0] ? 0 : 1) };
    });

  return scored
    .sort((a, b) => a.badgeScore - b.badgeScore || a.hasImage - b.hasImage || a.product.order - b.product.order)
    .slice(0, limit)
    .map((entry) => entry.product);
}

function socialUrl(kind: ContactLink["kind"], handle: string): string {
  const clean = handle.trim().replace(/^@/, "");
  if (clean.startsWith("http")) return clean;
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "tiktok":
      return `https://tiktok.com/@${clean}`;
    case "youtube":
      return `https://youtube.com/${clean.startsWith("@") ? clean : `@${clean}`}`;
    default:
      return clean;
  }
}

/** Rezervasyon aksiyonu — spec'teki öncelik sırası. Hiçbiri yoksa CTA çıkmaz
 *  (kırık buton göstermiyoruz). */
function reservationAction(business: Business): ReservationAction | null {
  if (business.whatsapp) {
    return {
      kind: "whatsapp",
      href: `https://wa.me/${whatsappDigits(business.whatsapp)}?text=${encodeURIComponent(
        `Merhaba, ${business.name} için rezervasyon yaptırmak istiyorum.`
      )}`,
    };
  }
  if (business.phone) {
    return { kind: "phone", href: telHref(business.phone) };
  }
  return null;
}

function contactLinks(business: Business): ContactLink[] {
  const links: ContactLink[] = [];

  if (business.phone) {
    links.push({ kind: "phone", value: business.phone, href: telHref(business.phone) });
  }
  if (business.whatsapp) {
    links.push({
      kind: "whatsapp",
      value: business.whatsapp,
      href: `https://wa.me/${whatsappDigits(business.whatsapp)}`,
    });
  }
  const email = publicContactEmail(business);
  if (email) {
    links.push({ kind: "email", value: email, href: `mailto:${email}` });
  }
  if (business.instagram) {
    links.push({ kind: "instagram", value: business.instagram, href: socialUrl("instagram", business.instagram) });
  }
  if (business.facebook) {
    links.push({ kind: "facebook", value: business.facebook, href: socialUrl("facebook", business.facebook) });
  }
  if (business.tiktok) {
    links.push({ kind: "tiktok", value: business.tiktok, href: socialUrl("tiktok", business.tiktok) });
  }
  if (business.youtube) {
    links.push({ kind: "youtube", value: business.youtube, href: socialUrl("youtube", business.youtube) });
  }
  if (business.google_review_url) {
    links.push({ kind: "review", value: "Google", href: business.google_review_url });
  }

  return links;
}

/** Çalışma saatleri serbest metin; satırlara bölüp gösteriyoruz. */
function hourLines(business: Business): string[] {
  return business.working_hours
    .split(/\r?\n|·|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Elite'in animasyonlu başlığı için kısa ifadeler — uydurma metin yok,
 *  yalnızca işletmenin kendi verisinden türetiliyor. Seçili dile göre
 *  yeniden çağrılabilir (bkz. components/site/elite-parts.tsx Typewriter). */
export function typewriterPhrases(
  business: Business,
  groups: MenuHighlightGroup[],
  locale: Locale,
  baseLocale: Locale = locale
): string[] {
  const phrases: string[] = [];
  const description = tField(business, "description", locale, baseLocale).trim();

  if (description) {
    const firstSentence = description.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 80) phrases.push(firstSentence);
  }
  for (const group of groups.slice(0, 3)) phrases.push(tField(group.category, "name", locale, baseLocale));
  if (business.address) {
    const city = business.address.split(",").pop()?.trim();
    if (city && city.length <= 40) phrases.push(city);
  }

  return Array.from(new Set(phrases)).slice(0, 4);
}

export interface SiteContentInput {
  business: Business;
  categories: Category[];
  products: Product[];
  /** Elite daha zengin: daha çok ürün, galeri, slider. */
  rich: boolean;
}

export function buildSiteContent({ business, categories, products, rich }: SiteContentInput): SiteContent {
  const available = products.filter((product) => product.is_available);

  const groups: MenuHighlightGroup[] = categories
    .filter((category) => category.is_active)
    .map((category) => ({
      category,
      products: available.filter((product) => product.category === category.id).slice(0, rich ? 6 : 4),
    }))
    .filter((group) => group.products.length > 0);

  const featured = featuredProducts(available, rich ? 8 : 4);
  const gallery = rich
    ? Array.from(new Set(available.flatMap((product) => product.images ?? []).filter(Boolean))).slice(0, 12)
    : [];

  const hours = hourLines(business);
  const reservation = reservationAction(business);
  const contact = contactLinks(business);
  const heroImage = business.cover_url || featured.find((product) => product.images?.[0])?.images?.[0] || null;

  return {
    business,
    hero: {
      image: heroImage,
      logo: business.logo_url || null,
    },
    // Gösterge amaçlı: yalnızca "en az bir ifade üretilebiliyor mu" — işletmenin
    // ana dilinde hesaplanır, gerçek gösterim seçili dile göre yeniden türetilir.
    typewriter: rich ? typewriterPhrases(business, groups, mainLocale(business)) : [],
    featured,
    groups,
    gallery,
    hours,
    reservation,
    contact,
    location: business.address ? { address: business.address, mapsUrl: business.google_maps_url || null } : null,
    highlights: business.highlights ?? [],
    sections: {
      hero: true,
      about: Boolean(business.description?.trim()),
      featured: featured.length > 0,
      menu: groups.length > 0,
      gallery: gallery.length >= 3,
      info: (business.highlights ?? []).length > 0,
      reservation: reservation !== null,
      hours: hours.length > 0,
      location: Boolean(business.address),
      contact: contact.length > 0,
    },
  };
}
