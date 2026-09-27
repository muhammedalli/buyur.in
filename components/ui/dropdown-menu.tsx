"use client";

import type { ComponentProps } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// shadcn/ui DropdownMenu. Menü ekran kenarına çarparsa Radix onu kendiliğinden
// kaydırır/çevirir (collisionPadding): açılır menüler hiçbir genişlikte ekran
// dışına taşmaz.

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, collisionPadding = 12, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "ui-pop z-[90] max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[13rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-md border border-line bg-paper p-1 text-ink shadow-xl shadow-ink/15 outline-none",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

const ITEM =
  "relative flex w-full cursor-pointer select-none items-start gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors data-[disabled]:cursor-not-allowed data-[highlighted]:bg-crema data-[disabled]:opacity-50";

export function DropdownMenuItem({ className, tone, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item> & { tone?: "danger" }) {
  return <DropdownMenuPrimitive.Item className={cn(ITEM, tone === "danger" ? "text-paprika-deep" : "text-ink", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn("my-1 border-t border-line", className)} {...props} />;
}
