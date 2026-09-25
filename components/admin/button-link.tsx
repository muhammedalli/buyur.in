"use client";

import Link from "next/link";
import { buttonClass } from "@/components/panel/ui";

// Buton görünümlü bağlantı. Yönetim sayfaları sunucu bileşenidir;
// buttonClass() istemci modülünden geldiği için orada çağrılamaz, bu bileşen
// üzerinden kullanılır.
export function ButtonLink({
  href,
  variant = "outline",
  className = "",
  children,
}: {
  href: string;
  variant?: "primary" | "outline" | "ghost" | "danger";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
