"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { highlightLabels, badgeLabels } from "@/lib/labels";
import type { SiteContent } from "@/lib/site-content";
import { ClockIcon, MapPinIcon, PhoneIcon, WhatsappIcon } from "@/components/icons";
import { useSiteLocale } from "@/components/site/site-locale";
import { ImageCreditList, productsNeedingCredit } from "@/components/menu/image-credit";
import type { UIKey } from "@/lib/i18n";
import { PLATFORM_BRANDING, showsPlatformSignature } from "@/lib/branding";
import { PoweredBy } from "@/components/powered-by";

// Otomatik web sitesinin bölümleri. Metin, seçili dile göre `useSiteLocale()`
// (tf/t) üzerinden okunur — bkz. components/site/site-locale.tsx. Yalnızca
// Elite'in animasyonlu parçaları (elite-parts.tsx) ayrıca istemciye iniyordu;
// artık dil değişimi de istemci tarafında olduğu için bu dosyanın tamamı
// istemci bileşeni. Her bölüm yalnızca verisi varsa çağrılır (bkz. content.sections).

export function SiteHero({ content, rich, menuHref }: { content: SiteContent; rich: boolean; menuHref: string }) {
  const { hero, reservation, business } = content;
  const { t, tf } = useSiteLocale();
  const title = tf(business, "name");
  const tagline = tf(business, "description").trim();

  return (
    <header className="relative isolate h-svh overflow-hidden">
      {hero.image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.image}
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
        </>
      )}

      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 text-center ${
          rich ? "py-32 sm:py-44" : "py-24 sm:py-32"
        }`}
      >
        {hero.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.logo}
            alt={title}
            className="h-20 w-20 rounded-2xl border border-white/20 object-cover shadow-lg"
          />
        )}

        <div className="flex w-full items-center justify-center gap-5">
          <SectionRule />
          <h1
            className={`font-display font-extrabold uppercase leading-[1.02] tracking-tight ${
              hero.image ? "text-paper" : "text-ink"
            } ${rich ? "text-5xl sm:text-7xl" : "text-4xl sm:text-6xl"}`}
          >
            {title}
          </h1>
          <SectionRule />
        </div>

        {tagline && (
          <p className={`max-w-2xl text-base leading-relaxed sm:text-lg ${hero.image ? "text-paper/85" : "text-ink-soft"}`}>
            {tagline}
          </p>
        )}

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            href={menuHref}
            className="rounded-md bg-[var(--brand)] px-8 py-3.5 font-mono text-[13px] uppercase tracking-wider text-[var(--brand-on)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            {t("viewMenu")}
          </Link>
          {reservation && (
            <a
              href={reservation.href}
              target={reservation.kind === "url" || reservation.kind === "whatsapp" ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`rounded-md border px-8 py-3.5 font-mono text-[13px] uppercase tracking-wider transition-colors ${
                hero.image
                  ? "border-paper/50 text-paper hover:bg-paper hover:text-ink"
                  : "border-ink text-ink hover:bg-ink hover:text-paper"
              }`}
            >
              {reservationLabel(t, reservation.kind)}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteSection({
  titleKey,
  subtitleKey,
  children,
  tone = "paper",
}: {
  titleKey?: UIKey;
  subtitleKey?: UIKey;
  children: React.ReactNode;
  tone?: "paper" | "crema" | "ink";
}) {
  const { t } = useSiteLocale();
  const background = tone === "crema" ? "bg-crema/50" : tone === "ink" ? "bg-ink text-paper" : "bg-paper";
  return (
    <section className={background}>
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        {titleKey && (
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-5">
              <SectionRule />
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t(titleKey)}</h2>
              <SectionRule />
            </div>
            {subtitleKey && (
              <p className={`mt-2 text-sm ${tone === "ink" ? "text-paper/70" : "text-ink-soft"}`}>{t(subtitleKey)}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Başlığı çevreleyen ince çift çizgi — vurguyu markanın kendi renginden alır. */
function SectionRule() {
  return (
    <span className="hidden w-8 shrink-0 space-y-1 sm:block sm:w-14" aria-hidden>
      <span className="block h-px" style={{ background: "var(--brand)" }} />
      <span className="block h-px opacity-40" style={{ background: "var(--brand)" }} />
    </span>
  );
}

export function ProductCards({ products, columns = 4 }: { products: SiteContent["featured"]; columns?: 2 | 3 | 4 }) {
  const { locale, tf } = useSiteLocale();
  const grid = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-5 ${grid}`}>
      {products.map((product) => (
        <article key={product.id} className="group overflow-hidden rounded-2xl border border-line bg-paper">
          {product.images?.[0] && (
            <div className="aspect-[4/3] overflow-hidden bg-crema">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.images[0]}
                alt={tf(product, "name")}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-base font-bold">{tf(product, "name")}</h3>
              <span className="shrink-0 font-mono text-sm font-semibold">{formatPrice(product.price)}</span>
            </div>
            {tf(product, "description") && (
              <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{tf(product, "description")}</p>
            )}
            {(product.badges ?? []).length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {product.badges.slice(0, 2).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full bg-crema px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft"
                  >
                    {badgeLabels[locale][badge]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Premium'un sade menü görünümü: kategori kategori, kaydırmasız liste. */
export function SiteMenuList({ groups }: { groups: SiteContent["groups"] }) {
  const { tf } = useSiteLocale();
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <div key={group.category.id}>
          <h3 className="mb-4 font-display text-xl font-bold">{tf(group.category, "name")}</h3>
          <ProductCards products={group.products} columns={2} />
        </div>
      ))}
    </div>
  );
}

export function SiteInfo({ content }: { content: SiteContent }) {
  const { locale } = useSiteLocale();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {content.highlights.map((highlight) => (
        <div key={highlight} className="rounded-2xl border border-line px-5 py-4 text-center text-sm">
          {highlightLabels[locale][highlight]}
        </div>
      ))}
    </div>
  );
}

export function SiteHours({ hours }: { hours: string[] }) {
  return (
    <ul className="mx-auto max-w-md space-y-2">
      {hours.map((line) => (
        <li key={line} className="flex items-center justify-center gap-3 border-b border-line/70 pb-2 text-sm last:border-0">
          <ClockIcon size={15} className="shrink-0 text-ink-soft" />
          {line}
        </li>
      ))}
    </ul>
  );
}

/** "Hakkımızda" — açıklama, mekân özellikleri ve çalışma saatlerini tek bölümde
 *  toplar; ayrı sekmeler olarak bölmüyoruz. */
export function SiteAbout({ content }: { content: SiteContent }) {
  const { t, tf } = useSiteLocale();
  const description = tf(content.business, "description").trim();
  const hasHighlights = content.highlights.length > 0;
  const hasHours = content.hours.length > 0;

  if (!description && !hasHighlights && !hasHours) return null;

  return (
    <SiteSection titleKey="siteAbout" tone="paper">
      <div className="mx-auto max-w-2xl space-y-10">
        {description && <p className="text-center text-base leading-relaxed text-ink-soft">{description}</p>}

        {hasHighlights && (
          <div>
            <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {t("siteHighlights")}
            </p>
            <SiteInfo content={content} />
          </div>
        )}

        {hasHours && (
          <div>
            <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {t("workingHoursLabel")}
            </p>
            <SiteHours hours={content.hours} />
          </div>
        )}
      </div>
    </SiteSection>
  );
}

export function SiteLocation({ content }: { content: SiteContent }) {
  const { t } = useSiteLocale();
  if (!content.location) return null;
  const { address, mapsUrl } = content.location;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="flex max-w-md items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <MapPinIcon size={16} className="mt-0.5 shrink-0" />
        {address}
      </p>
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-ink px-6 py-3 font-mono text-[12px] uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
        >
          {t("directionsLabel")}
        </a>
      )}
    </div>
  );
}

