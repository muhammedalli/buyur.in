import type { ReactNode } from "react";
import {
  FlameIcon,
  LanguagesIcon,
  MarqueeIcon,
  MegaphoneIcon,
  MonitorIcon,
  QrCodeIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  TrendingUpIcon,
  LayoutIcon,
} from "@/components/icons";
import { siteTranslator } from "@/lib/ui-messages/site";
import type { UiLocale } from "@/lib/ui-i18n";
import { isRTLLocale, localeLabels, SUPPORTED_LOCALES } from "@/lib/i18n";

/* ─── Özellikler ─────────────────────────────────────────────
   Kart yığını yerine ince çizgilerle ayrılmış sade bir liste: ikon,
   başlık, tek cümle. Yalnızca ürünün BUGÜN yaptığı işler; plana bağlı
   olanlar parantez içinde söylenir (fiyat/kota rakamı yazılmaz). */

interface Feature {
  Icon: (p: { size?: number }) => ReactNode;
  title: string;
  desc: string;
}

export function FeatureGrid({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);

  const features: Feature[] = [
    {
      Icon: QrCodeIcon,
      title: t("Masa bazlı QR kodlar"),
      desc: t("Tek QR ya da masa numaralı QR'ları toplu PDF alın; hangi masanın menüyü açtırdığını görün."),
    },
    {
      Icon: TagIcon,
      title: t("Anlık fiyat ve stok"),
      desc: t("Fiyatı değiştirin, tükeneni gizleyin; açık olan bütün menülerde saniyeler içinde görünür."),
    },
    {
      Icon: LanguagesIcon,
      title: t("Sekiz dilde menü"),
      desc: t("Sekiz dil arasından ana diliniz dahil dördünü seçin. Yapay zekâ boş kalan çevirileri tamamlar, siz onaylarsınız."),
    },
    {
      Icon: SparklesIcon,
      title: t("Yapay zekâ ile menü aktarımı"),
      desc: t("Basılı menünüzün fotoğrafını çekin; ürünler ve fiyatlar kontrol etmeniz için taslak olarak gelsin."),
    },
    {
      Icon: LayoutIcon,
      title: t("Otomatik karşılama sayfası"),
      desc: t("Web siteniz yoksa bile logo, kapak, adres, saatler ve sosyal medyanızdan şık bir vitrin oluşur."),
    },
    {
      Icon: MonitorIcon,
      title: t("Web sitesi (Elite)"),
      desc: t("Menünüzden kendiliğinden oluşan, animasyonlu restoran sitesi; ayrı içerik girmezsiniz."),
    },
    {
      Icon: MarqueeIcon,
      title: t("Kayan duyuru şeridi"),
      desc: t("“Taze ürünler ✦ Günün favorileri” gibi mesajlarınız menüde ve vitrinde akar; panelden açıp kapatın."),
    },
    {
      Icon: MegaphoneIcon,
      title: t("Kampanya ve açılış pop-up'ı"),
      desc: t("Happy hour, haftanın tatlısı… Süreli kampanyalar bitiş anında kendiliğinden kapanır."),
    },
    {
      Icon: ShoppingBagIcon,
      title: t("Sepet → garsona göster"),
      desc: t("Müşteri seçimini boy ve ekstralarıyla sepette toplar, toplamı görür, ekranı garsona gösterir."),
    },
    {
      Icon: FlameIcon,
      title: t("Kalori, alerjen, süre"),
      desc: t("Her üründe alerjen, kalori ve hazırlanma süresi; rozetlerle şefin önerisi ve yeni ürünler."),
    },
    {
      Icon: TrendingUpIcon,
      title: t("Ürün ve QR analizi"),
      desc: t("Hangi ürün inceleniyor, hangisi sepete giriyor, müşteri nereden geliyor — panelde görün."),
    },
    {
      Icon: StarIcon,
      title: t("Müşteri değerlendirmesi"),
      desc: t("Birkaç saniyelik anket; memnun müşteriyi Google değerlendirmesine yönlendirin."),
    },
  ];

  return (
    <section id="ozellikler" className="border-b border-line bg-crema/40">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Özellikler")}</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("Menünüzü yönetmek için gereken her şey")}
          </h2>
          <p className="mt-4 text-ink-soft">
            {t("Ürün ve kategori sınırı yok. Özellikler planınıza göre açılır; her şey aynı panelden yönetilir.")}
          </p>
        </div>

        <ul className="mt-12 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <li
              key={feature.title}
              data-reveal
              style={{ transitionDelay: `${(index % 3) * 80}ms` }}
              className="group flex gap-4 border-t border-line py-6"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper text-paprika shadow-[0_6px_16px_-10px_rgba(35,24,18,0.4)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]">
                <feature.Icon size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold leading-snug">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{feature.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Menü dilleri — kendi adlarıyla (misafir kendi dilini böyle arar). */}
        <div data-reveal className="mt-10 flex flex-wrap items-center gap-2">
          <span className="me-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">{t("Menü dilleri")}</span>
          {SUPPORTED_LOCALES.map((code) => (
            <span
              key={code}
              lang={code}
              dir={isRTLLocale(code) ? "rtl" : undefined}
              className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm transition-colors hover:border-paprika hover:text-paprika"
            >
              {localeLabels[code]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
