"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { sectionId } from "@/lib/landing-sections";
import { EyeIcon, QrCodeIcon, ClockIcon, ShoppingBagIcon } from "@/components/icons";
import { siteClientTranslator } from "@/lib/ui-messages/site-client";
import { msg, uiLocaleTags, type Translator, type UiLocale } from "@/lib/ui-i18n";

/* ─── Grafik paleti ────────────────────────────────────────────
   Marka renklerinden türetildi ve kâğıt zemine (#fbf5ea) karşı
   doğrulandı: en kötü komşu çifti CVD ΔE 9.3 (hedef ≥ 8), normal
   görüş ΔE 16.7 (taban ≥ 15). Slot sırası sabittir — renk kimliği
   taşır, sırayla dağıtılır, asla döngüye sokulmaz.

   series-1 bal sarısı kâğıt zeminde 3:1'in altında kalıyor; bu
   yüzden değerler her yerde okunur etiketlerle birlikte veriliyor
   (renk tek başına hiçbir bilgiyi taşımıyor).
──────────────────────────────────────────────────────────────── */
const vizTokens = {
  "--series-1": "#d99700",
  "--series-2": "#e8491f",
  "--series-3": "#2a6fb0",
  "--series-4": "#1f9d55",
  "--viz-surface": "#fbf5ea",
  "--viz-grid": "#e6dac6",
  "--viz-axis": "#c9b9a0",
} as CSSProperties;

/* ─── Yardımcılar ─────────────────────────────────────────── */

// Fritsch–Carlson monoton kübik: veriyi aşmayan yumuşak bir çizgi
// üretir (klasik Catmull-Rom tepe noktalarında taşar ve değeri
// yanlış gösterir).
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 2) return "";

  const dx = pts.slice(0, -1).map((p, i) => pts[i + 1].x - p.x);
  const slope = pts.slice(0, -1).map((p, i) => (pts[i + 1].y - p.y) / dx[i]);

  const m = new Array<number>(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${pts[i].x + h} ${pts[i].y + m[i] * h} ${pts[i + 1].x - h} ${
      pts[i + 1].y - m[i + 1] * h
    } ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

/** Bölümün dil bağlamı: çevirmen + sayı biçimi. Alt bileşenlere tek nesneyle geçer. */
interface Copy {
  t: Translator;
  num: (value: number) => string;
}

// Görünür olunca sayıyı 0'dan hedefe sayar. Hareketi kapatan
// kullanıcıya son değeri anında verir.
function useCountUp(target: number, duration = 1400) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          // easeOutCubic — hızlı başlar, hedefte yumuşak durur
          setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return { ref, value };
}

/* ─── KPI kartları ────────────────────────────────────────── */

type Tile = {
  label: string;
  target: number;
  display: (v: number, num: (value: number) => string) => string;
  delta: string;
  icon: (p: { size?: number }) => ReactNode;
  spark: number[];
};

