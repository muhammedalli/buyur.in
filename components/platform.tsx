import type { ReactNode } from "react";
import { sectionId } from "@/lib/landing-sections";
import { ArrowRightIcon, LayoutIcon, MenuIcon, MonitorIcon } from "@/components/icons";
import { siteTranslator } from "@/lib/ui-messages/site";
import type { UiLocale } from "@/lib/ui-i18n";

/* ─── Platform: üç deneyim, tek adres ─────────────────────────
   buyur'u "yalnızca QR menü" olmaktan çıkaran kurgu: panel → vitrin
   (isletme.buyur.in: web sitesi ya da otomatik karşılama) → menü. Kart
   yığını değil, tek çerçevede üç sütun; her sütunun küçük ekran örneği
   gerçek ekranların sadeleştirilmiş hâlidir (uydurma veri değil, örnek). */

function PanelMock({ t }: { t: ReturnType<typeof siteTranslator> }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3 text-[10px]">
      <p className="font-mono uppercase tracking-wider text-ink-soft">{t("Kayan yazı")}</p>
      <div className="mt-1.5 flex items-center justify-between rounded-md border border-line px-2 py-1.5">
        <span className="truncate">{t("Taze ürünler · Günün favorileri")}</span>
        <span className="relative ml-2 inline-flex h-3.5 w-6 shrink-0 items-center rounded-full bg-herb">
          <span className="inline-block h-2.5 w-2.5 translate-x-3 rounded-full bg-paper" />
        </span>
      </div>
      <p className="mt-2.5 font-mono uppercase tracking-wider text-ink-soft">{t("Fiyat (₺)")}</p>
      <div className="relative mt-1 h-6 overflow-hidden rounded-md border border-paprika px-2">
        <span className="price-swap-old absolute inset-y-0 left-2 flex items-center font-mono">285</span>
        <span className="price-swap-new absolute inset-y-0 left-2 flex items-center font-mono font-semibold">310</span>
      </div>
    </div>
  );
}

function StorefrontMock({ t }: { t: ReturnType<typeof siteTranslator> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper text-center">
      <div className="h-12 bg-gradient-to-br from-[#c9794a] via-[#d8b98a] to-[#8a5a3c]" aria-hidden />
      <div className="-mt-5 flex flex-col items-center px-3 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-paper bg-paprika font-display text-sm font-extrabold text-paper">
          A
        </span>
        <p className="mt-1.5 font-display text-[12px] font-extrabold">Alpha Cafe</p>
        <p className="text-[9px] text-ink-soft">{t("Kadıköy · 08:00–23:00")}</p>
        <span className="mt-2 block w-full rounded-md bg-paprika py-1.5 font-display text-[10px] font-extrabold uppercase tracking-wide text-paper">
          {t("Menüyü gör")}
        </span>
      </div>
    </div>
  );
}

function MenuMock({ t }: { t: ReturnType<typeof siteTranslator> }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3 text-[10px]">
      <div className="flex gap-1">
        {[t("Kahvaltı"), t("Ana yemek"), t("Tatlı")].map((label, index) => (
          <span
            key={label}
            className={`rounded-full px-2 py-0.5 ${index === 1 ? "bg-paprika text-paper" : "bg-crema text-ink-soft"}`}
          >
            {label}
          </span>
        ))}
      </div>
      {[
        [t("Izgara Köfte"), "310₺"],
        [t("Mantarlı Risotto"), "240₺"],
      ].map(([name, price]) => (
        <div key={name} className="mt-2 flex items-center justify-between rounded-md bg-crema/60 px-2 py-1.5">
          <span className="font-semibold">{name}</span>
          <span className="font-mono">{price}</span>
        </div>
      ))}
    </div>
  );
}

interface Step {
  label: string;
  url: string;
  title: string;
  desc: string;
  Icon: (p: { size?: number }) => ReactNode;
  mock: ReactNode;
}

export function Platform({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);

  const steps: Step[] = [
    {
      label: t("Panel"),
      url: "buyur.in/panel",
      title: t("Tek panelden yönetin"),
      desc: t("Menü, fiyat, kampanya, kayan duyuru, çalışma saatleri ve iletişim bilgileri tek yerde. Bir kez girin, her yerde güncel olsun."),
      Icon: LayoutIcon,
      mock: <PanelMock t={t} />,
    },
    {
      label: t("Vitrin"),
      url: t("isletmeniz.buyur.in"),
      title: t("Vitrininiz kendiliğinden hazır"),
      desc: t("Web siteniz yayındaysa ziyaretçi doğrudan sitenize girer. Yoksa logo, kapak, adres, saatler ve sosyal medyanızdan otomatik bir karşılama sayfası oluşur."),
      Icon: MonitorIcon,
      mock: <StorefrontMock t={t} />,
    },
    {
      label: t("Menü"),
      url: t("isletmeniz.buyur.in/menu"),
      title: t("Menü bir dokunuş uzakta"),
      desc: t("“Menüyü gör” ile QR menüye geçilir; masadaki QR ise doğrudan menüyü açar. Çoklu dil, sepet ve kampanyalar menüde."),
      Icon: MenuIcon,
      mock: <MenuMock t={t} />,
    },
  ];

  const flow = [t("Vitrin"), t("Menü"), t("İşletme bilgileri"), t("Sosyal medya"), t("Rezervasyon & iletişim")];

  return (
    <section id={sectionId("platform", locale)} className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Tek platform")}</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("Panelden masaya: üç deneyim, tek adres")}
          </h2>
          <p className="mt-4 text-ink-soft">
            {t(
              "buyur yalnızca bir QR menü değil. Panelde girdiğiniz bilgi vitrininizde ve menünüzde aynı anda görünür; ayrı bir site kurmanız, iki yerde güncelleme yapmanız gerekmez."
            )}
          </p>
        </div>

        <ol className="mt-14 grid overflow-hidden rounded-3xl border border-line bg-paper lg:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.url}
              data-reveal
              style={{ transitionDelay: `${index * 110}ms` }}
              className={`relative flex flex-col gap-5 p-7 sm:p-8 ${index > 0 ? "border-t border-line lg:border-l lg:border-t-0" : ""}`}
            >
              {index > 0 && (
                // Sütunlar arası akış oku: masaüstünde çizginin üstünde, mobilde üstte.
                <span
                  aria-hidden
                  className="flow-arrow absolute left-1/2 top-0 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 rotate-90 items-center justify-center rounded-full border border-line bg-paper text-paprika lg:left-0 lg:top-1/2 lg:rotate-0"
                >
                  <ArrowRightIcon size={14} />
                </span>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paprika font-mono text-[12px] text-paper">
                    {index + 1}
                  </span>
                  <span className="font-mono text-[12px] uppercase tracking-wider text-ink-soft">{step.label}</span>
                </span>
                <span className="text-ink-soft" aria-hidden>
                  <step.Icon size={18} />
                </span>
              </div>
              <span className="w-fit rounded-md border border-line bg-crema/60 px-2.5 py-1 font-mono text-[11px] text-ink">
                {step.url}
              </span>
              <div className="transition-transform duration-500 hover:-translate-y-1">{step.mock}</div>
              <div>
                <h3 className="font-display text-xl font-bold leading-snug">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div data-reveal className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
          {flow.map((item, index) => (
            <span key={item} className="flex items-center gap-2">
              <span className="rounded-full border border-line bg-paper px-3.5 py-1.5">{item}</span>
              {index < flow.length - 1 && (
                <span aria-hidden className="text-paprika">
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
