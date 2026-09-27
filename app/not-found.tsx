import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo />
      <p className="mt-10 font-display text-[7rem] font-extrabold leading-none tracking-tight text-paprika">
        404
      </p>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
        Bu sayfa menüde yok.
      </h1>
      <p className="mt-3 max-w-sm text-ink-soft">
        Aradığın sayfa taşınmış, kaldırılmış ya da hiç var olmamış olabilir. Adresi kontrol et veya ana
        sayfaya dön.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-md bg-paprika px-7 py-3.5 font-mono text-[13px] uppercase tracking-wider text-paper transition-colors hover:bg-paprika-deep"
        >
          Ana sayfa
        </Link>
        <Link
          href="/panel"
          className="rounded-md border border-ink px-7 py-3.5 font-mono text-[13px] uppercase tracking-wider text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Panele git
        </Link>
      </div>
    </div>
  );
}
