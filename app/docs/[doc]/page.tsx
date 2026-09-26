import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/chrome";
import { DocGuideView, ReleaseNotesView } from "@/components/docs-view";
import { DOC_GUIDES, RELEASE_NOTES_SLUG, docGuide, docPath } from "@/lib/docs";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

// Rehberler ve sürüm notları tamamen statiktir; veritabanına bağlı değildir.
export function generateStaticParams() {
  return [...DOC_GUIDES.map((guide) => ({ doc: guide.slug })), { doc: RELEASE_NOTES_SLUG }];
}

export const dynamicParams = false;

function pageInfo(slug: string): { title: string; description: string } | null {
  if (slug === RELEASE_NOTES_SLUG) {
    return { title: "Sürüm notları", description: "buyur'a gelen yenilikler, iyileştirmeler ve düzeltmeler." };
  }
  const guide = docGuide(slug);
  return guide ? { title: guide.title, description: guide.summary } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc: slug } = await params;
  const info = pageInfo(slug);
  if (!info) return {};
  return { ...info, alternates: { canonical: docPath(slug) } };
}

export default async function DocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: slug } = await params;
  const info = pageInfo(slug);
  if (!info) notFound();
  const guide = docGuide(slug);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Yardım merkezi", path: "/docs" },
    { name: info.title, path: docPath(slug) },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <Navbar />
      <main>{guide ? <DocGuideView guide={guide} /> : <ReleaseNotesView notes={RELEASE_NOTES} />}</main>
      <Footer />
    </>
  );
}
