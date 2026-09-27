import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Eski karşılama adresi (/welcome). Karşılama artık işletmenin vitrininde
// (isletme.buyur.in kökü, components/site/business-welcome.tsx); iki ayrı
// karşılama sayfası bakımı yapılmasın diye buradan oraya yönlendirilir.
export default async function LegacyWelcomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const onSubdomain = (await headers()).get("x-buyur-rewrite") === "subdomain";
  redirect(onSubdomain ? "/" : `/site/${slug}`);
}
