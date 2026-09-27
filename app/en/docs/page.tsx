import { DocsIndexPage, docsIndexMetadata } from "@/components/docs-page";

// Yardım merkezi (en). Sayfa kurulumu components/docs-page.tsx'te, iki dil ortak.
export const metadata = docsIndexMetadata("en");

export default function Page() {
  return <DocsIndexPage locale="en" />;
}
