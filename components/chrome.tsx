import Link from "next/link";
import { whatsappLink } from "@/lib/site";
import { LEGAL_DOCS, legalPath } from "@/lib/legal";
import { RELEASE_NOTES_SLUG, docPath, docsHome } from "@/lib/docs";
import { sectionId } from "@/lib/landing-sections";
import { WhatsappIcon } from "@/components/icons";
import { siteTranslator } from "@/lib/ui-messages/site";
import { siteLocalePath, type Translator, type UiLocale } from "@/lib/ui-i18n";

// Logo ayrı dosyada: panel ve yönetim (istemci) Logo'yu oradan alır, footer'ın
// site kataloğu istemci paketine girmez.
export { Logo } from "@/components/logo";
import { Logo } from "@/components/logo";

/** Footer sütunları arayüz dilinde. Yasal metinler yalnızca Türkçedir; İngilizce
 *  sayfada bağlantı adının yanında bu söylenir. Yardım merkezi iki dillidir. */
function footerNav(t: Translator, locale: UiLocale) {
  const home = siteLocalePath(locale);
  const trOnly = locale === "tr" ? "" : ` (${t("Türkçe")})`;
  return [
    {
      title: t("Ürün"),
      links: [
        { label: t("Platform"), href: `${home}#${sectionId("platform", locale)}` },
        { label: t("Özellikler"), href: `${home}#${sectionId("features", locale)}` },
        { label: t("Canlı demo"), href: `${home}#${sectionId("liveMenu", locale)}` },
        { label: t("Nasıl çalışır"), href: `${home}#${sectionId("how", locale)}` },
        { label: t("Fiyatlar"), href: `${home}#${sectionId("pricing", locale)}` },
      ],
    },
    {
      title: t("Yardım"),
      links: [
        { label: t("Yardım merkezi"), href: docsHome(locale) },
        { label: t("Hızlı başlangıç"), href: docPath("hizli-baslangic", locale) },
        { label: t("Çoklu dil ve AI çeviri"), href: docPath("coklu-dil", locale) },
        { label: t("Sürüm notları"), href: docPath(RELEASE_NOTES_SLUG, locale) },
      ],
    },
    {
      title: t("Hesap"),
      links: [
        { label: t("Ücretsiz başla"), href: "/panel/register" },
        { label: t("Giriş yap"), href: "/panel/login" },
        { label: t("Panel"), href: "/panel" },
      ],
    },
    {
      title: t("İletişim"),
      links: [
        { label: "merhaba@buyur.in", href: "mailto:merhaba@buyur.in" },
        {
          label: t("WhatsApp destek"),
          href: whatsappLink(t("Merhaba, buyur hakkında bilgi almak istiyorum.")),
        },
      ],
    },
    {
      // Yasal metinlerin listesi lib/legal.ts'ten geliyor: yeni bir metin
      // eklendiğinde footer kendiliğinden güncellenir.
      title: `${t("Yasal")}${trOnly}`,
      links: LEGAL_DOCS.map((doc) => ({ label: doc.navLabel, href: legalPath(doc.slug) })),
    },
  ];
}

export function Footer({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);
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
              {t(
                "Restoranlar ve kafeler için dijital vitrin ve QR menü platformu. Menünü bir kez kur; vitrinde, sitende ve her masada güncel kalsın."
              )}
            </p>
            <a
              href={whatsappLink(t("Merhaba, buyur hakkında bilgi almak istiyorum."))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-paper/20 px-4 py-2.5 font-mono text-[12px] uppercase tracking-wider text-paper/80 transition-colors hover:border-paprika hover:bg-paprika hover:text-paper"
            >
              <WhatsappIcon size={15} />
              {t("Bize yazın")}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {footerNav(t, locale).map((col) => (
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
          <p>{t("© {year} buyur · Tüm hakları saklıdır.", { year })}</p>
          <p className="flex items-center gap-1.5">
            <Link href="https://www.harbidigital.com" target="_blank" rel="noopener noreferrer">
              {t("{brand} tarafından tasarlandı ve geliştirildi", { brand: "Harbi" })}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
