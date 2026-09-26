"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/chrome";
import { useAuth } from "@/lib/use-auth";

// Giriş, kayıt ve şifre ekranlarının ortak kabuğu (onaylı tasarım): açık
// kâğıt zemin, solda kartsız form, sağda köşeleri yuvarlak görsel kartı.
// Görsel (auth_bg.png) kendi başlığını taşır ("Menünü güncel tut."); üstüne
// metin yazılmaz. Dar ekranda önce form gelir, görsel altında aynı genişlikte
// durur — kullanıcı giriş alanlarına kaydırmadan ulaşır.
const AUTH_IMAGE_ALT = "Menünü güncel tut. Fiyat değiştir, ürünleri öne çıkar, her masada anında güncellensin.";

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
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-8 lg:pb-5 lg:pl-12 lg:pr-[2.875rem] lg:pt-6 xl:pl-[4.25rem]">
        <Link href="/" aria-label="buyur ana sayfa">
          <Logo className="h-9 lg:h-[3.25rem]" />
        </Link>
        <Link href={isLogin ? "/panel/register" : "/panel/login"} className="group flex items-center gap-4">
          <span className="hidden text-sm text-ink-soft sm:inline">{isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}</span>
          <span className="rounded-full border-[1.5px] border-paprika px-5 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-paprika transition-colors group-hover:bg-paprika group-hover:text-paper sm:px-6 sm:py-2.5 sm:text-[13px]">
            {isLogin ? "Kayıt ol" : "Giriş yap"}
          </span>
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-12 px-5 pb-10 sm:px-8 lg:grid lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] lg:gap-10 lg:pb-[4.25rem] lg:pl-12 lg:pr-6 xl:grid-cols-[minmax(20rem,28.5rem)_minmax(0,1fr)] xl:gap-16 xl:pl-[4.25rem]">
        <main className="mx-auto flex w-full max-w-md flex-col justify-center pt-4 lg:mx-0 lg:max-w-none lg:pb-5 lg:pt-6">{children}</main>

        {/* Geniş ekranda kart ekran yüksekliğine sabitlenir ve yapışkandır: uzun
            formda (kayıt) uzayıp görseli kırpmaz, kaydırırken görünür kalır. */}
        <aside className="relative mx-auto aspect-[1382/1304] w-full max-w-md overflow-hidden rounded-3xl bg-ink lg:sticky lg:top-6 lg:mx-0 lg:aspect-auto lg:h-[max(32rem,calc(100dvh-10.25rem))] lg:max-w-none lg:self-start">
          <Image
            src="/assets/auth_bg.png"
            alt={AUTH_IMAGE_ALT}
            fill
            priority
            sizes="(min-width: 1024px) 62vw, 28rem"
            quality={85}
            className="object-cover lg:object-[0%_50%]"
          />
        </aside>
      </div>
    </div>
  );
}
