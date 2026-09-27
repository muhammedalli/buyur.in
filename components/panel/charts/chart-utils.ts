"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_UI_LOCALE, uiLocaleTags, type UiLocale } from "@/lib/ui-locales";

// Grafiklerin paylaştığı ölçüm/biçimlendirme yardımcıları.

/** Kapsayıcının genişliğini izler — SVG'yi viewBox ile esnetmek yerine gerçek
 *  piksel genişliğinde çiziyoruz, böylece yazılar hiçbir ölçekte deforme olmuyor. */
export function useChartWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setWidth(Math.max(220, element.clientWidth));
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

// Biçimler panelin arayüz diline uyar. Panel tek bir dil sağlayıcısı altında
// çalışır; kabuk dili her boyamada setChartLocale ile bildirir (bkz.
// app/panel/(dashboard)/layout.tsx). Yönetim paneli bildirmez, Türkçe kalır.
function buildFormats(locale: UiLocale) {
  const tag = uiLocaleTags[locale];
  // Pazartesi ile başlayan hafta: 2024-01-01 bir pazartesidir.
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" });
  return {
    locale,
    compact: new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 }),
    plain: new Intl.NumberFormat(tag),
    day: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }),
    fullDay: new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }),
    shortDate: new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "2-digit" }),
    weekdays: Array.from({ length: 7 }, (_, index) => weekday.format(new Date(2024, 0, 1 + index)).replace(/\.$/, "")),
    units: locale === "tr" ? { s: "sn", m: "dk", h: "sa" } : { s: "s", m: "m", h: "h" },
  };
}

let formats = buildFormats(DEFAULT_UI_LOCALE);

export function setChartLocale(locale: UiLocale) {
  if (formats.locale !== locale) formats = buildFormats(locale);
}

/** 1.284 · 12,8 B — stat kartları ve eksen etiketleri için. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value) >= 10_000 ? formats.compact.format(value) : formats.plain.format(Math.round(value));
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? formats.plain.format(Math.round(value)) : "—";
}

/** Türkçede yüzde işareti başta ve ondalık virgülle (%12,5), diğer dillerde sonda. */
function percentText(ratio: number, digits: number): string {
  const number = new Intl.NumberFormat(uiLocaleTags[formats.locale], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ratio * 100);
  return formats.locale === "tr" ? `%${number}` : `${number}%`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return percentText(value, digits);
}

/** Değişim oranı: işaretli ve yüzde. Önceki dönem 0 ise oran tanımsızdır. */
export function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${sign} ${percentText(Math.abs(value), 1)}`;
}

/** Saniyeyi "2dk 14sn" (İngilizcede "2m 14s") gibi okunur süreye çevirir. */
export function formatDuration(seconds: number): string {
  const { s, m, h } = formats.units;
  if (!Number.isFinite(seconds) || seconds <= 0) return `0${s}`;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}${s}`;
  if (minutes < 60) return rest === 0 ? `${minutes}${m}` : `${minutes}${m} ${rest}${s}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}${h} ${minutes % 60}${m}`;
}

export function formatDayShort(day: string): string {
  return formats.day.format(new Date(`${day}T00:00:00`));
}

export function formatDayLong(day: string): string {
  return formats.fullDay.format(new Date(`${day}T00:00:00`));
}

/** ISO tarihi (2026-08-17) kısa biçime çevirir: 17.08.26. Filtre/aralık
 *  etiketleri için — ham ISO'yu ekranda hiçbir yerde göstermiyoruz. */
export function formatDateShort(day: string): string {
  return formats.shortDate.format(new Date(`${day}T00:00:00`));
}

/** İki ISO tarihi "17.07.26 → 16.08.26" biçiminde birleştirir. */
export function formatDateRange(from: string, to: string): string {
  return `${formatDateShort(from)} → ${formatDateShort(to)}`;
}

/** Kısa gün adı; 0 = pazartesi. */
export function weekdayLabel(index: number): string {
  return formats.weekdays[index] ?? String(index);
}

/** Pazartesiden başlayan kısa gün adları. */
export function weekdayLabels(): string[] {
  return formats.weekdays;
}

/** Ekseni yuvarlak sayılara böler (0 / 500 / 1.000 gibi). */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) ticks.push(value);
  return ticks;
}

/** Düz çizgi yolu (SVG path "d"). */
export function linePath(points: { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}
