import { createServerPB } from "@/lib/pocketbase";
import { activeLocales } from "@/lib/i18n";
import type { Business } from "@/lib/types";
import { isSuspended } from "@/lib/business-suspension";

// Landing'deki sosyal kanıt katmanı. Kural: yalnızca doğrulanabilir bilgi.
//   · Kart verisi (ad, logo, kategori/ürün/dil sayısı) canlı menüden okunur.
//   · Yorum (quote) YALNIZCA işletmenin onayladığı gerçek bir cümleyse yazılır;
//     yoksa kart yorumsuz gösterilir. Uydurma yorum/rakam eklenmez.
//   · kind: "demo" olan kart sitede "Demo menü" diye etiketlenir. Gerçek bir
//     müşteri, menüsünün burada görünmesine onay verdiğinde "customer" yapılır.

export type ShowcaseKind = "customer" | "demo";

export interface ShowcaseEntry {
  slug: string;
  kind: ShowcaseKind;
  city?: string;
  /** Menüde kullanılan özellikler — kısa, gerçek. */
  highlight: string;
  quote?: { text: string; author: string };
}

/** Hero'daki "Canlı örneği incele" bu menüye gider. */
export const DEMO_SLUG = "vezirhan";

export const SHOWCASE: ShowcaseEntry[] = [
  {
    slug: DEMO_SLUG,
    kind: "demo",
    city: "İstanbul",
    highlight: "Çok dilli menü · kampanya pop-up'ı · alerjen ve kalori bilgisi · sepet",
  },
];

export interface ShowcaseItem extends ShowcaseEntry {
  name: string;
  logoUrl: string;
  categories: number;
  products: number;
  languages: number;
}

async function loadEntry(entry: ShowcaseEntry): Promise<ShowcaseItem | null> {
  const pb = createServerPB();
  try {
    const business = await pb
      .collection("buyur_businesses")
      .getFirstListItem<Business>(pb.filter("slug = {:slug} && is_active = true", { slug: entry.slug }), {
        requestKey: null,
      });
    if (isSuspended(business)) return null;
    const [categories, products] = await Promise.all([
      pb.collection("buyur_categories").getList(1, 1, {
        filter: pb.filter("business = {:id} && is_active = true", { id: business.id }),
        fields: "id",
        requestKey: null,
      }),
      pb.collection("buyur_products").getList(1, 1, {
        filter: pb.filter("business = {:id} && is_available = true", { id: business.id }),
        fields: "id",
        requestKey: null,
      }),
    ]);
    return {
      ...entry,
      name: business.name,
      logoUrl: business.logo_url,
      categories: categories.totalItems,
      products: products.totalItems,
      languages: activeLocales(business).length,
    };
  } catch {
    // Menü kapandıysa ya da PocketBase'e ulaşılamıyorsa kart hiç gösterilmez —
    // kırık bir kanıt kartı hiç olmamasından kötü.
    return null;
  }
}

export async function loadShowcase(): Promise<ShowcaseItem[]> {
  const items = await Promise.all(SHOWCASE.map(loadEntry));
  return items.filter((item): item is ShowcaseItem => item !== null);
}
