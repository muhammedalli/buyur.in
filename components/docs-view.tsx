import Link from "next/link";
import { DOC_GUIDES, docPath, formatDocDate, type DocGuide, type DocSection } from "@/lib/docs";
import { RELEASE_KIND_LABELS, type ReleaseNote } from "@/lib/release-notes";

// Yardım merkezinin ortak kabuğu. İçerik lib/docs.ts ve lib/release-notes.ts'te
// veri olarak durur; burada yalnızca nasıl görüneceği var.

const EYEBROW = "font-mono text-[11px] uppercase tracking-wider";

function Section({ section }: { section: DocSection }) {
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
          <strong className="font-semibold">İpucu: </strong>
          {section.tip}
        </p>
      )}
    </section>
  );
}

function BackLink() {
  return (
    <Link href="/docs" className={`${EYEBROW} text-paprika transition-colors hover:text-paprika-deep`}>
      ← Yardım merkezi
    </Link>
  );
}

export function DocGuideView({ guide }: { guide: DocGuide }) {
  const index = DOC_GUIDES.findIndex((other) => other.slug === guide.slug);
  const next = DOC_GUIDES[index + 1];

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <BackLink />
      <p className={`mt-5 ${EYEBROW} text-ink-soft`}>{guide.group}</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-5xl">{guide.title}</h1>
      <p className="mt-4 border-l-2 border-paprika/40 pl-5 leading-relaxed">{guide.summary}</p>
      <p className={`mt-3 ${EYEBROW} text-ink-soft/70`}>Son güncelleme: {formatDocDate(guide.updated)}</p>

      <div className="mt-12">
        {guide.sections.map((section) => (
          <Section key={section.heading} section={section} />
        ))}
      </div>

      <nav className="mt-16 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <BackLink />
        {next && (
          <Link href={docPath(next.slug)} className="text-sm font-semibold transition-colors hover:text-paprika">
            Sıradaki: {next.title} →
          </Link>
        )}
      </nav>
    </article>
  );
}

export function ReleaseNotesView({ notes }: { notes: ReleaseNote[] }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <BackLink />
      <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Sürüm notları</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">
        buyur'a gelen her yenilik, iyileştirme ve düzeltme burada. En yeni sürüm en üsttedir.
      </p>

      <ol className="mt-12 space-y-12">
        {notes.map((note) => (
          <li key={note.version} id={`v${note.version}`} className="scroll-mt-24">
            <p className={`${EYEBROW} text-ink-soft`}>
              <span className="text-paprika">v{note.version}</span> · {formatDocDate(note.date)}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">{note.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {note.items.map((item) => (
                <li key={item.text} className="flex flex-col gap-1 leading-relaxed text-ink-soft sm:flex-row sm:gap-3">
                  <span className={`w-24 shrink-0 pt-0.5 ${EYEBROW} text-ink`}>{RELEASE_KIND_LABELS[item.kind]}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </article>
  );
}
