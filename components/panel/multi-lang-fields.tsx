"use client";

import { useState } from "react";
import { localeCodes, localeNamesTr, type Locale, type TranslatableField, type Translations } from "@/lib/i18n";
import { Input, Label, Tabs, Textarea } from "@/components/panel/ui";
import { AiTranslateButton, canAiTranslate } from "@/components/panel/ai/translate-button";
import type { TranslationKind } from "@/lib/ai/translate";
import type { Business } from "@/lib/types";

interface FieldDef {
  key: TranslatableField;
  label: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}

/** Alan grubunun yanında "AI ile tamamla" butonu için gerekenler. */
export interface MultiLangTranslate {
  business: Business;
  kind: TranslationKind;
  /** Çeviriye gönderilecek ana dil metinleri. Verilmezse bu grubun alanları;
   *  kaydın başka gruptaki alanları da (ör. kampanya etiketi) buraya eklenir ki
   *  tek tıklamayla kaydın bütün metinleri çevrilsin. */
  fields?: Partial<Record<TranslatableField, string>>;
}

type Completeness = "full" | "partial" | "empty";

const DOT: Record<Completeness, { className: string; text: string }> = {
  full: { className: "bg-herb", text: "çeviri tamam" },
  partial: { className: "bg-paprika/70", text: "eksik çeviri var" },
  empty: { className: "border border-ink-soft/40", text: "çeviri yok" },
};

// Çevrilebilir metin alanlarını (ad, açıklama) dil sekmeleriyle düzenler.
// Ana dil her zaman ilk sekmedir ve varsayılan açık gelir; ana dil sekmesi
// varlığın baz alanlarını, diğer sekmeler `translations` içindeki çevirileri
// düzenler. Boş bırakılan çeviriler müşteri menüsünde ana dile düşer.
//
// Yapay zekâ çevirisi bu alanlarla ilgili bir eylem olduğu için butonu da
// burada, grubun sağ üstündedir (formun genel eylem çubuğunda tekrar edilmez).
// Buton yalnızca boş çevirileri doldurur; sonuç formun state'ine yazılır ve
// kaydet'e basılana kadar yayına girmez.
// Her ek dil sekmesindeki nokta o dilin çeviri durumunu gösterir; kullanıcı
// neyin dolduğunu sekmeleri tek tek açmadan görür.
export function MultiLangFields({
  locales,
  mainLocale,
  base,
  onBaseChange,
  translations,
  onTranslationsChange,
  fields,
  title,
  translate,
}: {
  /** Aktif diller, ana dil ilk sırada. */
  locales: Locale[];
  mainLocale: Locale;
  /** Baz (ana dil) alan değerleri. */
  base: Partial<Record<TranslatableField, string>>;
  onBaseChange: (field: TranslatableField, value: string) => void;
  translations: Translations;
  onTranslationsChange: (next: Translations) => void;
  fields: FieldDef[];
  /** Grubun başlığı (sekmelerin üstünde, AI butonunun solunda). */
  title?: string;
  translate?: MultiLangTranslate;
}) {
  const [tab, setTab] = useState<Locale>(mainLocale);
  const [aiNote, setAiNote] = useState<{ tone: "done" | "error"; text: string } | null>(null);
  const active = locales.includes(tab) ? tab : mainLocale;
  const isMain = active === mainLocale;
  const showTranslate = Boolean(translate && canAiTranslate(translate.business));

  function setTranslation(locale: Locale, field: TranslatableField, value: string) {
    onTranslationsChange({ ...translations, [locale]: { ...translations[locale], [field]: value } });
  }

  // Yalnızca ana dilde metni olan alanlar çeviri bekler.
  const expected = fields.filter((f) => (base[f.key] ?? "").trim() !== "");
  function completeness(locale: Locale): Completeness | null {
    if (locale === mainLocale || expected.length === 0) return null;
    const done = expected.filter((f) => (translations[locale]?.[f.key] ?? "").trim() !== "").length;
    return done === expected.length ? "full" : done === 0 ? "empty" : "partial";
  }

  const tabItems = locales.map((l) => {
    const state = completeness(l);
    return {
      key: l,
      ariaLabel: state ? `${localeNamesTr[l]} — ${DOT[state].text}` : undefined,
      label:
        l === mainLocale ? (
          `${localeCodes[l]} · Ana`
        ) : (
          <>
            {localeCodes[l]}
            {state && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[state].className}`} />}
          </>
        ),
    };
  });

  return (
    <div>
      {(title || showTranslate) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {title ? <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{title}</p> : <span />}
          {showTranslate && translate && (
            <AiTranslateButton
              business={translate.business}
              kind={translate.kind}
              fields={translate.fields ?? base}
              translations={translations}
              onTranslationsChange={onTranslationsChange}
              onDone={(result) => {
                setAiNote({ tone: "done", text: `${result.summary} Kontrol edip kaydedin.` });
                // Ana dil sekmesinde kalan kullanıcı dolan alanı görmeden
                // "boş kaldı" sanmasın: ilk dolan dilin sekmesi açılır.
                if (isMain && result.locales[0] && locales.includes(result.locales[0])) setTab(result.locales[0]);
              }}
              onError={(message) => setAiNote({ tone: "error", text: message })}
            />
          )}
        </div>
      )}
      {aiNote && (
        <p
          role={aiNote.tone === "error" ? "alert" : "status"}
          className={`mb-3 rounded-md border px-3 py-2 text-xs ${
            aiNote.tone === "error" ? "border-paprika/30 bg-paprika/10 text-paprika-deep" : "border-herb/30 bg-herb/10 text-herb"
          }`}
        >
          {aiNote.text}
        </p>
      )}
      <Tabs tabs={tabItems} active={active} onChange={setTab} className="mb-4" />
      <div className="space-y-4">
        {fields.map((f) => {
          const value = isMain ? base[f.key] ?? "" : translations[active]?.[f.key] ?? "";
          const onChange = (v: string) => {
            // Kullanıcı yazmaya başlayınca eski AI notu bayatlar.
            if (aiNote) setAiNote(null);
            if (isMain) onBaseChange(f.key, v);
            else setTranslation(active, f.key, v);
          };
          const id = `mlf-${active}-${f.key}`;
          return (
            <div key={f.key}>
              <Label htmlFor={id}>{f.label}</Label>
              {f.multiline ? (
                <Textarea
                  id={id}
                  rows={f.rows ?? 2}
                  value={value}
                  placeholder={isMain ? f.placeholder : base[f.key] || f.placeholder}
                  onChange={(e) => onChange(e.target.value)}
                />
              ) : (
                <Input
                  id={id}
                  value={value}
                  placeholder={isMain ? f.placeholder : base[f.key] || f.placeholder}
                  required={f.required && isMain}
                  onChange={(e) => onChange(e.target.value)}
                />
              )}
            </div>
          );
        })}
        {!isMain && (
          <p className="text-xs text-ink-soft">Boş bırakılırsa {localeNamesTr[mainLocale]} (ana dil) gösterilir.</p>
        )}
      </div>
    </div>
  );
}
