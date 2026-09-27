"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { menuUrl as buildMenuUrl } from "@/lib/site";
import { mainQrUrl } from "@/lib/storefront";
import { useUiLocale } from "@/components/ui-locale-provider";
import { Button, Card } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { useBusiness } from "@/components/panel/business-context";
import { markActivation } from "@/lib/activation";
import { QrCodeIcon } from "@/components/icons";
import type { Business } from "@/lib/types";

// QR kod + paylaşım kartı. Genel bakış sayfasına gömülüdür.
// Paylaşılan link vitrindir (isletme.buyur.in: site ya da karşılama sayfası);
// QR ise masada okutulur ve doğrudan menüyü açar (lib/storefront.ts → mainQrUrl).
export function QrShare({ business }: { business: Business }) {
  const { t } = useUiLocale();
  const { toast } = useToast();
  const { setBusiness } = useBusiness();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuUrl, setMenuUrl] = useState("");

  useEffect(() => {
    setMenuUrl(buildMenuUrl(business.slug));
    QRCode.toDataURL(mainQrUrl(business.slug), {
      width: 640,
      margin: 2,
      color: { dark: "#231812", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [business.slug]);

  async function handleCopy() {
    await navigator.clipboard.writeText(menuUrl);
    toast(t("Link kopyalandı"));
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: business.name, url: menuUrl });
      } catch {
        /* kullanıcı iptal etti */
      }
    } else {
      await handleCopy();
    }
  }

  // Aktivasyon metriğinin ilk yarısı: ilk QR indirme.
  async function handleDownload() {
    const updated = await markActivation(business, "qr_downloaded_at");
    if (updated) setBusiness(updated);
  }

  return (
    <Card className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center" data-guide="share">
      <div className="flex shrink-0 items-center justify-center rounded-md border border-line bg-crema/40 p-3">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={t("Menü QR kodu")} className="h-32 w-32" />
        ) : (
          <div className="h-32 w-32 animate-pulse rounded-md bg-crema" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          <QrCodeIcon size={14} /> {t("QR & paylaş")}
        </p>
        <a
          href={menuUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all font-display text-lg font-bold text-paprika hover:underline"
        >
          {menuUrl}
        </a>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button type="button" onClick={handleCopy}>
            {t("Linki kopyala")}
          </Button>
          <Button type="button" variant="outline" onClick={handleShare}>
            {t("Paylaş")}
          </Button>
          {qrDataUrl && (
            <a href={qrDataUrl} download={`${business.slug}-qr.png`} onClick={handleDownload}>
              <Button type="button" variant="outline">
                {t("QR indir")}
              </Button>
            </a>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          {t("Link vitrininizi açar (Instagram biyografisi, WhatsApp, Google için). QR ise masada okutulur ve doğrudan menüyü açar.")}{" "}
          {t("Masa numaralı QR'ları toplu PDF almak için")}{" "}
          <Link href="/panel/qr" className="font-medium text-paprika hover:underline">
            {t("QR kodlar")}
          </Link>{" "}
          {t("sayfasına geç.")}
        </p>
      </div>
    </Card>
  );
}
