"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMenu } from "@/components/menu/menu-provider";
import { highlightLabels } from "@/lib/labels";
import { facebookUrl, instagramUrl, tiktokUrl, whatsappUrl, youtubeUrl } from "@/lib/social";
import { telHref } from "@/lib/phone";
import { publicContactEmail } from "@/lib/business-account";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { Business } from "@/lib/types";
import {
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  FacebookIcon,
  HighlightIcon,
  InfoIcon,
  InstagramIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  TiktokIcon,
  WhatsappIcon,
  WifiIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/icons";

// İşletme bilgileri: adres, saatler, harita, Google yorumları, WiFi, iletişim,
// sosyal medya ve öne çıkan özellikler. Menüde ürünler ana odak kalsın diye
// hepsi ekrana yığılmaz: menü ana sayfasında tek satırlık özet kart, dokununca
// alttan açılan bir yaprak (masaüstünde ortalanmış pencere).
//
// Kural: boş alan hiçbir koşulda gösterilmez — ne boş satır ne kırık bağlantı.

/** Adres var ama harita bağlantısı yoksa aramalı harita bağlantısı kurulur. */
function mapsHref(business: Business): string {
  if (business.google_maps_url) return business.google_maps_url;
  if (business.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
  return "";
}

interface SocialLink {
  key: string;
  label: string;
  href: string;
  Icon: typeof InstagramIcon;
}

function socialLinks(business: Business): SocialLink[] {
  const links: (SocialLink | null)[] = [
    business.whatsapp ? { key: "whatsapp", label: "WhatsApp", href: whatsappUrl(business.whatsapp), Icon: WhatsappIcon } : null,
    business.instagram ? { key: "instagram", label: "Instagram", href: instagramUrl(business.instagram), Icon: InstagramIcon } : null,
    business.tiktok ? { key: "tiktok", label: "TikTok", href: tiktokUrl(business.tiktok), Icon: TiktokIcon } : null,
    business.youtube ? { key: "youtube", label: "YouTube", href: youtubeUrl(business.youtube), Icon: YoutubeIcon } : null,
    business.facebook ? { key: "facebook", label: "Facebook", href: facebookUrl(business.facebook), Icon: FacebookIcon } : null,
  ];
  return links.filter((link): link is SocialLink => Boolean(link?.href));
}

/** Gösterilecek herhangi bir bilgi var mı — yoksa kart ve düğme hiç çizilmez. */
export function hasBusinessInfo(business: Business): boolean {
  return Boolean(
    business.address ||
      business.google_maps_url ||
      business.working_hours ||
      business.phone ||
      publicContactEmail(business) ||
      business.wifi_password ||
      business.google_review_url ||
      (business.highlights?.length ?? 0) > 0 ||
      socialLinks(business).length > 0
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useMenu();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* pano izni yoksa metin zaten ekranda, elle kopyalanabilir */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-line/70 px-3 py-1.5 font-display text-xs font-semibold text-ink-soft transition-colors hover:text-ink active:scale-95"
      aria-live="polite"
    >
      <CopyIcon size={13} />
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

function Row({ icon, label, children, action }: { icon: ReactNode; label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-crema text-[var(--brand-text)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{label}</p>
        <div className="mt-0.5 break-words text-sm text-ink">{children}</div>
      </div>
      {action}
    </div>
  );
}

/** Alt yaprağın içeriği — /welcome sayfası da aynı içeriği kullanır. */
export function BusinessInfoContent({ business }: { business: Business }) {
  const { locale, t, tf } = useMenu();
  const description = tf(business, "description");
  const maps = mapsHref(business);
  const contactEmail = publicContactEmail(business);
  const socials = socialLinks(business);
  const highlights = business.highlights ?? [];

  const actions = [
    business.phone && { key: "call", label: t("callNow"), href: telHref(business.phone), Icon: PhoneIcon, external: false },
    maps && { key: "map", label: t("directionsLabel"), href: maps, Icon: MapPinIcon, external: true },
    business.google_review_url && {
      key: "review",
      label: t("googleReviewLinkLabel"),
      href: business.google_review_url,
      Icon: StarIcon,
      external: true,
    },
  ].filter((item): item is { key: string; label: string; href: string; Icon: typeof PhoneIcon; external: boolean } =>
    Boolean(item)
  );

  return (
    <div>
      {business.cover_url && (
        <div className="relative -mx-5 -mt-5 mb-4 aspect-[16/7] overflow-hidden sm:-mx-6 sm:-mt-6 sm:rounded-t-3xl">
          <picture>
            <img src={business.cover_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-paper" />
        </div>
      )}

      <div className="flex items-center gap-3">
        {business.logo_url && (
          <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line/60 bg-paper">
            <picture>
              <img src={business.logo_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </picture>
          </span>
        )}
        <h2 className="min-w-0 font-display text-xl font-extrabold leading-tight tracking-tight">{tf(business, "name")}</h2>
      </div>
      {description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{description}</p>}

      {actions.length > 0 && (
        // Esnek satır: tek kalan düğme yarım genişlikte asılı kalmaz, satırı doldurur.
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <a
              key={action.key}
              href={action.href}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noopener noreferrer" : undefined}
              className="flex min-h-11 flex-[1_1_9rem] items-center justify-center gap-2 rounded-xl border border-line/70 px-3 py-2.5 text-center font-display text-xs font-semibold text-ink transition-colors hover:border-[var(--brand)]/60 active:scale-[0.98]"
            >
              <action.Icon size={15} className="shrink-0 text-[var(--brand-text)]" />
              <span className="leading-tight">{action.label}</span>
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 divide-y divide-line/60">
        {(business.address || maps) && (
          <Row icon={<MapPinIcon size={15} />} label={t("addressLabel")}>
            {maps ? (
              <a href={maps} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2">
                {business.address || t("showOnMap")}
              </a>
            ) : (
              business.address
            )}
          </Row>
        )}
        {business.working_hours && (
          <Row icon={<ClockIcon size={15} />} label={t("workingHoursLabel")}>
            <span className="whitespace-pre-line leading-relaxed">{business.working_hours}</span>
          </Row>
        )}
        {business.wifi_password && (
          <Row icon={<WifiIcon size={15} />} label={t("wifiPasswordLabel")} action={<CopyButton value={business.wifi_password} />}>
            <span className="select-all font-mono font-semibold">{business.wifi_password}</span>
          </Row>
        )}
        {business.phone && (
          <Row icon={<PhoneIcon size={15} />} label={t("phoneLabel")}>
            <a href={telHref(business.phone)} className="font-medium" dir="ltr">
              {business.phone}
            </a>
          </Row>
        )}
        {contactEmail && (
          <Row icon={<MailIcon size={15} />} label={t("emailLabel")}>
            <a href={`mailto:${contactEmail}`} className="font-medium">
              {contactEmail}
            </a>
          </Row>
        )}
      </div>

      {highlights.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t("siteHighlights")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-center gap-1.5 rounded-full border border-line/70 bg-crema/50 px-3 py-1.5 text-xs font-medium text-ink"
              >
                <HighlightIcon highlight={highlight} size={14} strokeWidth={2} className="text-[var(--brand-text)]" />
                {highlightLabels[locale][highlight]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {socials.length > 0 && (
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t("socialLabel")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {socials.map((social) => (
              <li key={social.key}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-line/70 bg-paper text-ink transition-colors hover:border-[var(--brand)]/60 hover:text-[var(--brand-text)] active:scale-95"
                >
                  <social.Icon size={19} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Alttan açılan bilgi yaprağı (masaüstünde ortalanmış pencere). */
export function BusinessInfoSheet({ business, onClose }: { business: Business; onClose: () => void }) {
  const { t } = useMenu();
  const closeButton = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(true);

  useEffect(() => {
    closeButton.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label={t("close")} onClick={onClose} className="fade-in absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("businessInfo")}
        className="upsell-in relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-line/60 bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(35,24,18,0.35)] sm:max-w-lg sm:rounded-3xl sm:p-6"
      >
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute end-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-paper/90 text-ink shadow-xs backdrop-blur transition-colors hover:bg-crema"
        >
          <XIcon size={16} />
        </button>
        <BusinessInfoContent business={business} />
      </div>
    </div>
  );
}

/** Menü ana sayfasındaki kompakt özet: ürünlerin önüne geçmeden tek dokunuşla
 *  tüm bilgiler. Gösterilecek bilgi yoksa hiç çizilmez. */
export function BusinessInfoCard({ onOpen }: { onOpen: () => void }) {
  const { business, locale, t, tf } = useMenu();
  if (!hasBusinessInfo(business)) return null;

  const description = tf(business, "description");
  const firstHours = business.working_hours?.split(/\r?\n/).find((line) => line.trim())?.trim();
  // Dar ekranda iki bilgi yan yana sığmıyor, ikisi de kesiliyordu: tek bilgi
  // (öncelik sırasıyla) tam genişlikte gösterilir, WiFi yalnızca simgeyle.
  const fact = firstHours
    ? { Icon: ClockIcon, text: firstHours }
    : business.address
      ? { Icon: MapPinIcon, text: business.address }
      : (business.highlights?.length ?? 0) > 0
        ? { Icon: InfoIcon, text: highlightLabels[locale][business.highlights[0]!] }
        : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-2xl border border-line/60 bg-crema/40 p-3 text-start shadow-xs transition-colors hover:border-[var(--brand)]/50 active:scale-[0.99]"
    >
      {business.cover_url ? (
        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-crema">
          <picture>
            <img src={business.cover_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </picture>
        </span>
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper text-[var(--brand-text)]">
          <InfoIcon size={22} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        {description ? (
          <span className="line-clamp-2 text-[13px] leading-snug text-ink">{description}</span>
        ) : (
          <span className="block font-display text-sm font-bold text-ink">{t("businessInfo")}</span>
        )}
        {(fact || business.wifi_password) && (
          <span className="mt-1 flex min-w-0 items-center gap-2.5 text-[11px] text-ink-soft">
            {fact && (
              <span className="flex min-w-0 items-center gap-1">
                <fact.Icon size={12} className="shrink-0" />
                <span className="truncate">{fact.text}</span>
              </span>
            )}
            {business.wifi_password && (
              <span className="flex shrink-0 items-center gap-1" title={t("wifiPasswordLabel")}>
                <WifiIcon size={12} />
                WiFi
              </span>
            )}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 font-display text-[11px] font-semibold text-[var(--brand-text)]">
        <span className="hidden min-[380px]:inline">{t("moreInfo")}</span>
        <ChevronRightIcon size={14} className="rtl:rotate-180" />
      </span>
    </button>
  );
}
