"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBusiness } from "@/components/panel/business-context";
import { markActivation, readActivation } from "@/lib/activation";
import { menuUrl } from "@/lib/site";
import { CheckCircleIcon } from "@/components/icons";
import type { Business, BusinessActivation } from "@/lib/types";
import { buttonClass } from "@/components/panel/ui";

// "Menünü yayına hazırla" kontrol listesi. Aktivasyon hunisi:
// kayıt → ilk ürün → QR indirme → ilk gerçek görüntülenme. Tamamlanma yüzdesi
// ve her an yalnızca TEK sıradaki aksiyon gösterilir.

const FIRST_PRODUCTS_TARGET = 5;

interface Step {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  cta: string;
  href: string;
  external?: boolean;
  progress?: string;
}

function hasBusinessInfo(business: Business): boolean {
  return Boolean(business.description?.trim()) && Boolean(business.phone?.trim() || business.address?.trim());
}

function dismissedKey(businessId: string) {
  return `buyur-checklist-dismissed-${businessId}`;
}

export function LaunchChecklist({
  business,
  counts,
}: {
  business: Business;
  counts: { categories: number; products: number } | null;
}) {
  const { setBusiness } = useBusiness();
  const [activation, setActivation] = useState<BusinessActivation>(business.activation ?? {});
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setActivation(readActivation(business));
    try {
      setDismissed(window.localStorage.getItem(dismissedKey(business.id)) === "1");
    } catch {
      /* yoksay */
    }
  }, [business]);

  const products = counts?.products ?? 0;
  const steps: Step[] = [
    {
      key: "logo",
      title: "Logonu yükle",
      hint: "Menünün başında ve QR kartlarında görünür.",
      done: Boolean(business.logo_url),
      cta: "Logo yükle",
      href: "/panel/settings",
    },
    {
      key: "info",
      title: "İşletme bilgilerini tamamla",
      hint: "Kısa bir açıklama ve telefon ya da adres — müşteri kime baktığını bilsin.",
      done: hasBusinessInfo(business),
      cta: "Bilgileri gir",
      href: "/panel/settings",
    },
    {
      key: "category",
      title: "İlk kategoriyi ekle",
      hint: "Kahvaltı, Ana Yemekler, İçecekler… Menünün bölümleri.",
      done: (counts?.categories ?? 0) > 0,
      cta: "Kategori ekle",
      href: "/panel/categories/new",
    },
    {
      key: "products",
      title: `İlk ${FIRST_PRODUCTS_TARGET} ürünü ekle`,
      hint: "Ad ve fiyat yeterli; görsel, alerjen ve süreyi sonra da girebilirsin.",
      done: products >= FIRST_PRODUCTS_TARGET,
      cta: "Ürün ekle",
      href: "/panel/products/new",
      progress: `${Math.min(products, FIRST_PRODUCTS_TARGET)}/${FIRST_PRODUCTS_TARGET}`,
    },
    {
      key: "qr",
      title: "QR kodunu indir",
      hint: "Tek QR'ı PNG indir ya da masa numaralı QR'ları toplu PDF al.",
      done: Boolean(activation.qr_downloaded_at),
      cta: "QR'ı indir",
      href: "/panel/qr",
    },
    {
      key: "scan",
      title: "İlk taramayı yap",
      hint: "QR'ı telefonunla okut ya da menü linkini paylaş; ilk gerçek görüntülenme burada işaretlenir.",
      done: (business.menu_views ?? 0) > 0,
      cta: "Menüyü aç",
      href: menuUrl(business.slug),
      external: true,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((step) => !step.done) ?? null;
  const complete = next === null;

  // Tamamlanma bir kez kaydedilir (aktivasyon metriği).
  useEffect(() => {
    if (!complete || !counts || activation.checklist_completed_at) return;
    markActivation(business, "checklist_completed_at").then((updated) => {
      if (updated) setBusiness(updated);
    });
  }, [complete, counts, activation.checklist_completed_at, business, setBusiness]);

  if (!counts) return null;

  if (complete) {
    if (dismissed) return null;
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-herb/30 bg-herb/5 px-6 py-4">
        <p className="flex items-center gap-2 text-sm">
          <span className="text-herb">
            <CheckCircleIcon size={18} />
          </span>
          <span>
            <span className="font-semibold">Menün yayında.</span>{" "}
            <span className="text-ink-soft">Tüm hazırlık adımlarını tamamladın.</span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(dismissedKey(business.id), "1");
            } catch {
              /* yoksay */
            }
          }}
          className="font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-ink"
        >
          Gizle
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="launch-title" className="mb-8 overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-paprika">Menünü yayına hazırla</p>
          <h2 id="launch-title" className="mt-1 font-display text-xl font-bold">
            %{percent} tamamlandı
          </h2>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-56">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-crema"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Hazırlık yüzdesi"
          >
            <div className="h-full rounded-full bg-paprika transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <span className="font-mono text-xs text-ink-soft">
            {doneCount}/{steps.length}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.25fr]">
        {next && (
          <div className="flex flex-col justify-between gap-5 bg-crema/40 p-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Sıradaki adım</p>
              <p className="mt-2 font-display text-2xl font-extrabold leading-tight">{next.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{next.hint}</p>
            </div>
            {next.external ? (
              <a
                href={next.href}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("primary", "w-fit")}
              >
                {next.cta}
              </a>
            ) : (
              <Link
                href={next.href}
                className={buttonClass("primary", "w-fit")}
              >
                {next.cta}
              </Link>
            )}
          </div>
        )}

        <ol className="divide-y divide-line/70 px-6 py-2">
          {steps.map((step) => {
            const isNext = step.key === next?.key;
            return (
              <li key={step.key} className="flex items-center gap-3 py-3">
                {step.done ? (
                  <span className="shrink-0 text-herb" aria-label="tamamlandı">
                    <CheckCircleIcon size={18} />
                  </span>
                ) : (
                  <span
                    className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 ${isNext ? "border-paprika" : "border-line"}`}
                    aria-label="bekliyor"
                  />
                )}
                <span className={`min-w-0 flex-1 text-sm ${step.done ? "text-ink-soft line-through decoration-line" : isNext ? "font-semibold" : ""}`}>
                  {step.title}
                </span>
                {step.progress && !step.done && (
                  <span className="shrink-0 font-mono text-[11px] text-ink-soft">{step.progress}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
