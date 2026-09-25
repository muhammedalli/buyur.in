import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin-auth";

// Giriş ekranı dışındaki bütün yönetim sayfaları bu kabuğun içindedir.
// Kapı burada ama her sayfa ayrıca requireAdmin çağırır: layout istemci
// tarafı gezinmede yeniden çalışmaz, işleme özgü yetki sayfada kontrol edilir.
export const dynamic = "force-dynamic";

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  return (
    <AdminShell admin={{ name: admin.name, email: admin.email, role: admin.role }}>{children}</AdminShell>
  );
}
