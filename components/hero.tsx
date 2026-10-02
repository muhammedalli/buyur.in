import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, GlobeIcon, LayoutIcon, TrendingUpIcon } from "@/components/icons";
import { Marquee } from "@/components/marquee";
import { DEMO_SLUG, type ShowcaseItem } from "@/lib/showcase";
import { menuHost } from "@/lib/site";
import { siteTranslator } from "@/lib/ui-messages/site";
import { msg, type UiLocale } from "@/lib/ui-i18n";

// Demo bağlantısı menüyü açar (vitrin kökü değil): ziyaretçi "canlı menü" görmek
// için tıklıyor. Landing'den açılan demo ziyaretleri demo işletmenin analizinde
// kampanya kaynağı olarak ayrışır.
const DEMO_LINK_URL = `https://${menuHost(DEMO_SLUG)}/menu?utm_source=buyur&utm_medium=landing&utm_campaign=hero_cta`;

// Sağdaki görsel giriş/kayıt ekranlarıyla aynıdır (onaylı marka görseli) ve
// kendi başlığını taşır ("Menünü güncel tut."); üstüne metin yazılmaz.
const HERO_IMAGE_ALT = msg("Menünü güncel tut. Fiyat değiştir, ürünleri öne çıkar, her masada anında güncellensin.");

// Hero altında sonsuz kayan şerit — yalnızca ürünün bugün yaptığı işler.
const marqueeItems = [
  msg("Baskı maliyeti yok"),
  msg("Anlık fiyat güncelleme"),
  msg("Otomatik karşılama sayfası"),
  msg("QR kod hazır"),
  msg("Uygulama indirme yok"),
  msg("Kalori & alerjen bilgisi"),
  msg("TR · EN · DE · AR · FR · ES · IT · RU menü"),
  msg("Kayan duyuru şeridi"),
  msg("Sepet → garsona göster"),
  msg("Ürün ve QR analizi"),
];

/** Uydurma sayı yerine doğrulanabilir kanıt: canlı menüye tek tık. Kart
 *  verisi (kategori/ürün/dil sayısı) o menünün kendisinden okunuyor. */
