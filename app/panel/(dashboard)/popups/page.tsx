"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { Button, buttonClass, Card, EmptyState, FooterNote, PageHeader, UpdatedAt } from "@/components/panel/ui";
import { isFeatureAvailable } from "@/lib/entitlements";
import type { Popup } from "@/lib/types";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";

export default function AnnouncementsPage() {
  const { business, isLoading: businessLoading } = useBusiness();
  const { toast } = useToast();
  const { t } = useUiLocale();
  const [confirm, confirmDialog] = useConfirm();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Kampanya kapısı canlı plan kaydından okunur (BusinessProvider katalogu yükler).
  const campaignsAllowed = business ? isFeatureAvailable(business, "campaigns") : null;
  const businessId = business?.id;

  // requestKey: null — aynı isteğin tekrarı (StrictMode, hızlı gezinme) SDK
  // tarafından iptal edilip yakalanmamış hata olarak düşmesin. Hata olursa
  // sayfa "Yükleniyor"da asılı kalmaz, tekrar deneme sunulur.
  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const list = await pb.collection("buyur_popups").getFullList<Popup>({
        filter: pb.filter("business = {:id}", { id: businessId }),
        sort: "-created",
        requestKey: null,
      });
      setPopups(list);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(popup: Popup) {
    const ok = await confirm({
      title: t("Kampanya silinsin mi?"),
      description: t("“{title}” menüden kaldırılır ve geri alınamaz.", { title: popup.title }),
      confirmLabel: t("Sil"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await pb.collection("buyur_popups").delete(popup.id, { requestKey: null });
      setPopups((list) => list.filter((item) => item.id !== popup.id));
      toast(t("Kampanya silindi"));
    } catch {
      toast(t("Kampanya silinemedi, tekrar dene."), "error");
    }
  }

  if (businessLoading || loading) {
    return <p className="text-ink-soft">{t("Yükleniyor…")}</p>;
  }

  if (loadFailed) {
    return (
      <div>
        <PageHeader title={t("Kampanyalar")} description={t("Müşteri menüyü açtığında gösterilecek kampanya ya da duyuru.")} />
        <EmptyState
          title={t("Kampanyalar yüklenemedi")}
          description={t("Bağlantıda geçici bir sorun olabilir.")}
          action={
            <Button type="button" variant="outline" onClick={load}>
              {t("Tekrar dene")}
            </Button>
          }
        />
      </div>
    );
  }

  // Listedeki en yeni kayıt zamanı — sağ alttaki bilgi satırında gösterilir.
  const latestUpdate = popups.reduce<string | null>((max, item) => (!max || item.updated > max ? item.updated : max), null);

  return (
    <div>
      <PageHeader
        title={t("Kampanyalar")}
        description={t("Müşteri menüyü açtığında gösterilecek kampanya ya da duyuru.")}
        action={
          campaignsAllowed && (
            <Link href="/panel/popups/new" className={buttonClass("primary")}>
              {t("+ Yeni kampanya")}
            </Link>
          )
        }
      />

      {campaignsAllowed === false && (
        <FeatureLocked
          feature="campaigns"
          subject={t("Kampanyalar")}
          description={t("Menü açıldığında gösterilen kampanya ve duyuru pencereleri.")}
        />
      )}

      {campaignsAllowed && popups.length === 0 && (
        <EmptyState
          title={t("Henüz duyuru yok")}
          description={t("Menü açıldığında gösterilecek bir kampanya duyurusu oluştur.")}
          action={
            <Link href="/panel/popups/new" className={buttonClass("primary")}>
              {t("+ Yeni kampanya")}
            </Link>
          }
        />
      )}

      <div className="space-y-3">
        {popups.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 basis-60 items-center gap-4">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0">
                <p className="font-display font-bold">
                  {p.title}{" "}
                  {!p.is_active && (
                    <span className="text-xs font-medium text-ink-soft">{t("(pasif)")}</span>
                  )}
                </p>
                {p.message && <p className="text-sm text-ink-soft">{p.message}</p>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/panel/popup/${p.id}`} className={buttonClass("outline")}>
                {t("Düzenle")}
              </Link>
              <Button variant="danger" onClick={() => handleDelete(p)}>
                {t("Sil")}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <FooterNote>
        <UpdatedAt at={latestUpdate} />
      </FooterNote>
      {confirmDialog}
    </div>
  );
}
