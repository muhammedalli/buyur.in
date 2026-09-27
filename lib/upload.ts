import { pb } from "@/lib/pocketbase";
import { msg } from "@/lib/ui-i18n";

export type UploadKind = "logo" | "cover" | "product" | "popup" | "category";

// `name` dosyanın MinIO'daki adını okunaklı yapar (ör. "kuru-fasulye-20260918-143052.jpg").
// Boş bırakılırsa yalnızca tarih damgası kullanılır.
export async function uploadFile(file: File, businessId: string, kind: UploadKind, name?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("businessId", businessId);
  form.append("kind", kind);
  if (name?.trim()) form.append("name", name.trim());

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: pb.authStore.token },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? msg("Yükleme başarısız oldu."));
  }
  return data.url as string;
}
