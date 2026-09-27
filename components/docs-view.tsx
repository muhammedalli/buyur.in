import Link from "next/link";
import {
  DOC_GROUPS,
  DOC_GROUP_LABELS,
  DOC_GUIDES,
  RELEASE_NOTES_SLUG,
  docGuides,
  docPath,
  docsHome,
  formatDocDate,
  type DocGuide,
  type DocSection,
} from "@/lib/docs";
import { latestRelease, localizedReleaseNote, type ReleaseNote } from "@/lib/release-notes";
import type { UiLocale } from "@/lib/ui-locales";

// Yardım merkezinin ortak kabuğu (/docs ve /en/docs). İçerik lib/docs.ts,
// lib/docs-en.ts ve lib/release-notes.ts'te veri olarak durur; burada yalnızca
// nasıl görüneceği var. Kabuğun kendi birkaç metni aşağıdaki sözlükte.

const COPY = {
  tr: {
    helpCenter: "Yardım merkezi",
    intro:
      "Menünüzü kurmaktan misafir verisini okumaya kadar her şey adım adım. Aradığınızı bulamazsanız merhaba@buyur.in adresine yazın.",
    latest: "Son sürüm",
    allNotes: "Bütün sürüm notlarını görün →",
    updated: "Son güncelleme",
    next: "Sıradaki",
    tip: "İpucu",
    notesTitle: "Sürüm notları",
    notesIntro: "buyur'a gelen her yenilik, iyileştirme ve düzeltme burada. En yeni sürüm en üsttedir.",
  },
  en: {
    helpCenter: "Help center",
    intro:
      "Everything from setting up your menu to reading guest data, step by step. If you can't find what you need, write to merhaba@buyur.in.",
    latest: "Latest release",
    allNotes: "See all release notes →",
    updated: "Last updated",
    next: "Next",
    tip: "Tip",
    notesTitle: "Release notes",
    notesIntro: "Every new feature, improvement and fix in buyur. The newest release is at the top.",
  },
} satisfies Record<UiLocale, Record<string, string>>;

export function docsCopy(locale: UiLocale) {
  return COPY[locale];
}

const EYEBROW = "text-sm font-medium";

function Section({ section, locale }: { section: DocSection; locale: UiLocale }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-xl font-bold tracking-tight">{section.heading}</h2>

      {section.paragraphs?.map((text) => (
        <p key={text} className="mt-3 leading-relaxed text-ink-soft">
          {text}
        </p>
      ))}

      {section.steps && (
        <ol className="mt-4 space-y-3">
          {section.steps.map((step, index) => (
            <li key={step} className="flex gap-3 leading-relaxed text-ink-soft">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paprika/10 font-mono text-xs font-bold text-paprika">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      {section.list && (
        <ul className="mt-3 space-y-2">
          {section.list.map((item) => (
            <li key={item} className="flex gap-3 leading-relaxed text-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-paprika" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      )}

      {section.tip && (
        <p className="mt-4 rounded-md border border-herb/30 bg-herb/10 px-4 py-3 text-sm leading-relaxed text-herb">
          <strong className="font-semibold">{COPY[locale].tip}: </strong>
          {section.tip}
        </p>
      )}
    </section>
  );
}

function BackLink({ locale }: { locale: UiLocale }) {
  return (
    <Link href={docsHome(locale)} className={`${EYEBROW} text-paprika transition-colors hover:text-paprika-deep`}>
      ← {COPY[locale].helpCenter}
    </Link>
  );
}

export function DocsIndexView({ locale }: { locale: UiLocale }) {
  const copy = COPY[locale];
  const latest = latestRelease();
  const guides = docGuides(locale);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">{copy.helpCenter}</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">{copy.intro}</p>

      <Link
        href={docPath(RELEASE_NOTES_SLUG, locale)}
        className="group mt-8 flex flex-col gap-1 rounded-md border border-line bg-crema px-5 py-4 transition-colors hover:border-paprika/50"
      >
        <span className={`${EYEBROW} text-paprika`}>
          {copy.latest} · v{latest.version} · {formatDocDate(latest.date, locale)}
        </span>
        <span className="font-display font-bold transition-colors group-hover:text-paprika">
          {localizedReleaseNote(latest, locale).title}
        </span>
        <span className="text-sm text-ink-soft">{copy.allNotes}</span>
      </Link>

      {DOC_GROUPS.map((group) => {
        const items = guides.filter((guide) => guide.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="mt-12">
            <h2 className={`${EYEBROW} text-ink-soft`}>{DOC_GROUP_LABELS[group][locale]}</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {items.map((guide) => (
                <li key={guide.slug}>
                  <Link href={docPath(guide.slug, locale)} className="group flex flex-col gap-1 py-5">
                    <span className="font-display text-lg font-bold transition-colors group-hover:text-paprika">
                      {guide.title}
                    </span>
                    <span className="text-sm leading-relaxed text-ink-soft">{guide.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

export function DocGuideView({ guide, locale }: { guide: DocGuide; locale: UiLocale }) {
  const copy = COPY[locale];
  const index = DOC_GUIDES.findIndex((other) => other.slug === guide.slug);
  const next = docGuides(locale)[index + 1];

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <BackLink locale={locale} />
      <p className={`mt-5 ${EYEBROW} text-ink-soft`}>{DOC_GROUP_LABELS[guide.group][locale]}</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-5xl">{guide.title}</h1>
      <p className="mt-4 border-l-2 border-paprika/40 pl-5 leading-relaxed">{guide.summary}</p>
      <p className={`mt-3 ${EYEBROW} text-ink-soft/70`}>
        {copy.updated}: {formatDocDate(guide.updated, locale)}
      </p>

      <div className="mt-12">
        {guide.sections.map((section) => (
          <Section key={section.heading} section={section} locale={locale} />
        ))}
      </div>

      <nav className="mt-16 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <BackLink locale={locale} />
        {next && (
          <Link href={docPath(next.slug, locale)} className="text-sm font-semibold transition-colors hover:text-paprika">
            {copy.next}: {next.title} →
          </Link>
        )}
      </nav>
    </article>
  );
}

export function ReleaseNotesView({ notes, locale }: { notes: ReleaseNote[]; locale: UiLocale }) {
  const copy = COPY[locale];
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <BackLink locale={locale} />
      <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight md:text-5xl">{copy.notesTitle}</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">{copy.notesIntro}</p>

      <ol className="mt-12 space-y-12">
        {notes.map((note) => {
          const view = localizedReleaseNote(note, locale);
          return (
            <li key={note.version} id={`v${note.version}`} className="scroll-mt-24">
              <p className={`${EYEBROW} text-ink-soft`}>
                <span className="text-paprika">v{note.version}</span> · {formatDocDate(note.date, locale)}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">{view.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {view.items.map((item) => (
                  <li key={item.text} className="flex flex-col gap-1 leading-relaxed text-ink-soft sm:flex-row sm:gap-3">
                    <span className={`w-28 shrink-0 pt-0.5 ${EYEBROW} text-ink`}>{item.label}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
