"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/chrome";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

// Kök önekli çapalar.
const links = [
  { href: "/#neden", label: "Neden buyur" },
  { href: "/#canli-menu", label: "Canlı demo" },
  { href: "/#nasil", label: "Nasıl çalışır" },
  { href: "/#fiyat", label: "Fiyatlar" },
  { href: "/docs", label: "Dökümantasyon" },
];

// Hamburger — açıkken çizgiler çarpıya dönüşür (tek SVG, animasyonlu).
function MenuToggleIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <line
        x1="3" y1="6" x2="19" y2="6"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="origin-center transition-transform duration-300"
        style={open ? { transform: "translateY(5px) rotate(45deg)" } : undefined}
      />
      <line
        x1="3" y1="11" x2="19" y2="11"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="origin-center transition-opacity duration-200"
        style={open ? { opacity: 0 } : undefined}
      />
      <line
        x1="3" y1="16" x2="19" y2="16"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="origin-center transition-transform duration-300"
        style={open ? { transform: "translateY(-5px) rotate(-45deg)" } : undefined}
      />
    </svg>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sayfa kaydırıldığında başlık daralır ve gölge kazanır.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Çekmece açıkken arka plan kaymasın; Esc ile kapansın.
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-paper/85 backdrop-blur-md transition-all duration-300 ${scrolled || open
          ? "border-line shadow-[0_8px_30px_-16px_rgba(35,24,18,0.35)]"
          : "border-transparent"
        }`}
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between px-5 transition-all duration-300 ${scrolled ? "py-3" : "py-4"
          }`}
      >
        <Link href="/" aria-label="buyur ana sayfa" className="shrink-0">
          <Logo />
        </Link>

        {/* Masaüstü gezinme — bağlantılar altı çizgiyle açılır */}
        <div className="hidden items-center gap-8 font-mono text-[13px] uppercase tracking-wider text-ink-soft md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative py-1 transition-colors hover:text-ink"
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-paprika transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/panel/login"
            className="rounded-md px-4 py-2.5 font-mono text-[13px] uppercase tracking-wider text-ink-soft transition-colors hover:bg-crema hover:text-ink"
          >
            Giriş yap
          </Link>
          <Link
            href="/panel/register"
            data-track="cta_click"
            data-track-location="nav"
            data-track-cta="create_free"
            className="shine-on-hover relative overflow-hidden rounded-md bg-ink px-5 py-2.5 font-mono text-[13px] uppercase tracking-wider text-paper transition-all duration-300 hover:bg-paprika hover:shadow-[0_10px_24px_-10px_rgba(232,73,31,0.9)]"
          >
            Ücretsiz başla
          </Link>
        </div>

        {/* Mobil tetikleyici */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobil-menu"
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          className="-mr-1 rounded-lg p-2 text-ink transition-colors hover:bg-crema md:hidden"
        >
          <MenuToggleIcon open={open} />
        </button>
      </nav>

      {/* Mobil çekmece */}
      {open && (
        <div
          id="mobil-menu"
          className="drawer-in border-t border-line bg-paper px-5 pb-7 pt-4 md:hidden"
        >
          <div className="flex flex-col">
            {links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="drawer-item border-b border-line/70 py-4 font-display text-xl font-bold tracking-tight transition-colors hover:text-paprika"
                style={{ animationDelay: `${0.04 + i * 0.05}s` }}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div
            className="drawer-item mt-6 flex flex-col gap-3"
            style={{ animationDelay: `${0.04 + links.length * 0.05}s` }}
          >
            <Link
              href="/panel/register"
              onClick={() => setOpen(false)}
              className="rounded-full bg-paprika py-3.5 text-center font-mono text-sm uppercase tracking-wider text-paper"
            >
              Ücretsiz başla
            </Link>
            <Link
              href="/panel/login"
              onClick={() => setOpen(false)}
              className="rounded-full border border-ink py-3.5 text-center font-mono text-sm uppercase tracking-wider text-ink"
            >
              Giriş yap
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
