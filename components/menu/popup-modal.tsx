"use client";

import type { Popup } from "@/lib/types";
import { useMenu } from "@/components/menu/menu-provider";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useAnimatedClose } from "@/lib/use-animated-close";
import { popupImageUrl } from "@/lib/files";

export function PopupModal({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  const { t, tf } = useMenu();
  const { closing, close } = useAnimatedClose(onClose);
  // Açıkken arkadaki menü kaymasın.
  useBodyScrollLock(true);
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 ${closing ? "fade-out" : "fade-in"}`}
      onClick={close}
    >
      <div
        className={`w-full max-w-sm overflow-hidden rounded-2xl bg-paper shadow-2xl ${closing ? "pop-out" : "pop-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {popup.image && (
          <div className="relative h-40 w-full">
            <picture>
              <img src={popupImageUrl(popup)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </picture>
          </div>
        )}
        <div className="p-6 text-center">
          <h2 className="font-display text-xl font-bold">{tf(popup, "title")}</h2>
          {popup.message && <p className="mt-2 text-sm text-ink-soft">{tf(popup, "message")}</p>}
          <button
            onClick={close}
            style={{ background: "var(--brand)", color: "var(--brand-on)" }}
            className="mt-5 rounded-md px-6 py-2.5 font-mono text-[13px] uppercase tracking-wider transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            {t("viewMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}
