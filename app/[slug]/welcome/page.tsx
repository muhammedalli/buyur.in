"use client";

import Link from "next/link";
import { useMenu } from "@/components/menu/menu-provider";
import { BusinessInfoContent } from "@/components/menu/business-info";
import { MessageIcon } from "@/components/icons";

// Karşılama sayfası: işletme bilgileri + menüye geçiş. İçerik menüdeki bilgi
// yaprağıyla aynı bileşenden gelir — iki yerde ayrı ayrı bakım yapılmasın.

export default function WelcomePage() {
  const { business, base, t } = useMenu();

  return (
    <div className="mx-auto max-w-lg px-5 pb-10 pt-5 sm:px-6 sm:pt-6">
      <BusinessInfoContent business={business} />

      <Link
        href={`${base}/menu`}
        className="mt-8 block w-full rounded-md py-4 text-center font-display text-lg font-bold shadow-lg transition-opacity hover:opacity-90"
        style={{ background: "var(--brand)", color: "var(--brand-on)" }}
      >
        {t("menuButton")}
      </Link>

      <Link
        href={`${base}/review`}
        className="mx-auto mt-5 flex w-fit items-center gap-2 text-sm font-semibold text-ink transition-colors hover:opacity-70"
      >
        <MessageIcon size={16} />
        {t("reviewUsCta")}
      </Link>
    </div>
  );
}
