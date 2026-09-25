import type { Metadata } from "next";

// Yönetim paneli admin.buyur.in'de yaşar (bkz. middleware.ts) ve arama
// motorlarına kapalıdır.
export const metadata: Metadata = {
  title: "Yönetim",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
