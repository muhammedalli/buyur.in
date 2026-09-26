import { redirect } from "next/navigation";
import { Logo } from "@/components/chrome";
import { AdminLoginForm } from "@/components/admin/login-form";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // PocketBase'e ulaşılamıyorsa giriş formu yine görünsün; hata girişte söylenir.
  const session = await getAdminSession().catch(() => null);
  if (session) redirect("/admin");

  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-3">
        <Logo />
        <span className="rounded-md border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          Yönetim
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
