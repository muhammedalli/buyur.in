import type { Metadata } from "next";
import { DocPage, docMetadata, docStaticParams } from "@/components/docs-page";

// Rehberler ve sürüm notları (en) tamamen statiktir; veritabanına bağlı değildir.
export function generateStaticParams() {
  return docStaticParams("en");
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return docMetadata(doc, "en");
}

export default async function Page({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  return <DocPage pathSlug={doc} locale="en" />;
}
