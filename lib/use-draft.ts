"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Panel formları için otomatik taslak. Değişiklikler canlı menüye DOĞRUDAN
// yazılmaz (yarım girilmiş bir fiyat masadaki müşteriye yansımasın); tarayıcıda
// taslak olarak tutulur. Sayfa kapanır/yenilenirse taslak geri yüklenebilir,
// "Kaydet" ile yayınlanınca taslak silinir.

const DEBOUNCE_MS = 800;
const PREFIX = "buyur-draft:";

interface StoredDraft<T> {
  value: T;
  savedAt: number;
}

export interface FormDraft<T> {
  /** Önceki oturumdan kalmış, kaydedilmemiş taslak (kullanıcı karar verene kadar). */
  restorable: StoredDraft<T> | null;
  /** Bu oturumda taslağın en son yerel olarak kaydedildiği an. */
  draftSavedAt: number | null;
  /** Form kayıtlı hâlinden (baseline) farklı mı — "kaydedilmemiş değişiklik". */
  dirty: boolean;
  /** Taslağı forma uyguladıktan sonra bildirimi kapatır (taslak saklanmaya devam eder). */
  dismiss: () => void;
  /** Kaydedilmemiş taslağı atar. */
  discard: () => void;
  /** Başarılı kayıttan sonra çağrılır. */
  clear: () => void;
}

function read<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredDraft<T>) : null;
  } catch {
    return null;
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* depolama kapalı */
  }
}

/**
 * @param key      Kayıt başına tekil anahtar (ör. "product:<id>" / "product:new:<işletme>").
 * @param value    Formun anlık değeri (JSON'a çevrilebilir).
 * @param baseline Kayıtlı hâl — değer buna eşitse taslak tutulmaz.
 * @param since    Kaydın son güncellenme zamanı; bundan eski taslaklar önerilmez.
 */
export function useFormDraft<T>(key: string, value: T, baseline: T, since?: string): FormDraft<T> {
  const [restorable, setRestorable] = useState<StoredDraft<T> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const ready = useRef(false);
  const pendingChoice = useRef(false);

  const valueJson = JSON.stringify(value);
  const baselineJson = JSON.stringify(baseline);

  // Açılışta: kayıttan yeni ve farklı bir taslak varsa geri yüklemeyi öner.
  useEffect(() => {
    const stored = read<T>(key);
    const sinceMs = since ? Date.parse(since.replace(" ", "T")) : 0;
    if (stored && JSON.stringify(stored.value) !== baselineJson && stored.savedAt > (Number.isFinite(sinceMs) ? sinceMs : 0)) {
      setRestorable(stored);
      pendingChoice.current = true;
    } else if (stored) {
      remove(key);
    }
    ready.current = true;
    // Yalnızca anahtar değişince yeniden okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Henüz yazılmamış son değer. Sekme gizlenince/sayfa kapanırken beklemeden
  // yazılır: gecikme sürerken yenilenen ya da kapanan sayfada son değişiklik
  // (ör. AI'ın az önce doldurduğu çeviriler) kaybolmasın.
  const pending = useRef<(() => void) | null>(null);

  // Değişiklikleri gecikmeli olarak yerel taslağa yaz.
  useEffect(() => {
    if (!ready.current) return;
    // Kullanıcı eski taslak hakkında karar vermeden, dokunulmamış form onu ezmesin.
    if (pendingChoice.current && valueJson === baselineJson) return;

    const write = () => {
      pending.current = null;
      if (valueJson === baselineJson) {
        remove(key);
        setDraftSavedAt(null);
        return;
      }
      const savedAt = Date.now();
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify({ value: JSON.parse(valueJson), savedAt }));
        setDraftSavedAt(savedAt);
      } catch {
        /* kota dolu / depolama kapalı: taslak tutulamaz, form çalışmaya devam eder */
      }
    };
    pending.current = write;
    const id = window.setTimeout(write, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(id);
      if (pending.current === write) pending.current = null;
    };
  }, [key, valueJson, baselineJson]);

  useEffect(() => {
    const flush = () => pending.current?.();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const dismiss = useCallback(() => {
    pendingChoice.current = false;
    setRestorable(null);
  }, []);

  const discard = useCallback(() => {
    pendingChoice.current = false;
    pending.current = null;
    remove(key);
    setRestorable(null);
    setDraftSavedAt(null);
  }, [key]);

  const clear = useCallback(() => {
    pendingChoice.current = false;
    pending.current = null;
    remove(key);
    setDraftSavedAt(null);
  }, [key]);

  return { restorable, draftSavedAt, dirty: valueJson !== baselineJson, dismiss, discard, clear };
}
