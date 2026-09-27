"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BanknoteIcon,
  FileTextIcon,
  LayoutIcon,
  LogoutIcon,
  SettingsIcon,
  ShoppingBagIcon,
  SparkIcon,
  SparklesIcon,
} from "@/components/icons";
import { AdminPasswordForm } from "@/components/admin/password-form";
import { ToastProvider } from "@/components/panel/toast";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  InitialsAvatar,
  Modal,
  Sidebar,
  SidebarAccount,
  SidebarBrand,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/panel/ui";
import { ADMIN_ROLE_LABELS, canPerform, type AdminAction } from "@/lib/admin-roles";
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
// masaüstünde tam boy yan sütun, dar ekranda menü yaprağı (Sheet) olarak
// çizilir (components/ui/sidebar.tsx).
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

function visibleGroups(role: AdminRole) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.action || canPerform(role, item.action)),
  })).filter((group) => group.items.length > 0);
}

/** Başlıkta gösterilen konum: "Müşteriler › İşletmeler". */
function Breadcrumb() {
  const pathname = usePathname();
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => isActive(pathname, entry.href));
    if (!item) continue;
    return (
      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm">
        {group.label && <span className="hidden text-ink-soft sm:inline">{group.label}</span>}
        {group.label && <span className="hidden text-ink-soft/60 sm:inline">›</span>}
        <span className="truncate font-semibold text-ink">{item.label}</span>
      </p>
    );
  }
  return null;
}

export function AdminShell({ admin, children }: { admin: AdminShellUser; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const displayName = admin.name || admin.email;

  async function handleLogout() {
    // Çerez sunucuda silinir; istek düşse de giriş ekranına dönülür, orada
    // geçersiz oturum zaten reddedilir.
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <ToastProvider>
      <SidebarProvider storageKey="buyur-admin-sidebar">
        <Sidebar label="Yönetim menüsü" closeLabel="Kapat">
          <SidebarHeader>
            <SidebarBrand
              href="/admin"
              title="buyur"
              subtitle="Yönetim paneli"
              // eslint-disable-next-line @next/next/no-img-element
              avatar={<img src="/icon-192.png" alt="" className="h-full w-full" />}
            />
          </SidebarHeader>
          <SidebarContent>
            {visibleGroups(admin.role).map((group) => (
              <SidebarGroup key={group.label ?? "root"} label={group.label}>
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    active={isActive(pathname, item.href)}
                    label={item.label}
                    icon={<item.Icon size={17} />}
                  />
                ))}
              </SidebarGroup>
            ))}
          </SidebarContent>
          {/* Hesap işlemleri tek menüde: ekranlarda "hesabın" kartı yer kaplamasın. */}
          <SidebarFooter>
            <SidebarAccount
              menuLabel="Hesap menüsü"
              title={displayName}
              subtitle={ADMIN_ROLE_LABELS[admin.role]}
              avatar={<InitialsAvatar name={displayName} />}
            >
              <DropdownMenuItem onSelect={() => setPasswordOpen(true)} className="flex-col gap-0">
                <span>Şifreyi değiştir</span>
                <span className="max-w-full truncate text-xs text-ink-soft">{admin.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="items-center gap-2.5">
                <LogoutIcon size={16} />
                Çıkış yap
              </DropdownMenuItem>
            </SidebarAccount>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset
          header={
            <>
              <SidebarTrigger label="Menüyü aç" />
              <span aria-hidden className="h-5 w-px shrink-0 bg-line" />
              <Breadcrumb />
            </>
          }
        >
          <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>

      <Modal open={passwordOpen} title="Şifreyi değiştir" description={admin.email} size="sm" onClose={() => setPasswordOpen(false)}>
        <AdminPasswordForm onDone={() => setPasswordOpen(false)} onCancel={() => setPasswordOpen(false)} />
      </Modal>
    </ToastProvider>
  );
}
