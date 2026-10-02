import Link from "next/link";
import { sectionId } from "@/lib/landing-sections";
import type { ReactNode } from "react";
import { whatsappLink } from "@/lib/site";
import { CheckCircleIcon, QrCodeIcon, WhatsappIcon } from "@/components/icons";
import { siteTranslator } from "@/lib/ui-messages/site";
import type { Translator, UiLocale } from "@/lib/ui-i18n";

/* ─── Sorun → çözüm ───────────────────────────────────────────
   Uzun özellik listesi yerine satın alma kararını etkileyen üç sonuç. Her
   satır: işletmenin sorunu, buyur'un çözümü ve bunun gerçekte nasıl
   göründüğü. Diğer detaylar (hazırlanma süresi, özel URL…) sayfanın
   altındaki karşılaştırmada. */

function PriceUpdateProof({ t }: { t: Translator }) {
  return (
    <div className="grid grid-cols-[1.1fr_0.9fr] gap-3" aria-label={t("Panelde fiyat değişince menüde anında güncellenir")}>
      {/* Panel tarafı */}
      <div className="rounded-2xl border border-line bg-paper p-4 shadow-[0_18px_40px_-28px_rgba(35,24,18,0.5)]">
        <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">{t("Panel · Ürün düzenle")}</p>
        <p className="mt-2 font-display text-sm font-bold">{t("Izgara Köfte")}</p>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-ink-soft">{t("Fiyat (₺)")}</p>
        <div className="relative mt-1 h-9 overflow-hidden rounded-xl border border-paprika bg-paper px-3">
          <span className="price-swap-old absolute inset-y-0 left-3 flex items-center font-mono text-sm">285</span>
          <span className="price-swap-new absolute inset-y-0 left-3 flex items-center font-mono text-sm font-semibold">310</span>
        </div>
        <span className="save-pulse mt-3 inline-flex rounded-md bg-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-paper">
          {t("Kaydet")}
        </span>
      </div>

      {/* Müşteri menüsü tarafı */}
      <div className="rounded-[1.4rem] border-[5px] border-ink bg-[#171310] p-3">
        <p className="font-mono text-[8px] uppercase tracking-widest text-paprika">{t("Masa 4 · menü")}</p>
        <div className="mt-2 rounded-lg bg-paper/[0.07] p-2.5">
          <p className="text-[12px] font-semibold text-paper">{t("Izgara Köfte")}</p>
          <div className="relative mt-1 h-5">
            <span className="price-swap-old absolute left-0 font-mono text-[12px] text-paper">285₺</span>
            <span className="price-swap-new absolute left-0 font-mono text-[12px] font-bold text-paprika">310₺</span>
          </div>
          <span className="price-swap-new mt-1 inline-block rounded bg-herb/25 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#9fd6ae]">
            {t("az önce güncellendi")}
          </span>
        </div>
        <div className="mt-2 rounded-lg bg-paper/[0.05] p-2.5">
          <p className="text-[12px] font-semibold text-paper/80">{t("Mantarlı Risotto")}</p>
          <p className="mt-1 font-mono text-[12px] text-paper/70">240₺</p>
        </div>
      </div>
    </div>
  );
}