const tiles: Tile[] = [
  {
    label: msg("Menü görüntülenme"),
    target: 12480,
    display: (v, num) => num(v),
    delta: "+%38",
    icon: EyeIcon,
    spark: [22, 30, 26, 38, 44, 40, 52, 58, 55, 68, 79, 92],
  },
  {
    label: msg("QR taraması"),
    target: 3281,
    display: (v, num) => num(v),
    delta: "+%24",
    icon: QrCodeIcon,
    spark: [30, 34, 41, 38, 46, 52, 49, 58, 63, 61, 72, 80],
  },
  {
    label: msg("Ortalama inceleme"),
    target: 160,
    display: (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`,
    delta: "+%12",
    icon: ClockIcon,
    spark: [40, 44, 42, 48, 46, 53, 57, 54, 60, 64, 62, 70],
  },
  {
    label: msg("Sepete eklenen ürün"),
    target: 894,
    display: (v, num) => num(v),
    delta: "+%51",
    icon: ShoppingBagIcon,
    spark: [18, 24, 21, 30, 36, 33, 44, 48, 57, 62, 74, 88],
  },
];

// 12 noktalık kıvılcım çizgisi: geçmiş sönük tonda, son nokta vurguda.
function Sparkline({ data }: { data: number[] }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => ({
    x: (i * w) / (data.length - 1),
    y: h - 3 - ((v - min) / (max - min || 1)) * (h - 6),
  }));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      fill="none"
      aria-hidden
      className="overflow-visible"
    >
      <path
        d={monotonePath(pts)}
        stroke="var(--color-ink)"
        strokeOpacity={0.22}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Son dönem — yüzey renginde 2px halka ile ayrışır */}
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r={4}
        fill="var(--series-2)"
        stroke="var(--viz-surface)"
        strokeWidth={2}
      />
    </svg>
  );
}

function StatTile({ tile, index, copy }: { tile: Tile; index: number; copy: Copy }) {
  const { ref, value } = useCountUp(tile.target);
  const Icon = tile.icon;

  return (
    <div
      data-reveal
      style={{ transitionDelay: `${index * 70}ms` }}
      className="rounded-2xl border border-line bg-paper p-5 transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(35,24,18,0.5)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-crema p-2 text-ink-soft" aria-hidden>
          <Icon size={16} />
        </span>
        <span className="rounded-full bg-herb/12 px-2 py-0.5 font-mono text-[10px] font-medium text-herb">
          {tile.delta}
        </span>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
        {copy.t(tile.label)}
      </p>

      <div className="mt-1 flex items-end justify-between gap-3">
        {/* Büyük tek sayı: orantılı rakamlar (tabular-nums burada gevşek durur) */}
        <p ref={ref} className="font-display text-3xl font-extrabold tracking-tight">
          {tile.display(value, copy.num)}
        </p>
        <Sparkline data={tile.spark} />
      </div>
      <p className="mt-2 font-mono text-[10px] text-ink-soft/70">
        {copy.t("geçen aya göre")}
      </p>
    </div>
  );
}

/* ─── 1. Çizgi grafiği: aylık görüntülenme ────────────────── */

// Son 12 ay (Şubat → Ocak). Kısaltmalar katalogdan gelir, Intl'den değil:
// sunucu ile tarayıcının ICU verisi farklıysa ("Şub" / "Şub.") hydration bozulurdu.
const MONTHS = [
  msg("Şub"),
  msg("Mar"),
  msg("Nis"),
  msg("May"),
  msg("Haz"),
  msg("Tem"),
  msg("Ağu"),
  msg("Eyl"),
  msg("Eki"),
  msg("Kas"),
  msg("Ara"),
  msg("Oca"),
];
const views = [820, 940, 880, 1120, 1240, 1180, 1460, 1620, 1540, 1880, 2140, 2380];

const LW = 660;
const LH = 250;
const LP = { t: 18, r: 58, b: 34, l: 46 };
const lPlotW = LW - LP.l - LP.r;
const lPlotH = LH - LP.t - LP.b;
const Y_MAX = 2400;
const yTicks = [0, 800, 1600, 2400];

const lx = (i: number) => LP.l + (i * lPlotW) / (views.length - 1);
const ly = (v: number) => LP.t + lPlotH * (1 - v / Y_MAX);
const linePts = views.map((v, i) => ({ x: lx(i), y: ly(v) }));
const lineD = monotonePath(linePts);
const areaD = `${lineD} L ${lx(views.length - 1)} ${ly(0)} L ${lx(0)} ${ly(0)} Z`;

function ViewsChart({ copy, months }: { copy: Copy; months: string[] }) {
  const { t, num } = copy;
  const pathRef = useRef<SVGPathElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  // Çizgiyi tam boyunda çizdirmek için gerçek uzunluğu ölç.
  useEffect(() => {
    const p = pathRef.current;
    if (p) p.style.setProperty("--len", String(p.getTotalLength()));
  }, []);

  const active = hover === null ? null : linePts[hover];

  return (
    <div
      data-reveal
      className="chart relative flex h-full flex-col rounded-2xl border border-line bg-paper p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold">{t("Menü görüntülenmeleri")}</h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {t("Son 12 ay")}
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{t("Örnek veri")}</p>
      </div>

      <div className="relative mt-5">
        <svg viewBox={`0 0 ${LW} ${LH}`} className="w-full" role="img"
          aria-label={t("Son 12 ayda menü görüntülenmeleri {from} seviyesinden {to} seviyesine yükseldi.", { from: num(820), to: num(2380) })}>
          {/* Izgara — kıl payı, düz, zeminden bir ton uzakta */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={LP.l}
              x2={LW - LP.r}
              y1={ly(tick)}
              y2={ly(tick)}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />
          ))}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={LP.l - 10}
              y={ly(tick) + 4}
              textAnchor="end"
              className="fill-ink-soft font-mono text-[11px] tabular-nums"
            >
              {num(tick)}
            </text>
          ))}

          {/* Alan dolgusu — doygun blok değil, %10'luk bir yıkama */}
          <path d={areaD} fill="var(--series-2)" fillOpacity={0.1} data-fade
            style={{ animationDelay: "0.9s" }} />

          <path
            ref={pathRef}
            d={lineD}
            data-line
            fill="none"
            stroke="var(--series-2)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Yalnızca son nokta doğrudan etiketli — her noktaya değer yazmak okunmaz */}
          <g data-fade style={{ animationDelay: "1.3s" }}>
            <circle
              cx={lx(views.length - 1)}
              cy={ly(views[views.length - 1])}
              r={4.5}
              fill="var(--series-2)"
              stroke="var(--viz-surface)"
              strokeWidth={2}
            />
            <text
              x={lx(views.length - 1) + 12}
              y={ly(views[views.length - 1]) + 4}
              className="fill-ink font-mono text-[12px] font-semibold tabular-nums"
            >
              {num(views[views.length - 1])}
            </text>
          </g>

          {/* Ay etiketleri — dar ekranda her ikinci ay */}
          {months.map((m, i) => (
            <text
              key={m}
              x={lx(i)}
              y={LH - 10}
              textAnchor="middle"
              className={`fill-ink-soft font-mono text-[10px] ${
                i % 2 === 1 ? "hidden sm:inline" : ""
              }`}
            >
              {m}
            </text>
          ))}

          {/* İmleç çizgisi */}
          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1={LP.t}
              y2={LP.t + lPlotH}
              stroke="var(--viz-axis)"
              strokeWidth={1}
            />
          )}
          {active && (
            <circle
              cx={active.x}
              cy={active.y}
              r={5}
              fill="var(--series-2)"
              stroke="var(--viz-surface)"
              strokeWidth={2}
            />
          )}

          {/* Hedef alanları noktadan geniş: imleç şeridin herhangi bir yerinde olabilir */}
          {views.map((_, i) => (
            <rect
              key={i}
              x={lx(i) - lPlotW / (views.length - 1) / 2}
              y={LP.t}
              width={lPlotW / (views.length - 1)}
              height={lPlotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {/* Bilgi balonu — değeri kilitlemez, tablo ve uç etiketi zaten var */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-lg border border-line bg-paper px-2.5 py-1.5 shadow-[0_10px_24px_-10px_rgba(35,24,18,0.5)]"
            style={{
              left: `${(linePts[hover].x / LW) * 100}%`,
              top: `${(linePts[hover].y / LH) * 100}%`,
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              {months[hover]}
            </p>
            <p className="font-display text-sm font-bold tabular-nums">
              {t("{count} görüntülenme", { count: num(views[hover]) })}
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-4 border-t border-line pt-4">
        {[
          [t("En yoğun gün"), t("Cumartesi")],
          [t("En yoğun saat"), "20:00–22:00"],
          [t("Yeni ziyaretçi"), t("%{n}", { n: 64 })],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
              {k}
            </p>
            <p className="mt-0.5 font-display text-sm font-bold">{v}</p>
          </div>
        ))}
      </div>

      {/* Grafiğin tablo ikizi — her değer renk gerektirmeden okunabilir */}
      <table className="sr-only">
        <caption>{t("Aylara göre menü görüntülenmeleri")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Ay")}</th>
            <th scope="col">{t("Görüntülenme")}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m}>
              <th scope="row">{m}</th>
              <td>{num(views[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── 2. Bar grafiği: en çok görüntülenen ürünler ─────────── */

const topProducts = [
  { name: msg("Izgara Köfte"), v: 1840 },
  { name: msg("San Sebastian"), v: 1510 },
  { name: msg("Türk Kahvesi"), v: 1275 },
  { name: msg("Mantarlı Risotto"), v: 960 },
  { name: msg("Mevsim Salatası"), v: 720 },
];
const pMax = Math.max(...topProducts.map((p) => p.v));

// Adlandırılmış kategoriler — sıraları anlamı değiştirmez, yani tek
// seri: hepsi aynı rengi giyer. Uzunluk zaten büyüklüğü gösteriyor,
// rengi de aynı bilgiye harcamanın anlamı yok.
function TopProductsChart({ copy }: { copy: Copy }) {
  const { t, num } = copy;
  return (
    <div
      data-reveal
      className="chart flex h-full flex-col rounded-2xl border border-line bg-paper p-5 sm:p-6"
    >
      <h3 className="font-display text-lg font-bold">{t("En çok bakılan ürünler")}</h3>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
        {t("Bu ay · görüntülenme")}
      </p>

      <ul className="mb-6 mt-6 space-y-5">
        {topProducts.map((p, i) => (
          <li key={p.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{t(p.name)}</span>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-ink-soft">
                {num(p.v)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-crema">
              <div
                data-bar-x
                style={{
                  width: `${(p.v / pMax) * 100}%`,
                  background: "var(--series-2)",
                  animationDelay: `${0.1 + i * 0.09}s`,
                }}
                className="h-2 rounded-r-[4px]"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-auto border-t border-line pt-4 text-xs leading-relaxed text-ink-soft">
        {t("Hangi ürün ilgi görüyor, hangisi menüde boşuna duruyor — tahmin etmeyin, görün.")}
      </p>
    </div>
  );
}

/* ─── 3. Yığılmış bar: trafik nereden geliyor ─────────────── */

// Renkler slot sırasıyla dağıtıldı (1→4); yığın da aynı sırada
// diziliyor, böylece yan yana gelen çiftler doğrulanmış çiftler.
//
// inline: değeri segmentin içinde yazdırmak yalnızca hem genişliğin
// yettiği hem de yazının dolgu üzerinde 4.5:1'i geçtiği yerde mümkün.
// Bal sarısında mürekkep 6.92:1 veriyor; paprika ne beyazla (3.89) ne
// mürekkeple (4.46) eşiği geçtiği için onun değeri yalnızca göstergede
// duruyor. Zaten her değer aşağıdaki göstergede yazılı.
const sources = [
  { label: msg("QR kod"), v: 52, slot: "var(--series-1)", inline: true },
  { label: "Instagram", v: 24, slot: "var(--series-2)", inline: false },
  { label: "Google", v: 15, slot: "var(--series-3)", inline: false },
  { label: msg("Direkt link"), v: 9, slot: "var(--series-4)", inline: false },
];

function SourcesChart({ copy }: { copy: Copy }) {
  const { t } = copy;
  return (
    <div
      data-reveal
      className="chart grid gap-7 rounded-2xl border border-line bg-paper p-5 sm:p-6 lg:grid-cols-[0.85fr_1.4fr] lg:items-center lg:gap-10"
    >
      <div>
        <h3 className="font-display text-lg font-bold">{t("Müşteri menüye nereden geliyor?")}</h3>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          {t("Bu ay · tüm görüntülenmelerin dağılımı")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {t("QR masada duruyor ama trafiğin yarısı başka yerden geliyor. Menü adresiniz Instagram bio'nuzda da, Google'da da çalışır.")}
        </p>
      </div>

      <div>
        {/* Segmentleri ayıran şey çerçeve değil, zemin renginde 2px boşluk.
            Dolgu ayrı bir katman: etiket ölçeklenen kutunun içinde olsaydı
            animasyon boyunca yazıyla birlikte yamulurdu. */}
        <div className="flex h-8 w-full gap-[2px]">
          {sources.map((s, i) => (
            <div
              key={s.label}
              style={{ width: `${s.v}%` }}
              className="relative flex items-center justify-center overflow-hidden first:rounded-l-md last:rounded-r-md"
            >
              <div
                data-bar-x
                aria-hidden
                style={{ background: s.slot, animationDelay: `${0.1 + i * 0.1}s` }}
                className="absolute inset-0"
              />
              {s.inline && (
                <span className="relative font-mono text-[11px] font-bold text-ink">
                  {t("%{n}", { n: s.v })}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Gösterge — ikiden fazla seri var, kimlik asla renge bırakılmaz;
            değerler burada da yazılı (bal sarısının okunurluk telafisi) */}
        <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-4">
          {sources.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.slot }}
              />
              <span className="min-w-0 truncate text-xs text-ink-soft">{t(s.label)}</span>
              <span className="ml-auto font-mono text-xs font-semibold tabular-nums">
                {t("%{n}", { n: s.v })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Bölüm ───────────────────────────────────────────────── */

export function Analytics({ locale = "tr" }: { locale?: UiLocale }) {
  const t = siteClientTranslator(locale);
  const numberFormat = new Intl.NumberFormat(uiLocaleTags[locale]);
  const copy: Copy = { t, num: (value) => numberFormat.format(value) };
  const months = MONTHS.map((month) => t(month));
  return (
    <section id={sectionId("analytics")} className="border-y border-line bg-crema/40" style={vizTokens}>
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-paprika">
            {t("Analitik ve satış yönlendirme")}
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("Hangi ürünün satıldığını tahmin etmeyin, görün")}
          </h2>
          <p className="mt-4 text-ink-soft">
            {t(
              "Kâğıt menü size hiçbir şey söylemez. buyur, müşterinin neye baktığını ve neyi sepete eklediğini gösterir; şefin önerisini, kampanyayı ve fiyatı buna göre ayarlarsınız."
            )}
          </p>
          {/* Aşağıdaki rakamlar bir sonuç iddiası değil, panel ekranının örneği. */}
          <p className="mt-5 inline-flex rounded-full border border-line bg-paper px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {t("Örnek panel görünümü · rakamlar temsilidir")}
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <StatTile key={tile.label} tile={tile} index={i} copy={copy} />
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ViewsChart copy={copy} months={months} />
          </div>
          <div className="lg:col-span-2">
            <TopProductsChart copy={copy} />
          </div>
        </div>

        <div className="mt-4">
          <SourcesChart copy={copy} />
        </div>

        <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft/70">
          {t("Örnek veriler · Panelinizde kendi rakamlarınızı görürsünüz")}
        </p>
      </div>
    </section>
  );
}
