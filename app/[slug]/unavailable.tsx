import Link from "next/link";
import type { Business } from "@/lib/types";
import { businessLogoUrl } from "@/lib/files";

// Freemium limiti dolan işletmenin menüsü yerine gösterilen sayfa.
// Hiçbir veri silinmez: menü, ürünler ve analizler yerinde durur; sahibi plana
// geçtiği anda menü yeniden yayına girer. Müşteriye teknik detay verilmez.
export function MenuUnavailable({ business }: { business: Business }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper px-6 text-center">
      {businessLogoUrl(business, "small") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={businessLogoUrl(business, "small")} alt={business.name} className="h-16 w-16 rounded-2xl object-cover" />
      ) : null}

      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{business.name}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          Dijital menü şu anda görüntülenemiyor. Lütfen personelden yardım isteyin.
        </p>
      </div>

      {business.phone && (
        <a
          href={`tel:${business.phone.replace(/\s/g, "")}`}
          className="rounded-md border border-ink px-6 py-3 font-mono text-[13px] uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
        >
          {business.phone}
        </a>
      )}

      <Link
        href="https://buyur.in"
        className="font-mono text-[11px] uppercase tracking-wider text-ink-soft/70 transition-colors hover:text-paprika"
      >
        BUYUR ile hazırlandı
      </Link>
    </main>
  );
}
