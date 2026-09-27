import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/chrome";
import { DocumentLang } from "@/components/document-lang";
import { DocGuideView, DocsIndexView, ReleaseNotesView, docsCopy } from "@/components/docs-view";
import { DOC_GUIDES, RELEASE_NOTES_SLUG, docGuide, docPath, docSlugFromPath, docsHome } from "@/lib/docs";
import { RELEASE_NOTES } from "@/lib/release-notes";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { UI_LOCALES, uiOgLocales, type UiLocale } from "@/lib/ui-i18n";

// Yardım merkezi sayfaları iki dilde aynı koddan kurulur: app/docs/** (tr) ve
// app/en/docs/** (en) yalnızca dili verip buradakileri çağırır.

function alternates(pathFor: (locale: UiLocale) => string, locale: UiLocale): Metadata["alternates"] {
  const languages = Object.fromEntries(UI_LOCALES.map((option) => [option, pathFor(option)]));
  return { canonical: pathFor(locale), languages: { ...languages, "x-default": pathFor("tr") } };
}

function hrefs(pathFor: (locale: UiLocale) => string): Record<UiLocale, string> {
  return Object.fromEntries(UI_LOCALES.map((option) => [option, pathFor(option)])) as Record<UiLocale, string>;
}

function Shell({ locale, languageHrefs, children }: { locale: UiLocale; languageHrefs: Record<UiLocale, string>; children: React.ReactNode }) {
  return (
    <>
      <DocumentLang lang={locale} />
      <div lang={locale} className="contents">
        <Navbar locale={locale} languageHrefs={languageHrefs} />
        {children}
        <Footer locale={locale} />
      </div>
    </>
  );
}

export function docsIndexMetadata(locale: UiLocale): Metadata {
  const copy = docsCopy(locale);
  return {
    title: copy.helpCenter,
    description:
      locale === "en"
        ? "buyur QR menu guide: setup, managing categories and products, multiple languages and AI translation, QR codes, campaigns, analytics and release notes."
        : "buyur QR menü rehberi: kurulum, kategori ve ürün yönetimi, çoklu dil ve yapay zekâ çevirisi, QR kodlar, kampanyalar, analiz ve sürüm notları.",
    alternates: alternates(docsHome, locale),
    openGraph: { locale: uiOgLocales[locale] },
  };
}

export function DocsIndexPage({ locale }: { locale: UiLocale }) {
  return (
    <Shell locale={locale} languageHrefs={hrefs(docsHome)}>
      <DocsIndexView locale={locale} />
    </Shell>
  );
}

/** Adres parçasından sayfanın Türkçe kimliğini ve başlığını çözer. */
function pageInfo(pathSlug: string, locale: UiLocale): { slug: string; title: string; description: string } | null {
  const slug = docSlugFromPath(pathSlug, locale);
  if (!slug) return null;
  if (slug === RELEASE_NOTES_SLUG) {
    return {
      slug,
      title: docsCopy(locale).notesTitle,
      description:
        locale === "en"
          ? "New features, improvements and fixes in buyur."
          : "buyur'a gelen yenilikler, iyileştirmeler ve düzeltmeler.",
    };
  }
  const guide = docGuide(slug, locale);
  return guide ? { slug, title: guide.title, description: guide.summary } : null;
}

export function docStaticParams(locale: UiLocale) {
  return [...DOC_GUIDES.map((guide) => guide.slug), RELEASE_NOTES_SLUG].map((slug) => ({
    doc: docPath(slug, locale).split("/").pop()!,
  }));
}

export function docMetadata(pathSlug: string, locale: UiLocale): Metadata {
  const info = pageInfo(pathSlug, locale);
  if (!info) return {};
  return {
    title: info.title,
    description: info.description,
    alternates: alternates((option) => docPath(info.slug, option), locale),
    openGraph: { locale: uiOgLocales[locale] },
  };
}

export function DocPage({ pathSlug, locale }: { pathSlug: string; locale: UiLocale }) {
  const info = pageInfo(pathSlug, locale);
  if (!info) notFound();
  const guide = docGuide(info.slug, locale);

  const breadcrumbs = breadcrumbJsonLd(
    [
      { name: docsCopy(locale).helpCenter, path: docsHome(locale) },
      { name: info.title, path: docPath(info.slug, locale) },
    ],
    locale === "en" ? { name: "Home", path: "/en" } : undefined
  );

  return (
    <Shell locale={locale} languageHrefs={hrefs((option) => docPath(info.slug, option))}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <main>
        {guide ? <DocGuideView guide={guide} locale={locale} /> : <ReleaseNotesView notes={RELEASE_NOTES} locale={locale} />}
      </main>
    </Shell>
  );
}
