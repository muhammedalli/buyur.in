import type { Metadata } from "next";

// Sıfırlama belirteci adres çubuğunda geldiği için bu sayfadan çıkan hiçbir
// istek Referer taşımamalı (sayfa belirteci ayrıca adresten siliyor).
export const metadata: Metadata = {
  title: "Yeni şifre belirle | buyur",
  referrer: "no-referrer",
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
