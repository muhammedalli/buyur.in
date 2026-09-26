"use client";

import { useBusiness } from "@/components/panel/business-context";
import { LockIcon } from "@/components/icons";
import { isSuspended } from "@/lib/business-suspension";
import { menuHost, whatsappLink } from "@/lib/site";

/** Yönetimden askıya alınan hesabın sahibine gösterilen bant. Panel açık kalır
 *  (menüsünü düzenleyebilir, verisine ulaşır); yalnızca yayın kapalıdır. Sahip
 *  neden kapandığını ve kime yazacağını bilmeli, yoksa menüsünün bozulduğunu sanır. */
export function SuspensionBanner() {
  const { business } = useBusiness();
  if (!business || !isSuspended(business)) return null;

  const contact = whatsappLink(
    `Merhaba! ${business.name}${business.slug ? ` (${menuHost(business.slug)})` : ""} hesabım askıya alınmış görünüyor, bilgi alabilir miyim?`
  );

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-md border border-paprika/40 bg-paprika/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-paprika" aria-hidden>
          <LockIcon size={18} />
        </span>
        <div>
          <p className="font-display text-sm font-bold">Menün şu anda yayında değil</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Hesabın buyur ekibi tarafından askıya alındı; müşterilerin menünü göremiyor. Verilerin yerinde duruyor.
            {business.suspension_reason ? ` Gerekçe: ${business.suspension_reason}` : ""}
          </p>
        </div>
      </div>
      <a
        href={contact}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-md bg-ink px-5 py-2.5 text-center font-mono text-[12px] uppercase tracking-wider text-paper transition-colors hover:bg-paprika"
      >
        Bize yazın
      </a>
    </div>
  );
}