/** Marka adları (WhatsApp, Instagram…) dilden bağımsız sabit kalır; yalnızca
 *  gerçek kelimeler (Telefon, E-posta, Google değerlendirmesi) çevrilir. */
function contactLabel(t: ReturnType<typeof useSiteLocale>["t"], link: SiteContent["contact"][number]): string {
  switch (link.kind) {
    case "phone":
      return t("phoneLabel");
    case "email":
      return t("emailLabel");
    case "review":
      return t("googleReviewLinkLabel");
    case "whatsapp":
      return "WhatsApp";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    default:
      return link.value || link.kind;
  }
}

export function SiteContact({ content }: { content: SiteContent }) {
  const { t } = useSiteLocale();
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {content.contact.map((link) => (
        <a
          key={`${link.kind}-${link.value}`}
          href={link.href}
          target={link.kind === "phone" || link.kind === "email" ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-2.5 text-sm transition-colors hover:border-paprika hover:text-paprika"
        >
          {link.kind === "phone" && <PhoneIcon size={14} />}
          {link.kind === "whatsapp" && <WhatsappIcon size={14} />}
          <span className="font-mono text-[12px] uppercase tracking-wider">{contactLabel(t, link)}</span>
        </a>
      ))}
    </div>
  );
}

function reservationLabel(t: ReturnType<typeof useSiteLocale>["t"], kind: "url" | "phone" | "whatsapp"): string {
  if (kind === "whatsapp") return t("reservationViaWhatsapp");
  if (kind === "phone") return t("reservationViaPhone");
  return t("reservationViaUrl");
}

export function SiteReservationCta({ content }: { content: SiteContent }) {
  const { t, tf } = useSiteLocale();
  if (!content.reservation) return null;
  const { reservation, business } = content;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("siteReservationTitle")}</h2>
      <p className="max-w-md text-sm text-paper/70">
        {t("siteReservationSubtitle", { name: tf(business, "name") })}
      </p>
      <a
        href={reservation.href}
        target={reservation.kind === "phone" ? undefined : "_blank"}
        rel="noopener noreferrer"
        className="rounded-md bg-paper px-8 py-3.5 font-mono text-[13px] uppercase tracking-wider text-ink transition-transform duration-300 hover:-translate-y-0.5"
      >
        {reservationLabel(t, reservation.kind)}
      </a>
    </div>
  );
}

export function SiteFooter({ content, menuHref }: { content: SiteContent; menuHref: string }) {
  const { t, tf, locale } = useSiteLocale();
  // Sitede gösterilen tüm ürünler — künye gerektiren görselin atfı, eserin
  // gösterildiği sayfada bulunmak zorunda (CC BY / BY-SA).
  const shownProducts = [...content.featured, ...content.groups.flatMap((group) => group.products)];
  const credited = productsNeedingCredit(shownProducts);

  return (
    <footer className="border-t border-line bg-paper">
      {credited.length > 0 && (
        <div className="mx-auto max-w-5xl border-b border-line px-6 py-8">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {t("imageCreditsTitle")}
          </p>
          <ImageCreditList products={credited} locale={locale} />
        </div>
      )}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="font-display text-lg font-bold">{tf(content.business, "name")}</p>
        <Link
          href={menuHref}
          className="font-mono text-[12px] uppercase tracking-wider text-paprika transition-colors hover:text-paprika-deep"
        >
          {t("openDigitalMenu")}
        </Link>
        {showsPlatformSignature(content.business) && (
          <PoweredBy label={t("poweredByBuyur", { brand: PLATFORM_BRANDING.name })} />
        )}
      </div>
    </footer>
  );
}
