"use client";

import { useEffect, useRef, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { useToast } from "@/components/panel/toast";
import { AiActionButton } from "@/components/panel/ui";
import { activeNonMainLocales, localeNamesTr, SUPPORTED_LOCALES } from "@/lib/i18n";
import type { Locale, TranslatableField, Translations } from "@/lib/i18n";
import { fillMissingTranslations, missingTranslations, type TranslationKind } from "@/lib/ai/translate";
import { isFeatureAvailable } from "@/lib/entitlements";
import type { Business } from "@/lib/types";

// Alan grubunun yanındaki "AI ile tamamla" butonu (bkz. MultiLangFields).
//
// Kullanıcı ana dildeki metni yazar, tek tıkla YALNIZCA düzenlediği kaydın
// diğer dillerindeki BOŞ alanlar üretilir; dolu çeviri ezilmez. Üretilen çeviri doğrudan kaydedilmez: forma yazılır,
// kullanıcı görür, düzenleyebilir ve kaydet'e basınca yayına girer
// (CLAUDE.md §10).
//
// "Bazen çalışmıyor" şikâyetinin kökleri burada kapatıldı:
//  - Çift tıklama iki paralel istek başlatıyordu → uçuştaki istek ref'le kilitli.
//  - Zaman aşımında platform JSON olmayan bir sayfa döndürüyor, `res.json()`
//    patlıyor ve kullanıcı anlamsız bir hata görüyordu → yanıt güvenle okunur,
//    duruma göre anlamlı mesaj verilir.
//  - Geçici hatalar (bağlantı, 502/503/504) tek seferlik sessiz yeniden
//    denemeyle kapanır; istemci tarafında da üst süre vardır.
//  - Sonuç, tıklama anındaki (bayat) çevirilerle birleştiriliyordu; istek
//    sürerken elle yazılan çeviri siliniyordu → her zaman en güncel değerle
//    ve yalnızca boş alanlara birleştirilir.
//  - Özet gerçekten yazılan alanlardan kurulur: "dolduruldu" denip alanın boş
//    kaldığı bir durum olmaz; eksik kalan diller açıkça söylenir.

const REQUEST_TIMEOUT_MS = 55_000;
const RETRY_DELAY_MS = 1200;
const TRANSIENT_STATUS = new Set([502, 503, 504]);

const FIELD_NAMES: Record<TranslatableField, string> = {
  name: "ad",
  description: "açıklama",
  campaign_label: "kampanya etiketi",
  group_name: "grup",
  title: "başlık",
  message: "mesaj",
};

/** Bu işletmede yapay zekâ çevirisi sunulabilir mi: ek dil açık ve plan izin veriyor. */
export function canAiTranslate(business: Business): boolean {
  return activeNonMainLocales(business).length > 0 && isFeatureAvailable(business, "ai_translation");
}

function statusMessage(status: number): string {
  if (status === 401) return "Oturumunuz sona ermiş. Sayfayı yenileyip yeniden giriş yapın.";
  if (status === 403) return "Bu özellik mevcut planınızda kullanılamıyor.";
  if (status === 413) return "Metin çok uzun. Kısaltıp tekrar deneyin.";
  if (status === 429) return "Çok sık denendi. Biraz bekleyip tekrar deneyin.";
  if (TRANSIENT_STATUS.has(status)) return "Yapay zekâ servisi şu an yanıt vermiyor. Birkaç saniye sonra tekrar deneyin.";
  return "Çeviri üretilemedi. Tekrar deneyin.";
}

function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ve ${items[items.length - 1]}`;
}

function isTranslations(value: unknown): value is Translations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([locale, fields]) =>
      (SUPPORTED_LOCALES as readonly string[]).includes(locale) &&
      fields !== null &&
      typeof fields === "object" &&
      Object.values(fields as Record<string, unknown>).every((text) => typeof text === "string")
  );
}

type Outcome = { ok: true; translations: Translations; missing: Locale[] } | { ok: false; message: string; transient: boolean };

async function requestTranslation(payload: unknown, signal: AbortSignal): Promise<Outcome> {
  let res: Response;
  try {
    res = await fetch("/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    return { ok: false, message: "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.", transient: true };
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const serverMessage = typeof data?.error === "string" && data.error.trim() ? data.error : "";
    // Uygulamanın kendi yanıtı geçici olup olmadığını söyler; JSON olmayan
    // yanıt (platformun zaman aşımı sayfası) durum koduna göre değerlendirilir.
    const transient = data ? data.retryable === true : TRANSIENT_STATUS.has(res.status);
    return { ok: false, message: serverMessage || statusMessage(res.status), transient };
  }

  const items = Array.isArray(data?.items) ? (data.items as { translations?: unknown }[]) : [];
  const translations = items[0]?.translations;
  if (!isTranslations(translations) || Object.keys(translations).length === 0) {
    return { ok: false, message: "Çeviri sonucu okunamadı. Tekrar deneyin.", transient: false };
  }
  const missing = Array.isArray(data?.missing) ? (data.missing as Locale[]) : [];
  return { ok: true, translations, missing };
}

export interface TranslateResult {
  /** Doldurulan diller ve alanlar (kullanıcıya gösterilecek özet). */
  summary: string;
  /** Gerçekten doldurulan diller, sırasıyla — form ilk dolan dilin sekmesini açar. */
  locales: Locale[];
}

export function AiTranslateButton({
  business,
  kind,
  fields,
  translations,
  onTranslationsChange,
  onDone,
  onError,
  label = "AI ile tamamla",
}: {
  business: Business;
  /** Modele bağlam verir; çeviri kalitesini artırır. */
  kind: TranslationKind;
  /** Ana dildeki metinler — boş olanlar gönderilmez. */
  fields: Partial<Record<TranslatableField, string>>;
  translations: Translations;
  onTranslationsChange: (next: Translations) => void;
  /** Başarılı sonuçta çağrılır (ör. alan grubunun altında özet göstermek için). */
  onDone?: (result: TranslateResult) => void;
  /** İstek başarısız olunca ya da yapılacak iş yoksa çağrılır; mesaj kullanıcıya gösterilir. */
  onError?: (message: string) => void;
  label?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  // İstek sürerken kullanıcı bir çeviriyi elle değiştirebilir; sonuç en güncel
  // değerle birleştirilir.
  const latest = useRef(translations);
  useEffect(() => {
    latest.current = translations;
  }, [translations]);

  // Sayfadan çıkılırsa istek iptal edilir; kapanmış bir forma yazılmaz.
  useEffect(() => () => controller.current?.abort(), []);

  if (!canAiTranslate(business)) return null;
  const targets = activeNonMainLocales(business);

  function fail(message: string) {
    toast(message, "error");
    onError?.(message);
  }

  async function handleClick() {
    if (inFlight.current) return;

    const filled = Object.fromEntries(
      Object.entries(fields)
        .filter(([, value]) => typeof value === "string" && value.trim() !== "")
        .map(([key, value]) => [key, (value as string).trim()])
    ) as Partial<Record<TranslatableField, string>>;
    if (Object.keys(filled).length === 0) {
      fail("Önce ana dildeki metni yazın; çeviri ondan üretilir.");
      return;
    }

    // "Tamamla": yalnızca boş kalan çeviriler istenir. Dolu bir çeviri (elle
    // yazılmış ya da daha önce onaylanmış) yeniden üretilip ezilmez.
    const missing = missingTranslations(filled, latest.current, targets);
    const locales = targets.filter((locale) => missing[locale]);
    if (locales.length === 0) {
      fail("Bütün diller zaten dolu. Bir çeviriyi yeniden üretmek için o alanı boşaltıp tekrar deneyin.");
      return;
    }
    const wanted = new Set(locales.flatMap((locale) => missing[locale] ?? []));
    const source = Object.fromEntries(Object.entries(filled).filter(([field]) => wanted.has(field as TranslatableField)));

    inFlight.current = true;
    setLoading(true);
    const abort = new AbortController();
    controller.current = abort;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, REQUEST_TIMEOUT_MS);
    const payload = { businessId: business.id, locales, entries: [{ id: "form", kind, fields: source }] };

    try {
      let outcome = await requestTranslation(payload, abort.signal);
      if (!outcome.ok && outcome.transient) {
        await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
        outcome = await requestTranslation(payload, abort.signal);
      }
      if (!outcome.ok) {
        fail(outcome.message);
        return;
      }

      // İstek sürerken elle doldurulan alan da korunur: en güncel değere,
      // yalnızca hâlâ boş olan yerlere yazılır.
      const { merged, applied } = fillMissingTranslations(latest.current, outcome.translations);
      const doneLocales = targets.filter((locale) => applied[locale] && Object.keys(applied[locale] ?? {}).length > 0);
      if (doneLocales.length === 0) {
        fail("Beklerken bütün alanlar doldurulmuş; değiştirilecek bir şey kalmadı.");
        return;
      }
      latest.current = merged;
      onTranslationsChange(merged);

      const doneFields = Array.from(new Set(doneLocales.flatMap((locale) => Object.keys(applied[locale] ?? {}))))
        .map((field) => FIELD_NAMES[field as TranslatableField] ?? field);
      let summary = `${listText(doneLocales.map((locale) => localeNamesTr[locale]))} için ${listText(doneFields)} dolduruldu.`;
      const notDone = outcome.missing.filter((locale) => locales.includes(locale));
      if (notDone.length > 0) {
        summary += ` ${listText(notDone.map((locale) => localeNamesTr[locale]))} üretilemedi; tekrar deneyebilirsiniz.`;
      }
      toast(`${summary} Kontrol edip kaydedin.`);
      onDone?.({ summary, locales: doneLocales });
    } catch {
      // Yalnızca iptal buraya düşer: süre aşımı ya da sayfadan çıkış. Çıkışta
      // kullanıcıya söylenecek bir şey yok.
      if (timedOut) fail("Çeviri çok uzun sürdü ve durduruldu. Tekrar deneyin.");
    } finally {
      window.clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <AiActionButton
      type="button"
      onClick={handleClick}
      loading={loading}
      title="Yapay zekâ ile boş kalan dilleri doldurur; dolu çevirilere dokunmaz"
    >
      {loading ? "Çevriliyor…" : label}
    </AiActionButton>
  );
}