/** Buyur'un gerçek sepet sayfasının birebir kopyası (app/[slug]/cart). */
function CartProof({ t }: { t: Translator }) {
  const lines = [
    { name: t("Izgara Köfte"), note: t("Acılı"), qty: 2, price: "570₺" },
    { name: t("Mevsim Salatası"), note: "", qty: 1, price: "165₺" },
    { name: t("Ayran"), note: t("Büyük boy"), qty: 2, price: "120₺" },
  ];
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-ink bg-paper p-4 shadow-[0_24px_50px_-24px_rgba(35,24,18,0.55)]">
      <p className="font-display text-lg font-extrabold">{t("Sepetin")}</p>
      <div className="mt-3 space-y-3">
        {lines.map((line) => (
          <div key={line.name} className="flex items-start justify-between gap-3 border-b border-line pb-3">
            <div>
              <p className="text-sm font-medium">{line.name}</p>
              {line.note && <p className="text-[11px] text-ink-soft">{line.note}</p>}
              <span className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-line px-2 py-0.5 font-mono text-[11px]">
                − <span className="w-3 text-center">{line.qty}</span> +
              </span>
            </div>
            <p className="font-mono text-xs font-medium">{line.price}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{t("Toplam")}</span>
        <span className="font-display text-xl font-bold">855₺</span>
      </div>
      <p className="mt-3 rounded-2xl bg-crema/70 px-3 py-2.5 text-center text-[11px] text-ink-soft">
        {t("Siparişini vermek için bu ekranı garsona göster.")}
      </p>
    </div>
  );
}

/** Panelin analiz ekranlarından örnek: ürün ilgisi + QR hunisi. */
function AnalyticsProof({ t }: { t: Translator }) {
  const products = [
    { name: t("Izgara Köfte"), value: 100, note: t("%{n} sepet", { n: 34 }) },
    { name: t("San Sebastian"), value: 82, note: t("%{n} sepet", { n: 29 }) },
    { name: t("Mantarlı Risotto"), value: 52, note: t("%{n} sepet", { n: 6 }) },
  ];
  return (
    <div className="rounded-2xl border border-line bg-paper p-4 shadow-[0_18px_40px_-28px_rgba(35,24,18,0.5)]">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">{t("Panel · Analiz")}</p>
        <span className="rounded-full bg-crema px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-soft">
          {t("örnek veri")}
        </span>
      </div>
      <p className="mt-2 font-display text-sm font-bold">{t("En çok görüntülenen ürünler")}</p>
      <ul className="mt-3 space-y-2.5">
        {products.map((item) => (
          <li key={item.name}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium">{item.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-soft">{item.note}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-crema">
              <div className="h-full rounded-full bg-paprika" style={{ width: `${item.value}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-line p-3">
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-soft">
          <QrCodeIcon size={11} /> {t("QR hunisi · Masa 4")}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center">
          {[
            ["38", t("tarama")],
            ["36", t("menü")],
            ["29", t("ürün")],
            ["21", t("sepet")],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-crema/60 py-1.5">
              <p className="font-display text-sm font-bold">{value}</p>
              <p className="font-mono text-[8px] uppercase tracking-wider text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-ink-soft">
        {t("Risotto çok bakılıyor ama sepete girmiyor → fiyatını ya da görselini gözden geçirin.")}
      </p>
    </div>
  );
}

export function ProblemSolution({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);

  const outcomes: {
    problem: string;
    solution: string;
    body: string;
    points: string[];
    proofLabel: string;
    proof: ReactNode;
  }[] = [
    {
      problem: t("Fiyat değişince menü yeniden basılıyor"),
      solution: t("Anlık fiyat ve ürün güncelleme"),
      body: t(
        "Zam geldiğinde matbaa beklemezsiniz. Panelde değiştirdiğiniz fiyat, açık olan bütün menülerde sayfa yenilenmeden görünür."
      ),
      points: [t("Tükenen ürünü tek dokunuşla gizleyin"), t("Şefin önerisi ve kampanyayı öne çıkarın")],
      proofLabel: t("Panelde kaydet → menüde anında"),
      proof: <PriceUpdateProof t={t} />,
    },
    {
      problem: t("Garson siparişi yanlış ya da eksik alabiliyor"),
      solution: t("Sepet oluşturup garsona gösterme"),
      body: t(
        "Müşteri beğendiklerini seçenekleriyle birlikte sepete ekler, toplamı görür ve ekranı garsona gösterir. Siparişi yine garsonunuz alır; düzeniniz değişmez."
      ),
      points: [t("Boy, ekstra malzeme gibi seçenekler sepette yazılı"), t("Toplam tutar müşterinin önünde")],
      proofLabel: t("Gerçek müşteri ekranı: sepet sayfası"),
      proof: <CartProof t={t} />,
    },
    {
      problem: t("Hangi ürünün ilgi gördüğü bilinmiyor"),
      solution: t("Ürün ve QR performans analizi"),
      body: t(
        "Hangi ürün inceleniyor ama sepete girmiyor, hangi masadaki QR menüyü açtırıyor — tahmin yerine panelde görürsünüz."
      ),
      points: [t("Ürün bazında görüntülenme ve sepete ekleme"), t("QR bazında tarama → menü → ürün → sepet hunisi")],
      proofLabel: t("Panel ekranından örnek"),
      proof: <AnalyticsProof t={t} />,
    },
  ];

  return (
    <section id={sectionId("why")} className="border-b border-line bg-crema/40">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal className="max-w-2xl">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Neden BUYUR")}</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("Basılı menünün çözemediği üç sorun")}
          </h2>
          <p className="mt-4 text-ink-soft">
            {t(
              "Uzun bir özellik listesi değil: buyur'un işletmenize kazandırdığı üç sonuç ve her birinin ekranda nasıl göründüğü."
            )}
          </p>
        </div>

        <div className="mt-14 space-y-5">
          {outcomes.map((row, index) => (
            <article
              key={row.solution}
              data-reveal
              className="grid items-center gap-8 rounded-3xl border border-line bg-paper p-6 transition-shadow duration-300 hover:shadow-[0_24px_50px_-34px_rgba(35,24,18,0.5)] sm:p-9 lg:grid-cols-2 lg:gap-14"
            >
              <div>
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  <span className="text-paprika">0{index + 1}</span> {t("Sorun")}
                </p>
                <p className="mt-1.5 text-lg text-ink-soft">{row.problem}</p>
                <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-herb">{t("BUYUR çözümü")}</p>
                <h3 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight md:text-3xl">{row.solution}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{row.body}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {row.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-herb" aria-hidden>
                        <CheckCircleIcon size={15} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="transition-transform duration-500 hover:-translate-y-1">
                {row.proof}
                <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {row.proofLabel}
                </figcaption>
              </figure>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Nasıl çalışır ───────────────────────────────────────────
   Üç adım anlaşılır; asıl itirazlar ise "menüyü kim girecek, QR'ı kim
   basacak". İki kurulum yolu + itirazların cevabı. */

function SetupPath({
  title,
  badge,
  steps,
  children,
}: {
  title: string;
  badge: string;
  steps: { title: string; desc: string }[];
  children: ReactNode;
}) {
  return (
    <div data-reveal className="flex flex-col rounded-3xl border border-paper/12 bg-paper/[0.04] p-7 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-2xl font-bold">{title}</h3>
        <span className="rounded-full border border-paprika/50 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-paprika">
          {badge}
        </span>
      </div>
      <ol className="mt-6 flex-1 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paprika font-mono text-[12px] text-paper">
              {index + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-paper/60">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function HowItWorks({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteTranslator(locale);

  const selfSetup = [
    { title: t("Hesabını aç"), desc: t("E-postanla kaydol, işletme türünü seç: kategorilerin hazır gelir.") },
    {
      title: t("Ürünlerini ekle"),
      desc: t("Fiyat, görsel, alerjen, hazırlanma süresi. İlk birkaç ürünle menün yayında; kılavuz her adımı gösterir."),
    },
    { title: t("QR'ı masaya koy"), desc: t("QR'ını indir ya da masa numaralı QR'ları toplu PDF al, bastır.") },
  ];

  const doneForYou = [
    { title: t("Menünü gönder"), desc: t("Mevcut menünün fotoğrafını ya da PDF'ini WhatsApp'tan yolla.") },
    { title: t("Demo menün hazırlansın"), desc: t("Ekibimiz ürünlerini ve fiyatlarını girip menünü sana gösterir.") },
    { title: t("Onayla, yayına al"), desc: t("Beğendiysen hesabın hazır; QR'ını basıp masaya koyarsın.") },
  ];

  const objections = [
    {
      q: t("Mevcut menüyü kim girecek?"),
      a: t(
        "İsterseniz siz — ürün eklemek fotoğraf paylaşmak kadar kolay. İsterseniz menünüzü gönderin, demo menünüzü biz hazırlayalım."
      ),
    },
    {
      q: t("QR baskısını kim hazırlayacak?"),
      a: t(
        "QR kodunuz panelde hazır. Tek QR'ı PNG indirin ya da masa numaralı QR'ları toplu PDF alıp yazıcıya/matbaaya gönderin."
      ),
    },
    {
      q: t("Menüde yüzlerce ürün varsa?"),
      a: t(
        "Ürün ve kategori sınırı yok, Freemium dahil. Kategorileri sürükle-bırak sıralayın; müşteri aradığını menü içi aramayla bulur."
      ),
    },
    {
      q: t("Teknik destek var mı?"),
      a: t("Evet. Panelden destek talebi açabilir ya da WhatsApp'tan yazabilirsiniz. Elite'te teknik destek önceliklidir."),
    },
    {
      q: t("Aynı gün yayına girebilir miyim?"),
      a: t("Evet. Kaydolduğunuz anda menü adresiniz ve QR'ınız oluşur; ürünleri girdiğiniz an menünüz yayındadır."),
    },
    {
      q: t("Müşteri uygulama indirmek zorunda mı?"),
      a: t("Hayır. QR'ı telefon kamerasıyla okutmak yeterli; menü tarayıcıda açılır, hesap ya da uygulama gerekmez."),
    },
  ];

  return (
    <section id={sectionId("how")} className="border-y border-line bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal>
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">{t("Nasıl çalışır")}</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("İki yoldan birini seçin, menünüz bugün yayında")}
          </h2>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <SetupPath title={t("Kendin kur")} badge={t("5 dakika")} steps={selfSetup}>
            <Link
              href="/panel/register"
              data-track="cta_click"
              data-track-location="how_it_works"
              data-track-cta="create_free"
              className="shine-on-hover relative block overflow-hidden rounded-md bg-paprika px-8 py-3.5 text-center font-mono text-[13px] uppercase tracking-wider text-paper transition-all duration-300 hover:-translate-y-0.5 hover:bg-paprika-deep"
            >
              {t("Ücretsiz menünü oluştur")}
            </Link>
          </SetupPath>

          <SetupPath title={t("Biz kuralım")} badge={t("Demo menü bizden")} steps={doneForYou}>
            <a
              href={whatsappLink(t("Merhaba! Menümü göndermek istiyorum, benim için demo menü hazırlayabilir misiniz?"))}
              target="_blank"
              rel="noopener noreferrer"
              data-track="whatsapp_lead"
              data-track-location="how_it_works"
              className="flex items-center justify-center gap-2 rounded-md border border-paper/40 px-8 py-3.5 text-center font-mono text-[13px] uppercase tracking-wider text-paper transition-all duration-300 hover:-translate-y-0.5 hover:border-paper hover:bg-paper hover:text-ink"
            >
              <WhatsappIcon size={15} />
              {t("Menümü WhatsApp'tan gönder")}
            </a>
          </SetupPath>
        </div>

        <div className="mt-20">
          <h3 data-reveal className="font-display text-2xl font-bold">
            {t("Aklınıza takılanlar")}
          </h3>
          <dl className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {objections.map((item, index) => (
              <div
                key={item.q}
                data-reveal
                style={{ transitionDelay: `${(index % 3) * 80}ms` }}
                className="border-t border-paper/15 pt-5"
              >
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-paper/60">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
