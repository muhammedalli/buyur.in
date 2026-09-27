"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { useUiLocale } from "@/components/ui-locale-provider";

// Toplu QR baskı sayfası: A4'e 2×3 masa kartı. Kartlar body'nin doğrudan
// çocuğu olarak basılır (globals.css → body.qr-printing), tarayıcının
// "PDF olarak kaydet" seçeneğiyle tek PDF indirilir — ek PDF bağımlılığı yok.
// QR'lar vektör (SVG) üretildiği için her boyutta net basılır.

export interface PrintableQr {
  id: string;
  name: string;
  url: string;
}

export function QrPrintSheet({
  businessName,
  items,
  onDone,
}: {
  businessName: string;
  items: PrintableQr[];
  onDone: () => void;
}) {
  const { t } = useUiLocale();
  const [svgs, setSvgs] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      items.map(
        async (item) =>
          [
            item.id,
            await QRCode.toString(item.url, {
              type: "svg",
              margin: 1,
              errorCorrectionLevel: "M",
              color: { dark: "#231812", light: "#ffffff" },
            }),
          ] as const
      )
    )
      .then((entries) => {
        if (!cancelled) setSvgs(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) onDone();
      });
    return () => {
      cancelled = true;
    };
  }, [items, onDone]);

  useEffect(() => {
    if (!svgs) return;
    document.body.classList.add("qr-printing");

    function finish() {
      document.body.classList.remove("qr-printing");
      onDone();
    }
    window.addEventListener("afterprint", finish, { once: true });
    // Portal DOM'a yerleşsin diye bir kare bekleyip yazdırma penceresini aç.
    const id = window.setTimeout(() => window.print(), 120);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", finish);
      document.body.classList.remove("qr-printing");
    };
  }, [svgs, onDone]);

  if (!svgs) return null;

  return createPortal(
    <div className="qr-print-sheet" aria-hidden>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6mm" }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              breakInside: "avoid",
              height: "80mm",
              border: "1px dashed #c9b9a0",
              borderRadius: "5mm",
              padding: "6mm",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "center",
              color: "#231812",
            }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "13pt", lineHeight: 1.1 }}>
              {businessName}
            </p>
            <div
              style={{ width: "42mm", height: "42mm" }}
              className="[&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svgs[item.id] ?? "" }}
            />
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "19pt", lineHeight: 1 }}>{item.name}</p>
            <p style={{ fontSize: "8.5pt", color: "#5c4a3d" }}>{t("Menüyü görmek için telefon kamerasıyla okutun")}</p>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
