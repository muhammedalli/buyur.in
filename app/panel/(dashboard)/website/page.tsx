"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { buttonClass, Card, PageHeader, SectionHeader, Switch } from "@/components/panel/ui";
import { CheckCircleIcon, ExternalLinkIcon, GlobeIcon, MonitorIcon } from "@/components/icons";
import { menuUrl } from "@/lib/site";
import { isFeatureAvailable } from "@/lib/entitlements";
import { hasActiveWebsite } from "@/lib/storefront";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";
import type { Business } from "@/lib/types";

// Web sitesi ve vitrin sayfası. Düzenlenecek içerik yok — bilinçli olarak:
// vitrin (isletme.buyur.in) panelde girilen bilgilerden otomatik üretilir.
//   · Web sitesi (Elite) yayındaysa vitrin = restoran sitesi
//   · Değilse vitrin = otomatik karşılama sayfası ("Menüyü gör")
// Sayfanın işi adresi vermek, vitrinde neyin göründüğünü göstermek, siteyi
// yayına alıp kaldırmak ve eksik bilgiyi hatırlatmak.

const SITE_CONTENT = [
  msg("İşletme adı, logo ve kapak görseli"),
  msg("Açıklamanız ve mekân özellikleriniz"),
  msg("Menüden öne çıkan ürünler ve kategoriler"),
  msg("Ürün görsellerinden otomatik galeri"),
  msg("Animasyonlu tanıtım, menü slider'ı ve kayan yazı"),
  msg("Çalışma saatleri, konum ve yol tarifi"),
  msg("Telefon, WhatsApp, e-posta ve sosyal medya"),
];

const WELCOME_CONTENT = [
  msg("Logo, kapak görseli, işletme adı ve açıklama"),
  msg("Büyük “Menüyü gör” butonu"),
  msg("Kayan yazı (açıksa)"),
  msg("Adres, çalışma saatleri, telefon ve Wi-Fi"),
  msg("Rezervasyon (WhatsApp/telefon) ve sosyal medya"),
];

function missingFields(business: Business) {
  return [
    { key: "cover", label: msg("Kapak görseli"), filled: Boolean(business.cover) },
    { key: "logo", label: msg("Logo"), filled: Boolean(business.logo) },
    { key: "description", label: msg("İşletme açıklaması"), filled: Boolean(business.description) },
    { key: "working_hours", label: msg("Çalışma saatleri"), filled: Boolean(business.working_hours) },
    { key: "address", label: msg("Adres"), filled: Boolean(business.address) },
    { key: "phone", label: msg("Telefon"), filled: Boolean(business.phone) },
    { key: "whatsapp", label: msg("WhatsApp (rezervasyon için)"), filled: Boolean(business.whatsapp) },
    { key: "google_maps_url", label: msg("Harita bağlantısı"), filled: Boolean(business.google_maps_url) },
  ];
}

