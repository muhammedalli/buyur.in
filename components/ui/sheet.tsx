"use client";

import type { ComponentProps } from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// shadcn/ui Sheet — ekranın kenarından açılan yaprak. Panelin mobil gezinmesi
// ve dar ekrandaki ikincil menüler bununla açılır (yatay kayan şerit yerine).

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const SIDES = {
  start: "ui-sheet-start inset-y-0 left-0 h-dvh w-[min(20rem,calc(100vw-3rem))] border-r",
  end: "ui-sheet-end inset-y-0 right-0 h-dvh w-[min(20rem,calc(100vw-3rem))] border-l",
  bottom: "ui-sheet-bottom inset-x-0 bottom-0 max-h-[85dvh] rounded-t-md border-t",
} as const;

export function SheetContent({
  side = "start",
  className,
  children,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="ui-overlay fixed inset-0 z-[70] bg-ink/40 backdrop-blur-[2px]" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-[71] flex flex-col overflow-hidden border-line bg-paper text-ink shadow-2xl shadow-ink/25 outline-none",
          SIDES[side],
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("font-display text-lg font-bold leading-tight", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-ink-soft", className)} {...props} />;
}
