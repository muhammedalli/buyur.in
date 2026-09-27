"use client";

import { useEffect } from "react";
import { modernSectionAnchor } from "@/lib/url-params";

// Tanıtım sayfasının çapaları İngilizcedir (/#pricing). Eski Türkçe çapayla
// (/#fiyat) gelen ziyaretçi, adres çubuğu İngilizceye çevrilerek aynı bölüme
// götürülür; sayfa yeniden yüklenmez. Paylaşılmış eski bağlantılar böylece
// kırılmaz (eşleme: lib/url-params.ts).
export function LegacyAnchorRedirect() {
  useEffect(() => {
    const apply = () => {
      const target = modernSectionAnchor(window.location.hash);
      if (!target) return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${target}`);
      // Kaydırma hidrasyondan sonraya bırakılır ve anında yapılır: eski
      // bağlantıyla gelen ziyaretçi sayfanın başından bölüme uzun bir yumuşak
      // kaydırma izlemesin (sitede scroll-behavior: smooth açık). Arka planda
      // açılan sekmede requestAnimationFrame çalışmadığı için setTimeout.
      setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }), 60);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  return null;
}