export default function WebsitePage() {
  const { business, setBusiness } = useBusiness();
  const { toast } = useToast();
  const { t } = useUiLocale();
  const [storefrontUrl, setStorefrontUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) setStorefrontUrl(menuUrl(business.slug));
  }, [business]);

  if (!business) return null;

  const planHasWebsite = isFeatureAvailable(business, "website");
  const siteLive = hasActiveWebsite(business);
  const missing = missingFields(business);
  const missingCount = missing.filter((item) => !item.filled).length;

  async function setSiteLive(live: boolean) {
    if (!business) return;
    setSaving(true);
    try {
      const updated = await pb.collection(BUSINESS_COLLECTION).update<Business>(business.id, { site_disabled: !live });
      setBusiness(updated);
      toast(live ? t("Web siteniz yayında") : t("Web siteniz yayından kaldırıldı; vitrinde karşılama sayfası görünüyor"));
    } catch {
      toast(t("Kaydedilemedi, tekrar dene."), "error");
    } finally {
      setSaving(false);
    }
  }

  const status = siteLive
    ? t("Ziyaretçiler web sitenizi görüyor.")
    : planHasWebsite
      ? t("Web siteniz kapalı; ziyaretçiler otomatik karşılama sayfanızı görüyor.")
      : t("Ziyaretçiler işletme bilgilerinizden otomatik oluşan karşılama sayfanızı görüyor.");

  return (
    <div>
      <PageHeader
        title={t("Web sitesi ve vitrin")}
        description={t("isletmeniz.buyur.in adresi vitrininizdir — panelde girdiğiniz bilgilerden otomatik oluşur")}
        action={
          <a href={storefrontUrl} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
            <ExternalLinkIcon size={15} /> {t("Vitrini aç")}
          </a>
        }
      />

      <Card className="space-y-5" data-guide="website">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <GlobeIcon size={14} /> {t("Vitrin adresiniz")}
            </p>
            <p className="mt-1 truncate font-display text-lg font-bold text-paprika">{storefrontUrl}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
              <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${siteLive ? "bg-herb" : "bg-paprika"}`} />
              {status}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(storefrontUrl);
              toast(t("Vitrin adresi kopyalandı"));
            }}
            className={buttonClass("outline", "shrink-0")}
          >
            {t("Adresi kopyala")}
          </button>
        </div>

        {planHasWebsite && (
          <div className="border-t border-line pt-4">
            <Switch
              checked={siteLive}
              onChange={(value) => !saving && setSiteLive(value)}
              label={t("Web sitesi yayında")}
              description={t(
                "Açıkken isletmeniz.buyur.in adresi web sitenizi açar. Kapatırsanız aynı adreste otomatik karşılama sayfası görünür; siteniz silinmez, istediğiniz an geri açabilirsiniz."
              )}
            />
          </div>
        )}

        <p className="rounded-md bg-crema/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
          {t(
            "Masadaki QR kodlar vitrine uğramadan doğrudan menüyü açar. Vitrindeki “Menüyü gör” butonu da menünüze götürür; menüdeki bilgi bölümünden de siteye dönülebilir."
          )}
        </p>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title={siteLive ? t("Sitede ne görünüyor") : t("Karşılama sayfasında ne görünüyor")}
            action={<MonitorIcon size={18} className="text-ink-soft" />}
          />
          <ul className="mt-3 space-y-2 text-sm">
            {(siteLive ? SITE_CONTENT : WELCOME_CONTENT).map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-herb" aria-hidden>
                  <CheckCircleIcon size={15} />
                </span>
                {t(line)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            {t(
              "Menüde ya da ayarlarda yaptığınız her değişiklik vitrine kendiliğinden yansır. Ayrı bir içerik yönetimi yoktur — tek kaynak paneldir."
            )}
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium text-ink-soft">
            {missingCount === 0 ? t("Bilgileriniz tam") : t("Vitrini güçlendirin ({count} eksik)", { count: missingCount })}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {missing.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3">
                <span className={item.filled ? "" : "text-ink-soft"}>{t(item.label)}</span>
                {item.filled ? (
                  <span className="text-herb" aria-label={t("dolu")}>
                    <CheckCircleIcon size={15} />
                  </span>
                ) : (
                  <Link
                    href={item.key === "whatsapp" ? "/panel/settings?tab=social" : item.key === "google_maps_url" || item.key === "address" || item.key === "working_hours" ? "/panel/settings?tab=contact" : "/panel/settings?tab=general"}
                    className="text-xs font-medium text-paprika transition-colors hover:text-paprika-deep"
                  >
                    {t("Ekle")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            {t("Eksik bilgiye ait bölüm vitrinde hiç gösterilmez; boş bir alan görünmez.")}
          </p>
        </Card>
      </div>

      {!planHasWebsite && (
        <div className="mt-6">
          <FeatureLocked
            feature="website"
            subject={t("Web sitesi")}
            description={t(
              "Panelde girdiğiniz bilgilerden (menü, görseller, çalışma saatleri, konum, iletişim) otomatik bir restoran web sitesi oluşturulur ve vitrin adresinizde yayınlanır. Animasyonlu tanıtım, menü slider'ı ve galeri dahildir."
            )}
          />
        </div>
      )}
    </div>
  );
}
