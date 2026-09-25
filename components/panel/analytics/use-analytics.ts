"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsError, fetchAnalytics, type AnalyticsMeta } from "@/lib/analytics/panel-client";
import { useAnalyticsFilters } from "@/components/panel/analytics/filters";
import { useBusiness } from "@/components/panel/business-context";

// Filtrelere bağlı analiz sorgusu. Yeniden yüklerken önceki veriyi ekranda
// tutuyoruz (dataviz kuralı: "refetch keeps the frame") — grafikler iskelete
// dönüp sayfayı zıplatmasın; sadece soluklaşsın.

export interface AnalyticsQueryState<T> {
  data: T | null;
  meta: AnalyticsMeta | null;
  loading: boolean;
  /** Veri var ama şu an yenileniyor. */
  refreshing: boolean;
  error: AnalyticsError | null;
  reload: () => void;
}

export function useAnalyticsQuery<T>(
  endpoint: string,
  extraParams: Record<string, string | undefined> = {}
): AnalyticsQueryState<T> {
  const { params } = useAnalyticsFilters();
  // Plan değişince (ör. Premium → Elite) sunucu önbelleği bayat yetkiyle
  // yanıt vermesin diye plan sorguya eklenir (bkz. lib/analytics/access.ts).
  const rev = useBusiness().business?.plan;
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<AnalyticsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AnalyticsError | null>(null);
  const [nonce, setNonce] = useState(0);
  const hasData = useRef(false);

  const query = useMemo(
    () => ({ ...params, ...extraParams, rev }),
    // Nesne kimliği her render değişiyor; içeriğe göre karşılaştırıyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params), JSON.stringify(extraParams), rev]
  );

  useEffect(() => {
    const controller = new AbortController();
    if (hasData.current) setRefreshing(true);
    else setLoading(true);

    fetchAnalytics<T>(endpoint, query, controller.signal)
      .then((response) => {
        setData(response.data);
        setMeta(response.meta);
        setError(null);
        hasData.current = true;
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof AnalyticsError ? err : new AnalyticsError(500, "analytics_unavailable"));
        // Plan kilidi/oturum hatasında eski veriyi göstermeye devam etmiyoruz.
        if (err instanceof AnalyticsError && (err.isPlanLocked || err.isUnauthenticated)) {
          setData(null);
          hasData.current = false;
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => controller.abort();
  }, [endpoint, query, nonce]);

  return { data, meta, loading, refreshing, error, reload: () => setNonce((value) => value + 1) };
}
