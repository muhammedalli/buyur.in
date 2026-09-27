"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import {
  firstOpenStep,
  GUIDE_STEPS,
  guidePatch,
  isGuideEnabled,
  shouldAutoStartGuide,
  type GuideCounts,
} from "@/lib/guide";
import { menuPageUrl } from "@/lib/storefront";
import { useBusiness } from "@/components/panel/business-context";
import { useUiLocale } from "@/components/ui-locale-provider";
import { Button, buttonClass, Tooltip } from "@/components/panel/ui";
import { CheckCircleIcon, CompassIcon, XIcon } from "@/components/icons";
import type { Business, BusinessGuide } from "@/lib/types";

// Panel kılavuzu (adım adım tanıtım). Adımlar ve "tamam mı" kuralları
// lib/guide.ts'te; burada yalnızca gösterim: ilgili sayfaya gider, sayfadaki
// `data-guide` öğesini vurgular (etrafı kararır, öğe aydınlık kalır) ve yanına
// kısa bir açıklama kartı koyar.
//
// Kasıtlı olarak kilitleyici değildir: vurgu varken sayfa kullanılabilir,
// kullanıcı gösterilen alanda hemen işini yapabilir. Kart mobilde ekranın
// altına oturur (başparmak erişimi), masaüstünde vurgulanan alanın yanına.

type Phase = "intro" | "step" | "done";

interface GuideContextValue {
  /** Kılavuz Ayarlar'da açık mı. */
  enabled: boolean;
  active: boolean;
  /** Kılavuzu başlatır (açılış kartıyla). */
  start: () => void;
}

const GuideContext = createContext<GuideContextValue>({ enabled: false, active: false, start: () => undefined });

export function useGuide() {
  return useContext(GuideContext);
}

interface Session {
  phase: Phase;
  index: number;
}

const sessionKey = (businessId: string) => `buyur-guide-${businessId}`;

