"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { PopupForm } from "@/components/panel/popup-form";
import { PageHeader } from "@/components/panel/ui";
import type { Popup } from "@/lib/types";

export default function EditAnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { business, isLoading: businessLoading } = useBusiness();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [loading, setLoading] = useState(true);
  const businessId = business?.id;

  // İşletme kaydı tazelendiğinde (sekmeye dönüş) kayıt yeniden okunmaz;
  // yalnızca başka bir kayda/işletmeye geçildiğinde okunur.
  useEffect(() => {
    if (!businessId) return;
    // requestKey: null -> React StrictMode'un dev'de effect'i iki kez
    // çalıştırması bu isteği SDK'nın otomatik iptal etmesine yol açabilir;
    // iptal edilen isteği "kayıt bulunamadı" sanıp listeye atmayalım.
    pb.collection("buyur_popups")
      .getOne<Popup>(id, { requestKey: null })
      .then(setPopup)
      .catch((err) => {
        const isCancelled = err instanceof ClientResponseError && err.isAbort;
        if (!isCancelled) router.replace("/panel/popups");
      })
      .finally(() => setLoading(false));
  }, [businessId, id, router]);

  if (businessLoading || loading || !business || !popup) {
    return <p className="text-ink-soft">Yükleniyor…</p>;
  }

  return (
    <div>
      <PageHeader title={popup.title} />
      <PopupForm
        key={popup.id}
        business={business}
        initial={popup}
        onSaved={(updated) => {
          setPopup(updated);
        }}
      />
    </div>
  );
}
