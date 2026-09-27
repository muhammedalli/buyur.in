import { menuHost, whatsappLink } from "@/lib/site";
import { ArrowLeftIcon, WhatsappIcon } from "@/components/icons";
import type { ShowcaseItem } from "@/lib/showcase";
import { siteTranslator } from "@/lib/ui-messages/site";
import type { Translator, UiLocale } from "@/lib/ui-i18n";

// Fiyatlandırmadan hemen önceki sosyal kanıt katmanı. Yalnızca doğrulanabilir
// bilgi: kartlar canlı menülerden okunur, yorum yalnızca gerçekse gösterilir
// (bkz. lib/showcase.ts). Demo menüler "Demo menü" diye açıkça etiketlenir.

function ShowcaseCard({ item, t, index }: { item: ShowcaseItem; t: Translator; index: number }) {
  // Kart menüyü açar (vitrin kökü değil): "canlı menüyü gör" vaadi.
  const url = `https://${menuHost(item.slug)}/menu?utm_source=buyur&utm_medium=landing&utm_campaign=showcase`;
  return (
    <article
      data-reveal
      style={{ transitionDelay: `${(index % 3) * 80}ms` }}
      className="flex flex-col rounded-2xl border border-line bg-paper p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(35,24,18,0.5)]"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-crema font-display text-xl font-extrabold text-paprika">
          {item.logoUrl ? (
            <picture>
              <img src={item.logoUrl} alt={t("{name} logosu", { name: item.name })} className="absolute inset-0 h-full w-full object-cover" />
            </picture>
          ) : (
            item.name.charAt(0)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{item.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {item.kind === "customer" ? t("buyur müşterisi") : t("Demo menü")}
            {item.city ? ` · ${item.city}` : ""}
          </p>
        </div>
      </div>

      {item.products > 0 && (
        <p className="mt-5 font-mono text-[12px] text-ink">
          {t("{categories} kategori · {products} ürün · {languages} dil", {
            categories: item.categories,
            products: item.products,
            languages: item.languages,
          })}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">{t("Kullanılan özellikler:")} </span>
        {t(item.highlight)}
      </p>

      {item.quote && (
        <blockquote className="mt-4 border-l-2 border-paprika pl-3 text-sm italic leading-relaxed">
          “{item.quote.text}”
          <footer className="mt-1 font-mono text-[10px] not-italic uppercase tracking-wider text-ink-soft">
            — {item.quote.author}
          </footer>
        </blockquote>
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-track="live_demo_open"
        data-track-location="showcase"
        className="group mt-auto inline-flex items-center gap-2 pt-6 font-mono text-[12px] uppercase tracking-wider text-paprika"
      >
        {t("Canlı menüyü gör")}
        <ArrowLeftIcon size={14} className="rotate-180 transition-transform group-hover:translate-x-0.5" />
      </a>
    </article>
  );
}

export function Showcase({ items, locale = "tr" }: { items: ShowcaseItem[]; locale?: UiLocale }) {
  const t = siteTranslator(locale);
  const hasCustomers = items.some((item) => item.kind === "customer");

  return (
    <section id="kullananlar" data-track-view="social_proof_viewed" className="border-t border-line bg-crema/40">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Canlı menüler")}</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {hasCustomers ? t("buyur kullanan işletmeler") : t("Satın almadan önce menüleri kendiniz inceleyin")}
          </h2>
          <p className="mt-4 text-ink-soft">
            {t("Ekran görüntüsü değil, yayındaki menüler: açın, dil değiştirin, sepete ekleyin.")}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <ShowcaseCard key={item.slug} item={item} t={t} index={index} />
          ))}

          {/* Lead teklifi: menüsünü gönderen işletmeye demo menü */}
          <article data-reveal className="flex flex-col rounded-2xl border border-dashed border-paprika/50 bg-paprika/5 p-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-paprika">{t("Sıradaki menü sizinki olabilir")}</p>
            <p className="mt-3 font-display text-xl font-bold leading-snug">
              {t("Menünüzü WhatsApp'tan gönderin, sizin için demo menü hazırlayalım.")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {t(
                "Fotoğraf ya da PDF yeterli. Menünüzü kendi QR'ınızla, kendi telefonunuzda görün; beğenirseniz kaldığınız yerden devam edin."
              )}
            </p>
            <a
              href={whatsappLink(t("Merhaba! Menümü göndermek istiyorum, benim için demo menü hazırlayabilir misiniz?"))}
              target="_blank"
              rel="noopener noreferrer"
              data-track="whatsapp_lead"
              data-track-location="showcase"
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-ink px-6 py-3 font-mono text-[12px] uppercase tracking-wider text-paper transition-colors hover:bg-paprika"
              style={{ marginTop: "1.5rem" }}
            >
              <WhatsappIcon size={14} />
              {t("Menümü gönder")}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