function readSession(businessId: string): Session | null {
  try {
    const raw = window.sessionStorage.getItem(sessionKey(businessId));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(businessId: string, session: Session | null) {
  try {
    if (session) window.sessionStorage.setItem(sessionKey(businessId), JSON.stringify(session));
    else window.sessionStorage.removeItem(sessionKey(businessId));
  } catch {
    /* gizli sekme: kılavuz sayfa yenilenince baştan açılır */
  }
}

async function saveGuide(business: Business, patch: Partial<BusinessGuide>): Promise<Business | null> {
  try {
    return await pb
      .collection(BUSINESS_COLLECTION)
      .update<Business>(business.id, { guide: guidePatch(business, patch) }, { requestKey: null });
  } catch {
    return null;
  }
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const { business, setBusiness } = useBusiness();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [counts, setCounts] = useState<GuideCounts>({ categories: 0, products: 0 });
  const autoTried = useRef(false);
  const businessId = business?.id ?? null;
  const enabled = business ? isGuideEnabled(business) : false;

  // Sayfalar arası geçişte (ve yenilemede) kılavuz kaldığı yerden sürer.
  useEffect(() => {
    if (!businessId) return;
    const stored = readSession(businessId);
    if (stored) setSession(stored);
  }, [businessId]);

  const update = useCallback(
    (next: Session | null) => {
      setSession(next);
      if (businessId) writeSession(businessId, next);
    },
    [businessId]
  );

  // Adım durumları için sayılar — kılavuz açıkken ve adım değiştikçe tazelenir.
  const stepKey = session ? `${session.phase}:${session.index}` : "";
  useEffect(() => {
    if (!businessId || !session) return;
    let cancelled = false;
    Promise.all([
      pb.collection("buyur_categories").getList(1, 1, { filter: pb.filter("business = {:id}", { id: businessId }), requestKey: null }),
      pb.collection("buyur_products").getList(1, 1, { filter: pb.filter("business = {:id}", { id: businessId }), requestKey: null }),
    ])
      .then(([categories, products]) => {
        if (!cancelled) setCounts({ categories: categories.totalItems, products: products.totalItems });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, stepKey, pathname]);

  const start = useCallback(() => {
    if (!business) return;
    update({ phase: "intro", index: 0 });
    if (!business.guide?.started_at) {
      void saveGuide(business, { started_at: new Date().toISOString(), dismissed_at: undefined }).then((updated) => {
        if (updated) setBusiness(updated);
      });
    }
  }, [business, update, setBusiness]);

  // Yeni işletme panele ilk girdiğinde kılavuz kendiliğinden açılır (bir kez).
  useEffect(() => {
    if (!business || autoTried.current || pathname !== "/panel") return;
    autoTried.current = true;
    if (!readSession(business.id) && shouldAutoStartGuide(business)) start();
  }, [business, pathname, start]);

  // Ayarlardan kapatılırsa açık tur da kapanır.
  useEffect(() => {
    if (!enabled && session) update(null);
  }, [enabled, session, update]);

  const close = useCallback(
    (reason: "dismissed" | "completed") => {
      update(null);
      if (!business) return;
      const patch = reason === "completed" ? { completed_at: new Date().toISOString() } : { dismissed_at: new Date().toISOString() };
      void saveGuide(business, patch).then((updated) => {
        if (updated) setBusiness(updated);
      });
    },
    [business, update, setBusiness]
  );

  const goTo = useCallback(
    (index: number) => {
      if (index >= GUIDE_STEPS.length) {
        update({ phase: "done", index: GUIDE_STEPS.length - 1 });
        return;
      }
      const step = GUIDE_STEPS[Math.max(0, index)];
      update({ phase: "step", index: Math.max(0, index) });
      const [path, query = ""] = step.route.split("?");
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== step.route && !(window.location.pathname === path && query === "")) router.push(step.route);
    },
    [router, update]
  );

  const value = useMemo<GuideContextValue>(() => ({ enabled, active: session !== null, start }), [enabled, session, start]);

  return (
    <GuideContext.Provider value={value}>
      {children}
      {business && session && enabled && (
        <GuideLayer
          business={business}
          counts={counts}
          session={session}
          onGo={goTo}
          onClose={close}
        />
      )}
    </GuideContext.Provider>
  );
}

/* ─── Gösterim katmanı ─────────────────────────────────────── */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOT_PADDING = 8;
const CARD_WIDTH = 360;

/** Hedef öğeyi bulur, görünür alana kaydırır ve konumunu izler. Sayfa verisi
 *  geç yüklenebildiği için birkaç saniye beklenir; bulunamazsa null. */
function useTargetRect(target: string | null): { rect: Rect | null; missing: boolean } {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setRect(null);
    setMissing(false);
    if (!target) return;
    let frame = 0;
    let element: HTMLElement | null = null;
    let last = "";
    const startedAt = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function tick() {
      if (!element || !element.isConnected) {
        element = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
        if (element) {
          element.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        } else if (performance.now() - startedAt > 4000) {
          setMissing(true);
        }
      }
      if (element) {
        const box = element.getBoundingClientRect();
        const next = { top: box.top, left: box.left, width: box.width, height: box.height };
        const key = `${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.width)}:${Math.round(next.height)}`;
        if (key !== last) {
          last = key;
          setRect(next);
          setMissing(false);
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return { rect, missing };
}

function useViewport() {
  const [size, setSize] = useState({ width: 1024, height: 768 });
  useEffect(() => {
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function GuideLayer({
  business,
  counts,
  session,
  onGo,
  onClose,
}: {
  business: Business;
  counts: GuideCounts;
  session: Session;
  onGo: (index: number) => void;
  onClose: (reason: "dismissed" | "completed") => void;
}) {
  const { t } = useUiLocale();
  const viewport = useViewport();
  const step = session.phase === "step" ? GUIDE_STEPS[session.index] : null;
  const { rect, missing } = useTargetRect(step?.target ?? null);
  const total = GUIDE_STEPS.length;

  // Klavye: Esc kapatır, oklar adımlar arasında gezer.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose("dismissed");
      if (session.phase !== "step") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") onGo(session.index + 1);
      if (event.key === "ArrowLeft" && session.index > 0) onGo(session.index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, onGo, onClose]);

  if (session.phase === "intro" || session.phase === "done") {
    return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          className="sheet-up max-h-[92dvh] w-full overflow-y-auto rounded-t-md border border-line bg-paper shadow-2xl shadow-ink/30 sm:max-w-lg sm:rounded-md"
        >
          {session.phase === "intro" ? (
            <GuideIntro business={business} counts={counts} onStart={onGo} onClose={() => onClose("dismissed")} />
          ) : (
            <GuideDone business={business} onClose={() => onClose("completed")} />
          )}
        </div>
      </div>
    );
  }

  if (!step) return null;
  const done = step.done(business, counts);
  const mobile = viewport.width < 640;

  // Vurgu kutusu: hedefin çevresinde; dışarısı gölgeyle kararır.
  const spot: CSSProperties | null = rect
    ? {
        top: rect.top - SPOT_PADDING,
        left: rect.left - SPOT_PADDING,
        width: rect.width + SPOT_PADDING * 2,
        height: rect.height + SPOT_PADDING * 2,
      }
    : null;

  // Kart konumu: masaüstünde hedefin altında (yer yoksa üstünde), yatayda ekrana sığdırılır.
  let cardStyle: CSSProperties | undefined;
  if (!mobile && rect && !missing) {
    const cardHeight = 260;
    const below = rect.top + rect.height + SPOT_PADDING + 14;
    const fitsBelow = below + cardHeight < viewport.height;
    const top = fitsBelow ? below : Math.max(16, rect.top - SPOT_PADDING - 14 - cardHeight);
    const left = Math.min(Math.max(16, rect.left), viewport.width - CARD_WIDTH - 16);
    cardStyle = { top, left, width: CARD_WIDTH };
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {spot ? (
        <div
          aria-hidden
          className="guide-spot absolute rounded-md ring-2 ring-paprika"
          style={{ ...spot, boxShadow: "0 0 0 9999px rgba(35, 24, 18, 0.5)" }}
        />
      ) : (
        <div aria-hidden className="fade-in absolute inset-0 bg-ink/40" />
      )}

      <div
        role="dialog"
        aria-labelledby="guide-step-title"
        className={`pointer-events-auto absolute rounded-md border border-line bg-paper p-5 shadow-2xl shadow-ink/30 ${
          mobile || !cardStyle
            ? "sheet-up inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[360px] sm:-translate-x-1/2 sm:-translate-y-1/2"
            : "pop-in"
        }`}
        style={cardStyle}
        key={session.index}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            {t("Adım {n} / {total}", { n: session.index + 1, total })}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                done ? "bg-herb/10 text-herb" : "bg-paprika/10 text-paprika"
              }`}
            >
              {done ? t("Tamamlandı") : t("Sırada")}
            </span>
            <button
              type="button"
              onClick={() => onClose("dismissed")}
              aria-label={t("Kılavuzu kapat")}
              className="rounded-md p-1 text-ink-soft transition-colors hover:bg-crema hover:text-paprika"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <h2 id="guide-step-title" className="mt-3 font-display text-lg font-bold leading-snug">
          {t(step.title)}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t(step.body)}</p>
        {missing ? (
          <p className="mt-3 rounded-md bg-crema/70 px-3 py-2 text-xs text-ink-soft">
            {t("Bu alan şu anki sayfada görünmüyor.")}{" "}
            <button type="button" onClick={() => onGo(session.index)} className="font-semibold text-paprika hover:underline">
              {t("Sayfaya git")}
            </button>
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-crema/60 px-3 py-2 text-xs text-ink">
            <CompassIcon size={14} className="mt-px shrink-0 text-paprika" />
            {t(step.hint)}
          </p>
        )}

        {/* İlerleme: adım noktaları */}
        <div className="mt-4 flex gap-1" aria-hidden>
          {GUIDE_STEPS.map((item, index) => (
            <span
              key={item.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                index < session.index ? "bg-herb" : index === session.index ? "bg-paprika" : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={session.index === 0} onClick={() => onGo(session.index - 1)}>
            {t("Geri")}
          </Button>
          <Button type="button" size="sm" onClick={() => onGo(session.index + 1)}>
            {session.index + 1 < total ? t("İleri") : t("Bitir")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GuideIntro({
  business,
  counts,
  onStart,
  onClose,
}: {
  business: Business;
  counts: GuideCounts;
  onStart: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useUiLocale();
  const doneCount = GUIDE_STEPS.filter((step) => step.done(business, counts)).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-paprika">
            <CompassIcon size={14} /> {t("Kılavuz")}
          </p>
          <h2 id="guide-title" className="mt-1.5 font-display text-xl font-extrabold leading-tight">
            {t("buyur.in'de işletmenizi oluşturmaya başlayalım.")}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {t("{name} için birkaç adımda menünüzü yayına hazırlayacağız. Girdiğiniz bilgileri kullanıyoruz; tamamlanan adımlar işaretli.", {
              name: business.name,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Kılavuzu kapat")}
          className="-mr-1 shrink-0 rounded-md p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika"
        >
          <XIcon size={18} />
        </button>
      </div>

      <ol className="divide-y divide-line/70 px-5 py-2 sm:px-6">
        {GUIDE_STEPS.map((step, index) => {
          const done = step.done(business, counts);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStart(index)}
                style={{ animationDelay: `${0.05 + index * 0.04}s` }}
                className="drawer-item group flex w-full items-center gap-3 py-2.5 text-left"
              >
                {done ? (
                  <span className="shrink-0 text-herb" aria-label={t("tamamlandı")}>
                    <CheckCircleIcon size={18} />
                  </span>
                ) : (
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-line font-mono text-[9px] text-ink-soft">
                    {index + 1}
                  </span>
                )}
                <span className={`min-w-0 flex-1 text-sm ${done ? "text-ink-soft" : "font-medium"} group-hover:text-paprika`}>
                  {t(step.title)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-crema/40 px-5 py-4 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          {t("{done}/{total} tamamlandı", { done: doneCount, total: GUIDE_STEPS.length })}
        </p>
        {/* Dar ekranda butonlar alt alta, tam genişlik: uzun etiket pencereden taşmasın. */}
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            {t("Daha sonra")}
          </Button>
          <Button type="button" onClick={() => onStart(firstOpenStep(business, counts))} className="w-full sm:w-auto">
            {doneCount > 0 ? t("Kaldığım yerden devam et") : t("Başlayalım")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GuideDone({ business, onClose }: { business: Business; onClose: () => void }) {
  const { t } = useUiLocale();
  return (
    <div className="px-5 py-8 text-center sm:px-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-herb/10 text-herb">
        <CheckCircleIcon size={26} />
      </span>
      <h2 id="guide-title" className="mt-4 font-display text-2xl font-extrabold">
        {t("Hazırsınız!")}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {t("Paneli tanıdınız. Kılavuzu istediğiniz an üst menüdeki pusula simgesinden ya da Ayarlar → Panel'den yeniden açabilirsiniz.")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <a href={menuPageUrl(business.slug)} target="_blank" rel="noreferrer" className={buttonClass("outline")}>
          {t("Menüyü aç")}
        </a>
        <Button type="button" onClick={onClose}>
          {t("Paneli kullanmaya başla")}
        </Button>
      </div>
    </div>
  );
}

/** Kılavuzu başlatan küçük düğme (üst çubuk, ayarlar, kontrol listesi). Kılavuz
 *  Ayarlar'da kapalıysa çizilmez. */
export function GuideButton({ variant = "icon", className = "" }: { variant?: "icon" | "button"; className?: string }) {
  const { enabled, active, start } = useGuide();
  const { t } = useUiLocale();
  if (!enabled) return null;
  if (variant === "button") {
    return (
      <Button type="button" variant="outline" onClick={start} disabled={active} className={className}>
        <CompassIcon size={15} /> {t("Kılavuzu başlat")}
      </Button>
    );
  }
  // xl altında yalnızca ikon görünür; adı tooltip söyler.
  return (
    <Tooltip content={t("Kılavuzu başlat")}>
      <button
        type="button"
        onClick={start}
        aria-label={t("Kılavuzu başlat")}
        className={`inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 font-mono text-[12px] uppercase tracking-wider text-ink transition-colors hover:border-paprika hover:text-paprika ${className}`}
      >
        <CompassIcon size={15} strokeWidth={2} />
        <span className="hidden xl:inline">{t("Kılavuz")}</span>
      </button>
    </Tooltip>
  );
}