function ProofLink({ proof, locale }: { proof: ShowcaseItem | null; locale: UiLocale }) {
  const t = siteTranslator(locale);
  const label = proof?.kind === "customer" ? t("Canlı müşteri menüsü") : t("Canlı demo menü");
  const hasCounts = proof !== null && proof.products > 0;

  return (
    <a
      href={DEMO_LINK_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-track="live_demo_open"
      data-track-location="hero_proof"
      className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-paper/80 p-3 pr-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-paprika hover:shadow-[0_18px_40px_-26px_rgba(35,24,18,0.6)] sm:w-fit"
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-crema font-display text-lg font-extrabold text-paprika">
        {proof?.logoUrl ? (
          <picture>
            <img src={proof.logoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </picture>
        ) : (
          (proof?.name ?? "M").charAt(0)
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-wider text-herb">● {label}</span>
        <span className="block font-display text-base font-bold leading-tight">
          {proof?.kind === "customer" ? t("{name} menüsünü incele", { name: proof.name }) : t("Örnek menüyü incele")}
        </span>
        {hasCounts && (
          <span className="block text-xs text-ink-soft">
            {t("{categories} kategori · {products} ürün · {languages} dil", {
              categories: proof.categories,
              products: proof.products,
              languages: proof.languages,
            })}
          </span>
        )}
      </span>
      <ArrowLeftIcon
        size={16}
        className="ml-auto shrink-0 rotate-180 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-paprika"
      />
    </a>
  );
}

export function Hero({ proof, locale = "tr" }: { proof: ShowcaseItem | null; locale?: UiLocale }) {
  const t = siteTranslator(locale);

  // Başlığın hemen altındaki üç satır: uzun özellik listesi değil, buyur'u
  // "yalnızca QR menü" olmaktan çıkaran üç iş. Mobilde de okunur (satır düzeni).
  const heroPoints = [
    {
      icon: LayoutIcon,
      title: t("Vitrin, web sitesi ve menü tek adreste"),
      desc: t("isletmeniz.buyur.in: siteniz ya da otomatik karşılama sayfanız; menü bir dokunuş uzakta."),
    },
    {
      icon: GlobeIcon,
      title: t("Sekiz dil, tek menü"),
      desc: t("TR · EN · DE · AR · FR · ES · IT · RU — turist masasında çeviri derdi yok."),
    },
    {
      icon: TrendingUpIcon,
      title: t("Neyin okunduğunu gör"),
      desc: t("Hangi ürün açılıyor, hangi QR taranıyor — ölçülür."),
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        {/* Arka plan: sıcak ışık lekeleri + ince ızgara */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="blob-drift absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-paprika/[0.13] blur-3xl" />
          <div
            className="blob-drift absolute -right-32 top-32 h-[30rem] w-[30rem] rounded-full bg-herb/[0.10] blur-3xl"
            style={{ animationDelay: "-6s" }}
          />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",
            }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:pb-24 md:pt-16">
          <div>
            <h1 className="rise rise-2 mt-5 font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.25rem] md:text-[3.75rem]">
              {t("Restoranınızın")}{" "}
              <span className="relative inline-block text-paprika">
                {t("dijital vitrini")}
                <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 12" fill="none" aria-hidden>
                  <path
                    className="stroke-draw"
                    d="M3 9C60 3 140 3 197 7"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              {t("tek adreste.")}
            </h1>

            <p className="rise rise-3 mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              {t(
                "QR menünüz, işletme sayfanız ve web siteniz isletmeniz.buyur.in adresinde birlikte yayında. Fiyatı panelden değiştirin; menü, vitrin ve her masadaki QR anında güncellensin."
              )}
            </p>

            {/* Üç iş — masaüstünde başlığın altında sıra, mobilde de okunur kalır */}
            <ul className="rise rise-4 mt-7 space-y-3 border-l-2 border-line pl-4">
              {heroPoints.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-lg bg-paprika/10 p-1.5 text-paprika">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold leading-tight">{title}</span>
                    <span className="block text-[13px] leading-snug text-ink-soft">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="rise rise-5 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/panel/register"
                data-track="cta_click"
                data-track-location="hero"
                data-track-cta="create_free"
                className="cta-nudge shine-on-hover relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-md bg-paprika px-8 py-4 text-center font-mono text-sm uppercase tracking-wider text-paper transition-all duration-300 hover:-translate-y-0.5 hover:bg-paprika-deep hover:shadow-[0_16px_34px_-12px_rgba(232,73,31,0.85)]"
              >
                {t("Ücretsiz menünü oluştur")}
                <ArrowRightIcon size={16} className="cta-arrow" />
              </Link>
              <a
                href={DEMO_LINK_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-track="live_demo_open"
                data-track-location="hero"
                className="rounded-md border border-ink/20 px-8 py-4 text-center font-mono text-sm uppercase tracking-wider text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-paper"
              >
                {t("Canlı örneği incele")}
              </a>
            </div>

            <p className="rise rise-5 mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-soft/80">
              {t("Kredi kartı yok · 5 dakikada kurulum · İstediğin an bırak")}
            </p>

            <div className="rise rise-6 mt-8">
              <ProofLink proof={proof} locale={locale} />
            </div>
          </div>

          {/* Sağ: marka görseli. Oranı korunur (kırpılmaz, esnetilmez); mobilde
              metnin altında aynı genişlikte durur. Sayfanın ilk büyük görseli
              olduğu için öncelikli yüklenir. */}
          <div className="rise rise-4">
            <Image
              src="/assets/auth_bg.png"
              alt={t(HERO_IMAGE_ALT)}
              width={1382}
              height={1304}
              priority
              quality={85}
              sizes="(min-width: 1152px) 520px, (min-width: 768px) 46vw, 100vw"
              className="hero-float mx-auto h-auto w-full max-w-md rounded-3xl bg-ink shadow-[0_34px_70px_-30px_rgba(35,24,18,0.45)] md:max-w-none"
            />
          </div>
        </div>
      </section>

      {/* Kayan değer şeridi — koyu bant, sayfanın ritmini kırar */}
      <Marquee items={marqueeItems.map((item) => t(item))} tone="ink" label={t("BUYUR ile gelenler")} className="py-3.5" />
    </>
  );
}
