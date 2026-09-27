import { redirect } from "next/navigation";
import { isTableScan } from "@/lib/storefront-route";

// Kök alan yolu (buyur.in/{slug}): alt alan adındaki davranışın aynısı —
// masadaki QR taraması menüye, diğer her ziyaret işletmenin vitrinine
// (web sitesi ya da otomatik karşılama; bkz. lib/storefront.ts).
export default async function BusinessRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(isTableScan(query) ? `/${slug}/menu${suffix}` : `/site/${slug}${suffix}`);
}
