"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/panel/ui";

// window.confirm yerine: silme gibi geri alınamaz işlemlerde neyin etkileneceğini
// (bağımlılıkları) madde madde gösteren onay penceresi.

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** Etkilenecekler listesi — ör. "12 ürün kalıcı olarak silinir". */
  details?: string[];
  confirmLabel?: string;
  tone?: "danger" | "default";
}

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  const close = useCallback(
    (confirmed: boolean) => {
      pending?.resolve(confirmed);
      setPending(null);
    },
    [pending]
  );

  useEffect(() => {
    if (!pending) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const dialog = pending ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-5"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-md rounded-md border border-line bg-paper p-6 shadow-[0_30px_60px_-20px_rgba(35,24,18,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display text-lg font-bold">
          {pending.title}
        </h2>
        {pending.description && <div className="mt-2 text-sm leading-relaxed text-ink-soft">{pending.description}</div>}
        {pending.details && pending.details.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-md bg-crema/60 px-4 py-3 text-sm">
            {pending.details.map((detail) => (
              <li key={detail} className="flex gap-2">
                <span aria-hidden className="text-paprika">
                  •
                </span>
                {detail}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            autoFocus
            variant={pending.tone === "danger" ? "danger" : "primary"}
            onClick={() => close(true)}
          >
            {pending.confirmLabel ?? "Onayla"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, dialog];
}
