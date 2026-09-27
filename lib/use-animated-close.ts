"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Pencere/yaprak kapanışını kısa bir çıkış animasyonuyla yapar: `closing`
// true olur (bileşen çıkış sınıfını uygular), süre dolunca asıl onClose çağrılır.
// Hareketi azaltmayı seçen kullanıcıda beklemeden kapanır. Aynı kapanış iki kez
// tetiklenirse (perdeye tıklama + Esc) onClose bir kez çağrılır.

export const CLOSE_ANIMATION_MS = 180;

export function useAnimatedClose(onClose: () => void, duration = CLOSE_ANIMATION_MS) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const close = useCallback(() => {
    if (done.current) return;
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      done.current = true;
      onClose();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(() => {
      done.current = true;
      onClose();
    }, duration);
  }, [onClose, duration]);

  return { closing, close };
}
