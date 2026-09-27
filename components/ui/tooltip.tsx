"use client";

import type { ComponentProps, ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

// shadcn/ui Tooltip. Yalnızca ikon butonlarının adını göstermek için: bilgi
// taşıyan metin tooltip'e saklanmaz (dokunmatik ekranda görünmez). Her tooltip
// kendi sağlayıcısını taşır; sayfa kökünde ayrıca sağlayıcı gerekmez.

export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof TooltipPrimitive.Content>["side"];
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="ui-pop z-[95] max-w-[16rem] rounded-md bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
