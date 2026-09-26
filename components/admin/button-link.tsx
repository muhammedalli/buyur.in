"use client";

import Link from "next/link";
import { buttonClass } from "@/components/panel/ui";

// Buton görünümlü bağlantı. Yönetim sayfaları sunucu bileşenidir;
// buttonClass() istemci modülünden geldiği için orada çağrılamaz, bu bileşen
// üzerinden kullanılır.
export function ButtonLink({
  href,
  variant = "outline",
  size = "md",
  className = "",
  external = false,
  children,
}: {
  href: string;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "md" | "sm";
  className?: string;
  /** Yeni sekmede açılan dış bağlantı (ör. canlı menü). */
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={buttonClass(variant, className, size)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, className, size)}>
      {children}
    </Link>
  );
}
