import { PLATFORM_BRANDING } from "@/lib/branding";

// Platform imzası — menü altbilgisi ve otomatik site aynı bileşeni kullanır.
// Küçük ve sessiz: menünün tasarımıyla yarışmaz. Metin çevrilmiş hâliyle
// dışarıdan gelir (menü/site kendi dil bağlamına sahip).
//
// Bilerek büyük harfe çevrilmez: Türkçe büyük harf kuralı alan adını
// "BUYUR.İN" yapıyordu.

export function PoweredBy({ label, className = "" }: { label: string; className?: string }) {
  return (
    <a
      href={PLATFORM_BRANDING.href}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide text-ink-soft/75 transition-colors hover:text-ink ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-paprika" />
      {label}
    </a>
  );
}
