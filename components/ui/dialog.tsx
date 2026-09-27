"use client";

import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// shadcn/ui Dialog — Buyur token'larıyla. Odak tuzağı, Esc, dışarı tıklama,
// arka plan kaydırma kilidi ve ekran okuyucu etiketleri Radix'ten gelir.
// Panel ekranları bunu doğrudan değil components/panel/ui.tsx → Modal
// üzerinden kullanır.

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("ui-overlay fixed inset-0 z-[80] bg-ink/45 backdrop-blur-[2px]", className)} {...props} />;
}

/** Mobilde alttan açılan yaprak, sm ve üstünde ortalanmış pencere. */
export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "ui-dialog fixed inset-x-0 bottom-0 z-[81] flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-md border border-line bg-paper text-ink shadow-2xl shadow-ink/30 outline-none",
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-display text-lg font-bold leading-tight", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("mt-1 text-sm leading-relaxed text-ink-soft", className)} {...props} />;
}
