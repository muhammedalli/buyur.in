import QRCode from "qrcode";

// Ortasında işletme logosu olan QR. Hata düzeltme seviyesi H (~%30 kayıp tolere edilir);
// logo plakası alanın ~%20'sini kaplar, yani okunabilirlik payı kalır. Logo yüklenemezse
// (ağ, CORS, logo yok) QR logosuz üretilir — QR'ın çalışması logoya bağlı olmamalı.

const DARK = "#231812";
const LIGHT = "#ffffff";
const MARGIN = 2; // modül cinsinden sessiz bölge
const PLATE_RATIO = 0.28; // plaka kenarı / QR kenarı
const LOGO_INSET = 0.1;  // plaka içinde logo boşluğu

export interface QrRenderOptions {
  url: string;
  /** Boşsa logosuz üretilir. */
  logoUrl?: string;
}

interface Layout {
  count: number;
  total: number;
  isDark: (row: number, col: number) => boolean;
}

function layoutFor(url: string, withLogo: boolean): Layout {
  const qr = QRCode.create(url, { errorCorrectionLevel: withLogo ? "H" : "M" });
  const count = qr.modules.size;
  return {
    count,
    total: count + MARGIN * 2,
    isDark: (row, col) => qr.modules.get(row, col) === 1,
  };
}

// Logoyu veri adresine çevirir: SVG'ye gömülebilir ve canvas'ı kirletmez (PNG indirme çalışır).
async function loadLogo(logoUrl: string | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Vektör QR (baskı için) — her boyutta net. */
export async function renderQrSvg({ url, logoUrl }: QrRenderOptions): Promise<string> {
  const logo = await loadLogo(logoUrl);
  const { count, total, isDark } = layoutFor(url, Boolean(logo));

  let path = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (isDark(r, c)) path += `M${c + MARGIN} ${r + MARGIN}h1v1h-1z`;
    }
  }

  let overlay = "";
  if (logo) {
    const plate = total * PLATE_RATIO;
    const start = (total - plate) / 2;
    const inset = plate * LOGO_INSET;
    overlay =
      `<rect x="${start}" y="${start}" width="${plate}" height="${plate}" rx="${plate * 0.22}" fill="${LIGHT}"/>` +
      `<image href="${logo}" x="${start + inset}" y="${start + inset}" width="${plate - inset * 2}" height="${plate - inset * 2}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${LIGHT}"/>` +
    `<path d="${path}" fill="${DARK}"/>${overlay}</svg>`
  );
}

/** PNG veri adresi (ekranda gösterme ve indirme). */
export async function renderQrPng({ url, logoUrl }: QrRenderOptions, size = 640): Promise<string> {
  const logo = await loadLogo(logoUrl);
  const img = logo ? await loadImage(logo) : null;
  const { count, total, isDark } = layoutFor(url, Boolean(img));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas desteklenmiyor.");

  const cell = size / total;
  ctx.fillStyle = LIGHT;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = DARK;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (isDark(r, c)) {
        // Hücre kenarlarında ince çizgi kalmasın diye yukarı yuvarlanır.
        ctx.fillRect(
          Math.floor((c + MARGIN) * cell),
          Math.floor((r + MARGIN) * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }

  if (img) {
    const plate = size * PLATE_RATIO;
    const start = (size - plate) / 2;
    const radius = plate * 0.22;
    ctx.fillStyle = LIGHT;
    ctx.beginPath();
    ctx.roundRect(start, start, plate, plate, radius);
    ctx.fill();

    // Logo plakaya oranı bozulmadan sığar.
    const box = plate * (1 - LOGO_INSET * 2);
    const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  }

  return canvas.toDataURL("image/png");
}
