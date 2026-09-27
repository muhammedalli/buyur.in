import { DocsIndexPage, docsIndexMetadata } from "@/components/docs-page";

// Yardım merkezi (tr). Sayfa kurulumu components/docs-page.tsx'te, iki dil ortak.
export const metadata = docsIndexMetadata("tr");

export default function Page() {
  return <DocsIndexPage locale="tr" />;
}
