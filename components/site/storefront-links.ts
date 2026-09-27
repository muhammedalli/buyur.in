"use client";

import { useEffect, useState } from "react";
import { menuHost } from "@/lib/site";

// Vitrin (site/karşılama) sayfaları hem işletmenin alt alan adında
// (isletme.buyur.in/) hem kök alan yolunda (buyur.in/site/isletme) açılabilir.
// Sayfa önbelleklenerek (ISR) üretildiği için istek başlığına bakılamaz; menü
// bağlantısı ilk boyamada canlı adresle gelir, tarayıcıda bulunulan adrese göre
// göreli hâle getirilir (yerel geliştirmede de doğru yere gitsin diye).

export function useMenuHref(slug: string, path = "/menu"): string {
  const [href, setHref] = useState(`https://${menuHost(slug)}${path}`);

  useEffect(() => {
    const onRootDomainPath = window.location.pathname.startsWith("/site/");
    setHref(onRootDomainPath ? `/${slug}${path}` : path);
  }, [slug, path]);

  return href;
}
