import Image from "next/image";
import Link from "next/link";
import { whatsappLink } from "@/lib/site";
import { LEGAL_DOCS, legalPath } from "@/lib/legal";
import { RELEASE_NOTES_SLUG, docPath } from "@/lib/docs";
import { WhatsappIcon } from "@/components/icons";

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

const footerNav = [
  {
    title: "Ürün",
    links: [
      { label: "Neden buyur", href: "/#neden" },
      { label: "Canlı demo", href: "/#canli-menu" },
      { label: "Nasıl çalışır", href: "/#nasil" },
      { label: "Fiyatlar", href: "/#fiyat" },
    ],
  },
  {
    title: "Yardım",
    links: [
      { label: "Yardım merkezi", href: "/docs" },
      { label: "Hızlı başlangıç", href: docPath("hizli-baslangic") },
      { label: "Çoklu dil ve AI çeviri", href: docPath("coklu-dil") },
      { label: "Sürüm notları", href: docPath(RELEASE_NOTES_SLUG) },
    ],
  },
  {
    title: "Hesap",
    links: [
      { label: "Ücretsiz başla", href: "/panel/register" },
      { label: "Giriş yap", href: "/panel/login" },
      { label: "Panel", href: "/panel" },
    ],
  },
  {
    title: "İletişim",
    links: [
      { label: "merhaba@buyur.in", href: "mailto:merhaba@buyur.in" },
      {
        label: "WhatsApp destek",
        href: whatsappLink("Merhaba, buyur hakkında bilgi almak istiyorum."),
      },
    ],
  },
  {
    // Yasal metinlerin listesi lib/legal.ts'ten geliyor: yeni bir metin
    // eklendiğinde footer kendiliğinden güncellenir.
    title: "Yasal",
    links: LEGAL_DOCS.map((doc) => ({ label: doc.navLabel, href: legalPath(doc.slug) })),
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative isolate overflow-hidden bg-ink text-paper/70">
      {/* Arka plan — gece sahnesi. Sanat yönetimi <picture> ile: tarayıcı mobilde
          dikey, masaüstünde geniş kareyi indirir; ikisini birden değil. */}
      <picture>
        <source media="(min-width: 768px)" type="image/webp" srcSet="/assets/footer-desktop.webp" />
        <source media="(min-width: 768px)" srcSet="/assets/footer-desktop.jpg" />
        <source type="image/webp" srcSet="/assets/footer-mobile.webp" />
        <img
          src="/assets/footer-mobile.jpg"
          alt=""
          aria-hidden
          width={1440}
          height={601}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      </picture>

      {/* Okunabilirlik perdesi: üstte turuncu CTA'dan geçişi kapatır, ortada
          sahnenin ışığını gösterecek kadar açılır. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/95 via-ink/70 to-ink/90" />

      {/* Üst kenarda ince marka çizgisi */}
      <div className="relative h-px w-full bg-gradient-to-r from-transparent via-paprika to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 md:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm space-y-5">
            <Logo light className="h-10 sm:h-11" />
            <p className="text-sm leading-relaxed">
              Restoranlar ve kafeler için dijital QR menü platformu. Menünü bir
              kez kur, her masada güncel kalsın.
            </p>
            <a
              href={whatsappLink("Merhaba, buyur hakkında bilgi almak istiyorum.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-paper/20 px-4 py-2.5 font-mono text-[12px] uppercase tracking-wider text-paper/80 transition-colors hover:border-paprika hover:bg-paprika hover:text-paper"
            >
              <WhatsappIcon size={15} />
              Bize yazın
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {footerNav.map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <span className="font-mono text-[12px] uppercase tracking-wider text-paper">
                  {col.title}
                </span>
                {col.links.map((l) =>
                  l.href.startsWith("http") ? (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm transition-colors hover:text-paprika"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="text-sm transition-colors hover:text-paprika"
                    >
                      {l.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-paper/15 bg-ink/40 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-6 text-center font-mono text-xs text-paper/55 sm:flex-row sm:justify-between sm:text-left">
          <p>© {year} buyur · Tüm hakları saklıdır.</p>
          <p className="flex items-center gap-1.5">
            <Link href="https://www.harbidigital.com" target="_blank" rel="noopener noreferrer">
              <span className="font-semibold text-paper/70">Harbi</span>{" "}
              tarafından tasarlandı ve geliştirildi
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
