"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/panel/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useOptionalUiLocale } from "@/components/ui-locale-provider";

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
  const { t } = useOptionalUiLocale();
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

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close(false)}>
      {pending && (
        <DialogContent
          className="p-6 sm:max-w-md"
          onClick={(event) => event.stopPropagation()}
          {...(pending.description ? {} : { "aria-describedby": undefined })}
        >
          <DialogTitle>{pending.title}</DialogTitle>
          {pending.description && <DialogDescription asChild><div>{pending.description}</div></DialogDescription>}
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
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {t("Vazgeç")}
            </Button>
            <Button
              type="button"
              autoFocus
              variant={pending.tone === "danger" ? "danger" : "primary"}
              onClick={() => close(true)}
            >
              {pending.confirmLabel ?? t("Onayla")}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );

  return [confirm, dialog];
}
