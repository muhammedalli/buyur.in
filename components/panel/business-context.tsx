"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/lib/use-auth";
import { catalogVersion, ensurePlanCatalog } from "@/lib/plan-catalog-loader";
import { BUSINESS_COLLECTION, isBusinessSetUp } from "@/lib/business-account";
import type { Business } from "@/lib/types";

// Panelin işletme bağlamı. Oturumun sahibi işletme kaydının kendisidir
// (buyur_businesses, auth): ayrı bir "kullanıcının işletmesi" sorgusu yok.
// Kayıt authStore'da durur; işletme güncellenince authStore da güncellenir,
// böylece iki ayrı kopya ayrışamaz.

interface BusinessContextValue {
  /** Kurulumu tamamlanmış işletme. Kurulum (ad/slug) bitmemişse null. */
  business: Business | null;
  /** Oturumdaki hesap kaydı — kurulum ekranı bunu günceller. */
  account: Business | null;
  isLoading: boolean;
  /** İşletme okunamadı (ağ/sunucu hatası). "Kurulum bitmedi"den farklıdır:
   *  bu durumda kurulum ekranı gösterilmez, tekrar deneme sunulur. */
  loadError: boolean;
  refresh: () => Promise<void>;
  setBusiness: (b: Business) => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

/** Sekmeye dönüşte kayıt en fazla bu sıklıkta sunucudan yenilenir. */
const BUSINESS_REVALIDATE_MS = 30_000;

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [catalogReady, setCatalogReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [, rerender] = useState(0);
  const revalidatedAt = useRef(Date.now());

  const account = (user as unknown as Business | null) ?? null;
  // Birleşme öncesinden tarayıcıda kalmış eski kayıt biçiminde slug alanı hiç
  // yoktur; kurulum bitmemiş sayılıp kurulum ekranı gösterilmesin.
  const stale = account !== null && account.slug === undefined;

  useEffect(() => {
    ensurePlanCatalog(pb).finally(() => setCatalogReady(true));
  }, []);

  const setBusiness = useCallback((next: Business) => {
    pb.authStore.save(pb.authStore.token, next as unknown as Parameters<typeof pb.authStore.save>[1]);
  }, []);

  /** Kaydı ve plan kataloğunu sunucudan yeniler. */
  const refresh = useCallback(async () => {
    if (!pb.authStore.isValid) return;
    setLoadError(false);
    try {
      await Promise.all([pb.collection(BUSINESS_COLLECTION).authRefresh({ requestKey: null }), ensurePlanCatalog(pb)]);
      revalidatedAt.current = Date.now();
    } catch (err) {
      if (err instanceof ClientResponseError && err.isAbort) return;
      // Oturumu sunucu reddettiyse çıkış; bağlantı hatasıysa tekrar deneme.
      if (err instanceof ClientResponseError && err.status >= 400 && err.status < 500) {
        pb.authStore.clear();
        return;
      }
      setLoadError(true);
    }
  }, []);

  // Eski biçimde kalmış kayıt ilk açılışta tazelenir.
  useEffect(() => {
    if (!authLoading && stale) refresh();
  }, [authLoading, stale, refresh]);

  // Sekmeye dönüldüğünde plan kataloğu ve kayıt sessizce tazelenir. Yükseltme
  // panel dışında (WhatsApp + yönetim) yapıldığı için açık kalan sekme aksi
  // hâlde eski planı ("Premium", "Elite'e yükselt") göstermeye devam ederdi.
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== "visible" || !pb.authStore.isValid) return;
      const before = catalogVersion();
      if (Date.now() - revalidatedAt.current > BUSINESS_REVALIDATE_MS) {
        await refresh();
      } else {
        await ensurePlanCatalog(pb);
      }
      if (catalogVersion() !== before) rerender((value) => value + 1);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return (
    <BusinessContext.Provider
      value={{
        business: !stale && isBusinessSetUp(account) ? account : null,
        account,
        isLoading: authLoading || (account !== null && !catalogReady) || (stale && !loadError),
        loadError: loadError && (stale || !account),
        refresh,
        setBusiness,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness, BusinessProvider içinde kullanılmalı.");
  return ctx;
}
