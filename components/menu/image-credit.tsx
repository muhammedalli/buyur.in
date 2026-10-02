import Link from "next/link";
import { t as translate, type Locale } from "@/lib/i18n";
import { needsImageCredit, PROVIDER_LABELS } from "@/lib/ai/image-source";
import type { Product } from "@/lib/types";
import { hasProductImage, productImageUrl } from "@/lib/files";

// Görsel künyesi. CC BY / CC BY-SA lisansları, eserin GÖSTERİLDİĞİ yerde
// fotoğrafçının ve lisansın belirtilmesini şart koşar. Bu yüzden künye iki
// yerde birden çıkar: ürün detayında görselin altında ve menüdeki toplu
// "Görsel kaynakları" sayfasında.
//
// Künye gerektirmeyen lisanslarda (CC0, kamu malı, Unsplash/Pexels/Pixabay)
// hiçbir şey basılmaz — gereksiz gürültü tasarımı bozar.

/** Künyesi zorunlu olan görsele sahip ürünler. */
export function productsNeedingCredit(products: Product[]): Product[] {
  return products.filter((product) => hasProductImage(product) && needsImageCredit(product.image_source));
}

function ProviderLink({ source }: { source: NonNullable<Product["image_source"]> }) {
  const label = PROVIDER_LABELS[source.provider] ?? source.provider;
  return source.source_url ? (
    <a href={source.source_url} target="_blank" rel="noreferrer noopener nofollow" className="underline">
      {label}
    </a>
  ) : (
    <>{label}</>
  );
}

function LicenseLink({ source }: { source: NonNullable<Product["image_source"]> }) {
  return source.license_url ? (
    <a href={source.license_url} target="_blank" rel="noreferrer noopener nofollow" className="underline">
      {source.license_name}
    </a>
  ) : (
    <>{source.license_name}</>
  );
}

/** Ürün detayında görselin altındaki tek satırlık künye. */
export function ImageCredit({ product, locale }: { product: Product; locale: Locale }) {
  const source = product.image_source;
  if (!needsImageCredit(source)) return null;

  return (
    <p className="px-5 pt-2 font-mono text-[10px] leading-relaxed text-ink-soft/70">
      {source.author_name && <>{translate(locale, "photoBy", { author: source.author_name })} · </>}
      <ProviderLink source={source} /> · <LicenseLink source={source} />
    </p>
  );
}

/** Menü altbilgisindeki künye sayfası bağlantısı — künye gerektiren görsel
 *  yoksa hiç basılmaz. */
export function ImageCreditsLink({
  products,
  base,
  locale,
}: {
  products: Product[];
  base: string;
  locale: Locale;
}) {
  if (productsNeedingCredit(products).length === 0) return null;

  return (
    <Link
      href={`${base}/sources`}
      className="font-mono text-[10px] uppercase tracking-wider text-ink-soft/60 underline-offset-2 transition-colors hover:text-ink-soft hover:underline"
    >
      {translate(locale, "imageCreditsTitle")}
    </Link>
  );
}

/** Tüm künyelerin toplu listesi — künye sayfasında ve otomatik sitenin
 *  altbilgisinde kullanılır. */
export function ImageCreditList({ products, locale }: { products: Product[]; locale: Locale }) {
  const credited = productsNeedingCredit(products);
  if (credited.length === 0) {
    return <p className="text-sm text-ink-soft">{translate(locale, "imageCreditsEmpty")}</p>;
  }

  return (
    <ul className="space-y-3">
      {credited.map((product) => {
        const source = product.image_source as NonNullable<Product["image_source"]>;
        return (
          <li key={product.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl(product, "card")}
              alt=""
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">{product.name}</p>
              <p className="font-mono text-[11px] leading-relaxed text-ink-soft">
                {source.author_name && <>{translate(locale, "photoBy", { author: source.author_name })} · </>}
                <ProviderLink source={source} /> · <LicenseLink source={source} />
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
