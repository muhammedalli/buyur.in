"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/chrome";
import { FileTextIcon, LayoutIcon, LogoutIcon, SparkIcon, UsersIcon } from "@/components/icons";
import { ToastProvider } from "@/components/panel/toast";
import { ADMIN_ROLE_LABELS, canPerform, type AdminAction } from "@/lib/admin-roles";
import type { AdminRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof LayoutIcon;
  /** Bu işlemi yapamayan rol öğeyi görmez; sayfanın kendisi de requireAdmin ile kilitli. */
  action?: AdminAction;
}

// Yeni bir yönetim ekranı eklendiğinde yalnızca buraya bir satır girer.
const navItems: NavItem[] = [
  { href: "/admin", label: "Genel bakış", Icon: LayoutIcon },
  { href: "/admin/businesses", label: "İşletmeler", Icon: UsersIcon, action: "business.view" },
  { href: "/admin/plans", label: "Planlar", Icon: SparkIcon, action: "plans.edit" },
  { href: "/admin/logs", label: "Denetim kaydı", Icon: FileTextIcon, action: "logs.view" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface AdminShellUser {
  name: string;
  email: string;
  role: AdminRole;
}

export function AdminShell({ admin, children }: { admin: AdminShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const items = navItems.filter((item) => !item.action || canPerform(admin.role, item.action));

  async function handleLogout() {
    setSigningOut(true);
    // Çerez sunucuda silinir; istek düşse de giriş ekranına dönülür, orada
    // geçersiz oturum zaten reddedilir.
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-crema/30 [--admin-header-h:69px]">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-[calc(var(--admin-header-h)-1px)] max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft sm:inline">
              Yönetim
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold text-ink">{admin.name || admin.email}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-paprika">{ADMIN_ROLE_LABELS[admin.role]}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line px-3.5 py-2 font-mono text-[12px] uppercase tracking-wider text-ink transition-colors hover:border-paprika hover:text-paprika disabled:opacity-50"
            >
              <LogoutIcon size={15} strokeWidth={2} />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
        {/* Mobil/tablet: yatay menü. Yan menü 1024px ve üstünde. */}
        <nav aria-label="Yönetim menüsü" className="border-t border-line/60 lg:hidden">
          <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap transition-colors hover:text-paprika ${
                  isActive(pathname, item.href) ? "text-paprika" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-5">
        <aside className="sticky top-[var(--admin-header-h)] hidden h-[calc(100dvh-var(--admin-header-h))] w-52 shrink-0 overflow-y-auto py-8 lg:block">
          <nav aria-label="Yönetim menüsü" className="space-y-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-paprika/10 font-semibold text-paprika" : "text-ink-soft hover:bg-crema/70 hover:text-ink"
                  }`}
                >
                  <item.Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 py-8">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
