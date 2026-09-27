import Image from "next/image";

/**
 * Marka kelime logosu. Kaynak dosyalar kare tuvalde bol boşlukla geldiği için
 * scripts/build-brand-assets.mjs bunları kırpıp public/assets/ altına yazar.
 *
 * `light` koyu zeminler (footer, panel girişi) içindir.
 */
export function Logo({
  light = false,
  className = "h-8 sm:h-9",
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={light ? "/assets/wordmark-light.png" : "/assets/wordmark-dark.png"}
      alt="buyur"
      width={468}
      height={200}
      priority={!light}
      className={`w-auto ${className}`}
    />
  );
}
