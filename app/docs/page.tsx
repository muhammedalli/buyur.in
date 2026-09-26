import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/chrome";
import { DOC_GROUPS, DOC_GUIDES, RELEASE_NOTES_SLUG, docPath, formatDocDate } from "@/lib/docs";
import { latestRelease } from "@/lib/release-notes";

export const metadata: Metadata = {
  title: "Yardım merkezi",
  description:
    "buyur QR menü rehberi: kurulum, kategori ve ürün yönetimi, çoklu dil ve yapay zekâ çevirisi, QR kodlar, kampanyalar, analiz ve sürüm notları.",
  alternates: { canonical: "/docs" },
};

export default function DocsIndexPage() {
  const latest = latestRelease();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-16 md:py-24">
        <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">Yardım merkezi</h1>
        <p className="mt-4 leading-relaxed text-ink-soft">
          Menünüzü kurmaktan misafir verisini okumaya kadar her şey adım adım. Aradığınızı bulamazsanız
          merhaba@buyur.in adresine yazın.
        </p>

        <Link
          href={docPath(RELEASE_NOTES_SLUG)}
          className="group mt-8 flex flex-col gap-1 rounded-md border border-line bg-crema px-5 py-4 transition-colors hover:border-paprika/50"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-paprika">
            Son sürüm · v{latest.version} · {formatDocDate(latest.date)}
          </span>
          <span className="font-display font-bold transition-colors group-hover:text-paprika">{latest.title}</span>
          <span className="text-sm text-ink-soft">Bütün sürüm notlarını görün →</span>
        </Link>

        {DOC_GROUPS.map((group) => {
          const guides = DOC_GUIDES.filter((guide) => guide.group === group);
          if (guides.length === 0) return null;
          return (
            <section key={group} className="mt-12">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{group}</h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {guides.map((guide) => (
                  <li key={guide.slug}>
                    <Link href={docPath(guide.slug)} className="group flex flex-col gap-1 py-5">
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
      <Footer />
    </>
  );
}
