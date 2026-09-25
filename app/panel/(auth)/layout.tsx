"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/chrome";
import { useAuth } from "@/lib/use-auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Sıfırlama bağlantısı oturum açıkken de çalışmalı: kullanıcı şifresini
  // unuttuğu cihazdan başka bir cihazda hâlâ girişli olabilir.
  const allowSignedIn = pathname?.startsWith("/panel/reset-password") ?? false;

  useEffect(() => {
    if (!isLoading && user && !allowSignedIn) {
      router.replace("/panel");
    }
  }, [isLoading, user, router, allowSignedIn]);

  if (isLoading || (user && !allowSignedIn)) {
    return null;
  }

  const isLogin = pathname?.startsWith("/panel/login");

  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <Link href={isLogin ? "/panel/register" : "/panel/login"} className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-soft sm:inline">
            {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}
          </span>
          <span className="rounded-full border border-paprika px-4 py-1.5 font-mono text-[12px] uppercase tracking-wider text-paprika transition-colors hover:bg-paprika hover:text-paper">
            {isLogin ? "Kayıt ol" : "Giriş yap"}
          </span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center gap-16 py-10 lg:justify-between lg:py-6">
        <div className="w-full max-w-sm shrink-0 lg:mx-auto">{children}</div>

        <div className="relative hidden aspect-square w-full max-w-2xl flex-1 overflow-hidden rounded-[2rem] lg:block">
          <video
            src="/assets/animated.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-ink/0 to-transparent" />
          <div className="absolute inset-x-8 bottom-8">
            <p className="font-display text-2xl font-bold text-paper">
              Menünü dakikalar içinde dijitalleştir
            </p>
            <p className="mt-1.5 text-sm text-paper/80">
              QR ile paylaş, fiyatları anında güncelle, kampanya ekle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
