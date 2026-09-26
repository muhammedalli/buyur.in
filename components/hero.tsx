import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, GlobeIcon, TagIcon, TrendingUpIcon } from "@/components/icons";
import { DEMO_SLUG, type ShowcaseItem } from "@/lib/showcase";
import { menuHost } from "@/lib/site";

const DEMO_URL = `https://${menuHost(DEMO_SLUG)}`;
// Landing'den açılan demo ziyaretleri, demo işletmenin analizinde kampanya
// kaynağı olarak ayrışsın.
const DEMO_LINK_URL = `${DEMO_URL}/?utm_source=buyur&utm_medium=landing&utm_campaign=hero_cta`;

// Sağdaki görsel giriş/kayıt ekranlarıyla aynıdır (onaylı marka görseli) ve
// kendi başlığını taşır ("Menünü güncel tut."); üstüne metin yazılmaz.
const HERO_IMAGE_ALT = "Menünü güncel tut. Fiyat değiştir, ürünleri öne çıkar, her masada anında güncellensin.";

// Hero altında sonsuz kayan şerit — yalnızca ürünün bugün yaptığı işler.
const marqueeItems = [
  "Baskı maliyeti yok",
  "Anlık fiyat güncelleme",
  "QR kod hazır",
  "Uygulama indirme yok",
  "Kalori & alerjen bilgisi",
  "TR · EN · AR · RU menü",
  "Sepet → garsona göster",
  "Ürün ve QR analizi",
];

// Başlığın hemen altındaki üç satır: uzun özellik listesi değil, kararı
// etkileyen üç iş. İkonlar mobilde de görünür (kart yerine satır düzeni).
const heroPoints = [
  { icon: TagIcon, title: "Fiyatı panelden değiştir", desc: "Tüm masalarda saniyeler içinde günceldir." },
  { icon: GlobeIcon, title: "Dört dilde aynı menü", desc: "TR · EN · AR · RU — turist masasında çeviri derdi yok." },
  { icon: TrendingUpIcon, title: "Neyin okunduğunu gör", desc: "Hangi ürün açılıyor, hangi QR taranıyor — ölçülür." },
];

/** Uydurma sayı yerine doğrulanabilir kanıt: canlı menüye tek tık. Kart
 *  verisi (kategori/ürün/dil sayısı) o menünün kendisinden okunuyor. */
function ProofLink({ proof }: { proof: ShowcaseItem | null }) {
  const label = proof?.kind === "customer" ? "Canlı müşteri menüsü" : "Canlı demo menü";
  const hasCounts = proof !== null && proof.products > 0;

  return (
    <a
      href={DEMO_LINK_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-track="live_demo_open"
      data-track-location="hero_proof"
      className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-paper/80 p-3 pr-5 backdrop-blur transition-colors hover:border-paprika sm:w-fit"
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
          {proof?.kind === "customer" ? `${proof.name} menüsünü incele` : "Örnek menüyü incele"}
        </span>
        {hasCounts && (
          <span className="block text-xs text-ink-soft">
            {proof.categories} kategori · {proof.products} ürün · {proof.languages} dil
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

export function Hero({ proof }: { proof: ShowcaseItem | null }) {
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
            <span className="rise rise-1 inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 py-1.5 pl-2.5 pr-3.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft backdrop-blur">
              <span className="relative flex h-1.5 w-1.5 text-herb">
                <span className="pulse-ring absolute inset-0 rounded-full" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-herb" />
              </span>
              QR menü · restoran &amp; kafe
            </span>

            <h1 className="rise rise-2 mt-5 font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight sm:text-[3.25rem] md:text-[3.75rem]">
              Menünüzü{" "}
              <span className="relative inline-block text-paprika">
                güncel
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
              tutun, müşterinin seçimini kolaylaştırın.
            </h1>

            <p className="rise rise-3 mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              buyur ile QR menünüzü dakikalar içinde kurun; fiyatları anında değiştirin, ürünleri öne çıkarın ve
              müşterinin seçimlerini garsona eksiksiz göstermesini sağlayın.
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
                className="shine-on-hover relative overflow-hidden rounded-md bg-paprika px-8 py-4 text-center font-mono text-sm uppercase tracking-wider text-paper transition-all duration-300 hover:-translate-y-0.5 hover:bg-paprika-deep hover:shadow-[0_16px_34px_-12px_rgba(232,73,31,0.85)]"
              >
                Ücretsiz menünü oluştur
              </Link>
              <a
                href={DEMO_LINK_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-track="live_demo_open"
                data-track-location="hero"
                className="rounded-md border border-ink/20 px-8 py-4 text-center font-mono text-sm uppercase tracking-wider text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-paper"
              >
                Canlı örneği incele
              </a>
            </div>

            <p className="rise rise-5 mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-soft/80">
              Kredi kartı yok · 5 dakikada kurulum · İstediğin an bırak
            </p>

            <div className="rise rise-6 mt-8">
              <ProofLink proof={proof} />
            </div>
          </div>

          {/* Sağ: marka görseli. Oranı korunur (kırpılmaz, esnetilmez); mobilde
              metnin altında aynı genişlikte durur. Sayfanın ilk büyük görseli
              olduğu için öncelikli yüklenir. */}
          <div className="rise rise-4">
            <Image
              src="/assets/auth_bg.png"
              alt={HERO_IMAGE_ALT}
              width={1382}
              height={1304}
              priority
              quality={85}
              sizes="(min-width: 1152px) 520px, (min-width: 768px) 46vw, 100vw"
              className="mx-auto h-auto w-full max-w-md rounded-3xl bg-ink shadow-[0_34px_70px_-30px_rgba(35,24,18,0.45)] md:max-w-none"
            />
          </div>
        </div>
      </section>

      {/* Kayan değer şeridi — koyu bant, sayfanın ritmini kırar */}
      <div className="marquee-mask overflow-hidden border-y border-ink/15 bg-ink py-3.5">
        <div className="marquee-track flex w-max gap-8">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 gap-8" aria-hidden={dup === 1}>
              {marqueeItems.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-8 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-paper/70"
                >
                  {item}
                  <span className="text-paprika">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
