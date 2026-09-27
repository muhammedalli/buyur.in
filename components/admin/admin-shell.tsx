"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import {
  BanknoteIcon,
  FileTextIcon,
  LayoutIcon,
  MenuIcon,
  SettingsIcon,
  ShoppingBagIcon,
  SparkIcon,
  SparklesIcon,
  XIcon,
} from "@/components/icons";
import { AdminPasswordForm } from "@/components/admin/password-form";
import { ToastProvider } from "@/components/panel/toast";
import { Dropdown, Modal, Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/panel/ui";
import { ADMIN_ROLE_LABELS, canPerform, type AdminAction } from "@/lib/admin-roles";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof LayoutIcon;
  /** Bu işlemi yapamayan rol öğeyi görmez; sayfanın kendisi de requireAdmin ile kilitli. */
  action?: AdminAction;
}

// Yeni bir yönetim ekranı eklendiğinde yalnızca buraya bir satır girer. Temel
// yönetim birimi işletmedir (1 işletme = 1 hesap); ayrı bir "kullanıcılar"
// ekranı yok. Yönetim ekibinin hesapları Sistem ekranındadır. Aynı gruplu liste
// masaüstünde yan menü, dar ekranda menü yaprağı (Sheet) olarak çizilir.
const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ href: "/admin", label: "Genel bakış", Icon: LayoutIcon }] },
  {
    label: "Müşteriler",
    items: [
      { href: "/admin/businesses", label: "İşletmeler", Icon: ShoppingBagIcon, action: "business.view" },
      { href: "/admin/payments", label: "Ödemeler", Icon: BanknoteIcon, action: "payments.view" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/plans", label: "Planlar", Icon: SparkIcon, action: "plans.edit" },
      { href: "/admin/ai", label: "Yapay zekâ", Icon: SparklesIcon, action: "ai.view" },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { href: "/admin/logs", label: "Denetim kaydı", Icon: FileTextIcon, action: "logs.view" },
      { href: "/admin/system", label: "Sistem", Icon: SettingsIcon, action: "system.view" },
    ],
  },
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

function NavList({ role, onNavigate }: { role: AdminRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.action || canPerform(role, item.action)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label ?? "root"}>
          {group.label && <p className="mb-1 px-3 font-mono text-[10px] uppercase tracking-wider text-ink-soft/80">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active ? "bg-paprika/10 font-semibold text-paprika" : "text-ink-soft hover:bg-crema/70 hover:text-ink"
                    )}
                  >
                    <item.Icon size={17} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminShell({ admin, children }: { admin: AdminShellUser; children: React.ReactNode }) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  async function handleLogout() {
    // Çerez sunucuda silinir; istek düşse de giriş ekranına dönülür, orada
    // geçersiz oturum zaten reddedilir.
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <ToastProvider>
      <div className="min-h-dvh overflow-x-clip bg-crema/30 [--admin-header-h:69px] [--app-header-h:69px]">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex h-[calc(var(--admin-header-h)-1px)] max-w-7xl items-center justify-between gap-3 px-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-1.5">
              <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetTrigger
                  aria-label="Menüyü aç"
                  className="-ml-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink transition-colors hover:bg-crema hover:text-paprika lg:hidden"
                >
                  <MenuIcon size={22} />
                </SheetTrigger>
                <SheetContent side="start" aria-describedby={undefined}>
                  <div className="flex items-center justify-between gap-3 border-b border-line py-3 pl-5 pr-3">
                    <span className="flex items-center gap-3">
                      <Logo className="h-7" />
                      <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                        Yönetim
                      </span>
                    </span>
                    <SheetClose
                      aria-label="Kapat"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-crema hover:text-paprika"
                    >
                      <XIcon size={18} />
                    </SheetClose>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                    <SheetTitle className="sr-only">Yönetim menüsü</SheetTitle>
                    <nav aria-label="Yönetim menüsü">
                      <NavList role={admin.role} onNavigate={() => setNavOpen(false)} />
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
              <Link href="/admin" className="flex shrink-0 items-center gap-3">
                <Logo />
                <span className="hidden rounded-md border border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft sm:inline">
                  Yönetim
                </span>
              </Link>
            </div>
            {/* Hesap işlemleri tek menüde: ekranlarda "hesabın" kartı yer kaplamasın. */}
            <Dropdown
              label="Hesap menüsü"
              triggerClassName="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-right transition-colors hover:bg-crema"
              trigger={
                <span className="min-w-0">
                  <span className="block max-w-[7.5rem] truncate text-sm font-semibold text-ink sm:max-w-[16rem]">
                    {admin.name || admin.email}
                  </span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-paprika">
                    {ADMIN_ROLE_LABELS[admin.role]}
                  </span>
                </span>
              }
              items={[
                { label: "Şifreyi değiştir", description: admin.email, onSelect: () => setPasswordOpen(true) },
                "separator",
                { label: "Çıkış yap", onSelect: handleLogout },
              ]}
            />
          </div>
        </header>
        <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-5">
          <aside className="sticky top-[var(--admin-header-h)] hidden h-[calc(100dvh-var(--admin-header-h))] w-48 shrink-0 overflow-y-auto py-8 lg:block">
            <nav aria-label="Yönetim menüsü">
              <NavList role={admin.role} />
            </nav>
          </aside>
          <main className="min-w-0 flex-1 py-8 lg:py-10">{children}</main>
        </div>
      </div>

      <Modal open={passwordOpen} title="Şifreyi değiştir" description={admin.email} size="sm" onClose={() => setPasswordOpen(false)}>
        <AdminPasswordForm onDone={() => setPasswordOpen(false)} onCancel={() => setPasswordOpen(false)} />
      </Modal>
    </ToastProvider>
  );
}
