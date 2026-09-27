import type { CSSProperties, ReactNode } from "react";

// Sonsuz kayan yazı şeridi — pazarlama sitesinde, işletme sitesinde, karşılama
// sayfasında ve müşteri menüsünde aynı bileşen.
//
// Performans: yalnızca CSS (transform animasyonu, compositor'da çalışır);
// JavaScript ve ölçüm yok, sunucuda da render edilebilir. İçerik kısa olsa bile
// boşluk kalmasın diye bir "kopya" en az ~MIN_COPY_CHARS karakter olacak kadar
// tekrarlanır; iz iki kopyadan oluşur ve -50% kayar (dikişsiz döngü).
// Hız içerik uzunluğundan hesaplanır: mesaj sayısı değişse de akış hızı sabit
// ve okunur kalır. Fare üstündeyken/klavye odağındayken durur; hareketi
// azaltmayı seçen kullanıcıda animasyon yoktur, mesajlar sarılarak görünür.

const MIN_COPY_CHARS = 90;
/** Karakter başına saniye: ~35px/sn civarı — okunur, göz yormaz. */
const SECONDS_PER_CHAR = 0.19;
const MIN_DURATION_S = 12;

export type MarqueeTone = "brand" | "ink" | "soft" | "bare";

const TONES: Record<MarqueeTone, { bar: string; text: string; separator: string }> = {
  // İşletmenin kendi rengi (menü/site kapsamında --brand tanımlı).
  brand: { bar: "bg-[var(--brand)]", text: "text-[var(--brand-on)]", separator: "opacity-70" },
  ink: { bar: "bg-ink border-y border-ink/15", text: "text-paper/75", separator: "text-paprika" },
  soft: { bar: "bg-crema/70 border-y border-line/60", text: "text-ink", separator: "text-[var(--brand-text,var(--color-paprika))]" },
  // Zemini çağıran verir (ör. renkli bir bölümün içinde hap öğeler).
  bare: { bar: "", text: "text-current", separator: "opacity-60" },
};

export function Marquee({
  items,
  tone = "brand",
  label,
  separator = "✦",
  className = "",
  itemClassName = "font-mono text-[11px] uppercase tracking-wider",
  renderItem,
}: {
  items: string[];
  tone?: MarqueeTone;
  /** Ekran okuyucu için şeridin adı ("Duyurular"). */
  label: string;
  separator?: ReactNode;
  className?: string;
  itemClassName?: string;
  /** Öğe biçimi özelse (ör. hap görünümü). Verilmezse düz metin + ayırıcı. */
  renderItem?: (item: string) => ReactNode;
}) {
  if (items.length === 0) return null;

  const chars = items.reduce((sum, item) => sum + item.length + 4, 0);
  const reps = Math.max(1, Math.ceil(MIN_COPY_CHARS / Math.max(chars, 1)));
  const copy = Array.from({ length: reps }, () => items).flat();
  const duration = Math.max(MIN_DURATION_S, Math.round(chars * reps * SECONDS_PER_CHAR));
  const palette = TONES[tone];

  return (
    <section aria-label={label} className={`marquee-mask marquee-pause overflow-hidden ${palette.bar} ${className}`}>
      {/* Mesajların tek, sabit kopyası: ekran okuyucu bunu okur (kayan kopyalar
          gizli). Hareketi azaltmayı seçen kullanıcıda görünür olur, şerit durur. */}
      <ul className={`marquee-static ${palette.text} ${itemClassName}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div
        aria-hidden
        className="marquee-track flex w-max"
        style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      >
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center">
            {copy.map((item, index) =>
              renderItem ? (
                <span key={`${dup}-${index}`} className="flex shrink-0 items-center">
                  {renderItem(item)}
                </span>
              ) : (
                <span
                  key={`${dup}-${index}`}
                  className={`flex shrink-0 items-center gap-5 whitespace-nowrap pe-5 ${palette.text} ${itemClassName}`}
                >
                  {item}
                  <span className={palette.separator}>{separator}</span>
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
