import { redirect } from "next/navigation";

export default async function BusinessMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/menu`);
}
