import { formatTL, planPricing } from "@/lib/pricing";
import { sectionId } from "@/lib/landing-sections";
import { CheckCircleIcon } from "@/components/icons";
import { siteTranslator } from "@/lib/ui-messages/site";
import type { Translator, UiLocale } from "@/lib/ui-i18n";

// Kâğıt menü karşılaştırması. Satın alma kararını etkileyen sonuçlar sayfanın
// üstünde; buradaki detaylar ikna değil, kontrol listesi. (Menüdeki diğer
// özellikler "Özellikler" bölümünde: components/feature-grid.tsx.)

// Fiyat canlı katalogdan gelir; modül yüklenirken değil render anında okunur.
function buildRows(t: Translator) {
  const premiumFrom = planPricing("premium")?.yearlyMonthly ?? null;
  return [
    { label: t("Fiyat değişikliği"), paper: t("Yeniden baskı, günlerce bekleme"), buyur: t("Panelden anında, tüm masalarda") },
    { label: t("Tükenen ürün"), paper: t("Garson masada söyler"), buyur: t("Tek dokunuşla menüden kalkar") },
    {
      label: t("Maliyet"),
      paper: t("Her zamda yeni baskı"),
      buyur: premiumFrom
        ? t("Ücretsiz başlar · Premium ayda {price}'den", { price: formatTL(premiumFrom) })
        : t("Ücretsiz başlar"),
    },
    { label: t("Yabancı misafir"), paper: t("Tek dil"), buyur: t("8 dil, işletme başına 4") },
    { label: t("Alerjen ve kalori"), paper: t("Çoğunlukla yok"), buyur: t("Her üründe gösterilebilir") },
    { label: t("Sipariş"), paper: t("Garson not alır, karışabilir"), buyur: t("Müşteri seçimini sepette garsona gösterir") },
    { label: t("Hangi ürün ilgi görüyor?"), paper: t("Bilinmez"), buyur: t("Panelde ürün ve QR bazında") },
    { label: t("İşletme bilgileri"), paper: t("Kapıdaki tabelada"), buyur: t("Vitrinde: adres, saatler, iletişim, sosyal medya") },
    { label: t("Hijyen"), paper: t("Elden ele dolaşır"), buyur: t("Müşterinin kendi telefonunda") },
  ];
}

export function Comparison({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);
  return (
    <section id={sectionId("compare", locale)} className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Karşılaştırın")}</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">{t("Kâğıt menü mü, buyur mı?")}</h2>
        </div>

        <div data-reveal className="mt-12 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line bg-crema/50 text-left">
                <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-soft" scope="col">
                  <span className="sr-only">{t("Konu")}</span>
                </th>
                <th className="px-5 py-3 font-display text-base font-bold text-ink-soft" scope="col">
                  {t("Kâğıt menü")}
                </th>
                <th className="px-5 py-3 font-display text-base font-bold text-paprika" scope="col">
                  buyur
                </th>
              </tr>
            </thead>
            <tbody>
              {buildRows(t).map((row) => (
                <tr key={row.label} className="border-b border-line/60 transition-colors last:border-0 hover:bg-crema/30">
                  <th scope="row" className="px-5 py-3 text-left font-medium">
                    {row.label}
                  </th>
                  <td className="px-5 py-3 text-ink-soft">{row.paper}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-herb" aria-hidden>
                        <CheckCircleIcon size={15} />
                      </span>
                      {row.buyur}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
