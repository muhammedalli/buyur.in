"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { isReservedSlug, slugify } from "@/lib/slug";
import { Button, buttonClass, Card, ErrorText, FooterNote, Input, Label, PageHeader, StatGroup, UpdatedAt } from "@/components/panel/ui";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { QrShare } from "@/components/panel/qr-share";
import { LaunchChecklist } from "@/components/panel/launch-checklist";
import { useUiLocale } from "@/components/ui-locale-provider";
import { ROOT_DOMAIN, menuHost } from "@/lib/site";
import { AnalyticsError, fetchAnalytics } from "@/lib/analytics/panel-client";
import { PLAN_LABELS, freemiumUsage, isFeatureAvailable, normalizePlan } from "@/lib/entitlements";
import { SECTOR_TEMPLATES, sectorTemplate, type SectorKey } from "@/lib/sector-templates";
import { saveActivation } from "@/lib/activation";
import { trackMarketingEvent } from "@/lib/marketing-events";
import { readPlanIntent, type PlanIntent } from "@/lib/plan-intent";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { CompassIcon, PencilIcon } from "@/components/icons";
import type { Translator } from "@/lib/ui-i18n";
import type { Business } from "@/lib/types";

/** Karşılama maili kurulumun bir parçası değil, sonrası. Bilerek beklenmiyor
 *  ve hatası yutuluyor: Brevo'ya gidilemediği için kullanıcı menüsünün
 *  açıldığı ekranı görememezlik etmesin.
 *
 *  keepalive şart: hemen ardından setBusiness() onboarding ekranını söküyor ve
 *  tarayıcı, bekleyen isteği iptal ediyor. Canlıda mail bu yüzden gitmiyordu. */
function sendWelcomeEmail() {
  void fetch("/api/emails/welcome", {
    method: "POST",
    headers: { Authorization: pb.authStore.token },
    keepalive: true,
  }).catch(() => undefined);
}

/** Kurulum ekranı: kayıtta girilen işletme adı hazır gelir (tekrar sorulmaz,
 *  istenirse düzeltilir); yalnızca eksik olan menü adresi ve işletme türü
 *  istenir. Kurulum bitince panel açılır ve kılavuz kendiliğinden başlar
 *  (components/panel/guide.tsx). */
function Onboarding() {
  const { account, setBusiness } = useBusiness();
  const { t } = useUiLocale();
  const knownName = account?.name?.trim() ?? "";
  const [name, setName] = useState(knownName);
  const [editName, setEditName] = useState(!knownName);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [sector, setSector] = useState<SectorKey | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!account) return;
    setError("");

    if (!name.trim()) {
      setError(t("İşletme adını gir."));
      setEditName(true);
      return;
    }
    if (!slug) {
      setError(t("Menü adresi boş olamaz."));
      return;
    }
    if (isReservedSlug(slug)) {
      setError(t("Bu adres sisteme ayrılmış, başka bir tane seç."));
      return;
    }
    if (!sector) {
      setError(t("İşletme türünü seç — kategorilerin buna göre hazır gelecek."));
      return;
    }

    const template = sectorTemplate(sector);
    setLoading(true);
    try {
      // Hesap kayıtta açıldı (telefon, plan ve deneme süresi sunucuda yazıldı);
      // burada yalnızca işletmenin adı, adresi ve menü şablonu tamamlanır ve
      // menü yayına girer.
      const business = await pb.collection(BUSINESS_COLLECTION).update<Business>(account.id, {
        name: name.trim(),
        slug,
        template: template.template,
        is_active: true,
      });

      // Sektör şablonu: Kategoriler ve varsa örnek ürünleri oluşturulur.
      // Ürünü olmayan kategori müşteri menüsünde görünmez; bir tanesi açılamazsa kurulum durmaz.
      for (const [order, categoryData] of template.categories.entries()) {
        try {
          const categoryRecord = await pb.collection("buyur_categories").create({
            business: business.id,
            name: categoryData.name,
            order,
            is_active: true,
          });

          for (const [productOrder, productData] of categoryData.products.entries()) {
            try {
              await pb.collection("buyur_products").create({
                business: business.id,
                category: categoryRecord.id,
                name: productData.name,
                description: productData.description,
                price: productData.price,
                is_available: true,
                order: productOrder,
              });
            } catch {
              /* ürün eklenemezse atla */
            }
          }
        } catch {
          /* bir kategori açılamadıysa kullanıcı panelden ekleyebilir */
        }
      }

      const withSector = await saveActivation(business, { sector });
      trackMarketingEvent("business_created", { sector });
      sendWelcomeEmail();
      setBusiness(withSector ?? business);
    } catch (err) {
      if (err instanceof ClientResponseError && err.response?.data?.slug) {
        setError(t("Bu adres zaten kullanılıyor, başka bir isim dene."));
      } else {
        setError(t("Bir şeyler ters gitti, tekrar dene."));
      }
    } finally {
      setLoading(false);
    }
  }

  const selected = sector ? sectorTemplate(sector) : null;

  return (
    <div className="mx-auto max-w-xl">
      <p className="rise rise-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-paprika">
        <CompassIcon size={14} /> {t("Hoş geldin")}
      </p>
      <h1 className="rise rise-2 mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        {t("buyur.in'de işletmenizi oluşturmaya başlayalım.")}
      </h1>
      <p className="rise rise-3 mt-2 text-sm text-ink-soft">
        {t("İki kısa bilgi yeterli. Sonra panel sizi adım adım gezdirecek: logo, kategoriler, ürünler ve paylaşım.")}
      </p>
      <Card className="rise rise-4 mt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="name">{t("İşletme adı")}</Label>
            {editName ? (
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alpha Cafe" />
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-crema/40 px-3.5 py-2.5">
                <span className="truncate text-sm font-semibold">{name}</span>
                <button
                  type="button"
                  onClick={() => setEditName(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
                >
                  <PencilIcon size={13} /> {t("Düzenle")}
                </button>
              </div>
            )}
            {!editName && <p className="mt-1.5 text-xs text-ink-soft">{t("Kayıt olurken girdiğin ad kullanılıyor.")}</p>}
          </div>
          <div>
            <Label htmlFor="slug">{t("Menü adresi")}</Label>
            <div className="flex items-center gap-1 rounded-md border border-line bg-crema/40 px-4 py-2.5 text-sm">
              <input
                id="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                className="min-w-0 flex-1 bg-transparent text-right text-ink outline-none"
              />
              <span className="shrink-0 text-ink-soft">.{ROOT_DOMAIN}</span>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              {t("Vitrininiz ve menünüz bu adreste yayınlanır; QR kodunuz da buna göre oluşur.")}
            </p>
          </div>

          <fieldset>
            <legend className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {t("İşletme türün")}
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              {SECTOR_TEMPLATES.map((item) => {
                const active = sector === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSector(item.key)}
                    className={`rounded-md border px-4 py-3 text-left transition-colors ${
                      active ? "border-paprika bg-paprika/5" : "border-line hover:border-ink/30"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${active ? "text-paprika" : ""}`}>{t(item.label)}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{t(item.description)}</span>
                  </button>
                );
              })}
            </div>
            {selected && selected.categories.length > 0 && (
              <p className="mt-3 rounded-md bg-crema/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">{t("Hazır gelecek kategoriler:")} </span>
                {selected.categories.map((c) => c.name).join(", ")}.{" "}
                {t("İstediğini silip yeniden adlandırabilirsin; ürün eklemediğin kategoriler menüde görünmez.")}
              </p>
            )}
          </fieldset>

          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} className="w-full">
            {t("Menümü oluştur")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

interface OverviewSummary {
  totals: { page_views?: number; sessions?: number; visitors?: number; qr_scans?: number; cart_adds?: number };
  series: { page_views?: { date: string; value: number }[] };
  topProducts?: { key: string; label: string; metrics: Record<string, number> }[];
  topCategories?: { key: string; label: string; metrics: Record<string, number> }[];
}

function BarList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  const { t } = useUiLocale();
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <Card>
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t("Henüz veri yok.")}</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 font-mono text-xs font-semibold">{item.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-crema">
                <div className="h-full rounded-full bg-paprika" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Panel ana sayfasındaki özet — tek bir agregat isteği: /api/analytics/overview. */
function StatsSection({ business }: { business: Business }) {
  const { t, formatNumber } = useUiLocale();
  const [data, setData] = useState<OverviewSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailed(false);

    fetchAnalytics<OverviewSummary>(
      "overview",
      { preset: "last_30", compare: "none", rev: business.plan },
      controller.signal
    )
      .then((response) => setData(response.data))
      .catch((err) => {
        // Sayfadan çıkınca istek iptal edilir; bu bir hata değil.
        if (controller.signal.aborted) return;
        if (err instanceof AnalyticsError && err.isPlanLocked) return;
        setFailed(true);
      });

    return () => controller.abort();
  }, [business.id, business.plan, nonce]);

  if (failed) {
    return (
      <Card className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{t("İstatistikler şu anda yüklenemiyor.")}</p>
        <Button type="button" variant="outline" onClick={() => setNonce((value) => value + 1)}>
          {t("Tekrar dene")}
        </Button>
      </Card>
    );
  }

  if (!data) return <p className="mt-8 text-sm text-ink-soft">{t("İstatistikler yükleniyor…")}</p>;

  const totals = data.totals ?? {};
  const series = data.series?.page_views ?? [];
  const todayViews = series.length > 0 ? (series[series.length - 1]?.value ?? 0) : 0;

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-bold">{t("Ziyaretçi istatistikleri")}</h2>
        <div className="flex items-baseline gap-3 whitespace-nowrap">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{t("Son 30 gün")}</span>
          <Link
            href="/panel/analytics"
            className="font-mono text-[11px] uppercase tracking-wider text-paprika transition-colors hover:text-paprika-deep"
          >
            {t("Detaylı analiz →")}
          </Link>
        </div>
      </div>

      <StatGroup
        items={[
          { label: t("Sayfa görüntülenme"), value: formatNumber(totals.page_views ?? 0) },
          { label: t("Bugün"), value: formatNumber(todayViews) },
          { label: t("Sepete ekleme"), value: formatNumber(totals.cart_adds ?? 0) },
        ]}
      />

      {(data.topProducts || data.topCategories) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BarList
            title={t("En çok görüntülenen ürünler")}
            items={(data.topProducts ?? []).map((item) => ({ label: item.label, count: item.metrics.views ?? 0 }))}
          />
          <BarList
            title={t("En çok görüntülenen kategoriler")}
            items={(data.topCategories ?? []).map((item) => ({ label: item.label, count: item.metrics.views ?? 0 }))}
          />
        </div>
      )}
    </div>
  );
}

/** Plan hücresinin alt satırı: süreli planda kalan gün ve görüntülenme, ücretli
 *  planda sınır olmadığı. Ayrıntılı ölçüler plan sayfasında. */
function planHint(business: Business, t: Translator, formatNumber: (value: number) => string): string {
  const usage = freemiumUsage(business);
  if (!usage.limited) return t("Süre ve görüntülenme sınırı yok");
  if (usage.exhausted) return t("Limit doldu — planını yükselt");
  const parts: string[] = [];
  if (usage.daysLeft !== null) parts.push(t("{count} gün kaldı", { count: usage.daysLeft }));
  if (usage.menuViewLimit !== null) {
    parts.push(
      t("{views}/{limit} görüntülenme", { views: formatNumber(usage.menuViews), limit: formatNumber(usage.menuViewLimit) })
    );
  }
  return parts.join(" · ");
}

/** Landing'de "Premium'u başlat" deyip gelen Freemium işletmeye kaldığı yeri hatırlatır. */
function PlanIntentNotice({ business }: { business: Business }) {
  const { t } = useUiLocale();
  const [intent, setIntent] = useState<PlanIntent | null>(null);

  useEffect(() => {
    setIntent(readPlanIntent());
  }, []);

  const current = normalizePlan(business.plan);
  if (!intent || current !== "freemium") return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-paprika/30 bg-paprika/5 px-5 py-4">
      <p className="text-sm">
        <span className="font-semibold">{t("{plan} planını başlatmak istiyordun.", { plan: PLAN_LABELS[intent.plan] })}</span>{" "}
        <span className="text-ink-soft">{t("Menünü kurarken istediğin an geçişi başlatabilirsin.")}</span>
      </p>
      <Link href="/panel/plan" className={buttonClass("primary")}>
        {t("Planı başlat")}
      </Link>
    </div>
  );
}

function Overview({ business }: { business: Business }) {
  const { t, formatNumber } = useUiLocale();
  const [counts, setCounts] = useState<{ categories: number; products: number } | null>(null);
  // Yetki kararı veritabanındaki (bayat kalabilen) plan limitlerinden değil,
  // yetki matrisinin tek kaynağından: Freemium'da temel analiz açıktır.
  const analyticsAllowed = isFeatureAvailable(business, "basic_analytics");

  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      try {
        const [categories, products] = await Promise.all([
          pb.collection("buyur_categories").getList(1, 1, {
            filter: pb.filter("business = {:id}", { id: business.id }),
            requestKey: null,
          }),
          pb.collection("buyur_products").getList(1, 1, {
            filter: pb.filter("business = {:id}", { id: business.id }),
            requestKey: null,
          }),
        ]);
        if (!cancelled) setCounts({ categories: categories.totalItems, products: products.totalItems });
      } catch {
        if (!cancelled) setCounts({ categories: 0, products: 0 });
      }
    }
    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  return (
    <div>
      <PageHeader title={business.name} description={menuHost(business.slug)} />
      <PlanIntentNotice business={business} />
      <LaunchChecklist business={business} counts={counts} />
      <StatGroup
        items={[
          { label: t("Kategori"), value: counts?.categories ?? "—", href: "/panel/categories" },
          { label: t("Ürün"), value: counts?.products ?? "—", href: "/panel/products" },
          {
            label: t("Plan"),
            value: PLAN_LABELS[normalizePlan(business.plan)],
            hint: planHint(business, t, formatNumber),
            href: "/panel/plan",
          },
        ]}
      />
      <QrShare business={business} />
      {analyticsAllowed ? (
        <StatsSection business={business} />
      ) : (
        <div className="mt-10">
          <FeatureLocked
            feature="basic_analytics"
            subject={t("Ziyaretçi istatistikleri")}
            description={t("Sayfa görüntülenme, en çok bakılan ürün ve kategori gibi istatistikler.")}
          />
        </div>
      )}

      <FooterNote>
        <UpdatedAt at={business.updated} label={t("İşletme bilgileri güncellendi")} />
      </FooterNote>
    </div>
  );
}

export default function DashboardHome() {
  const { business, isLoading } = useBusiness();

  if (isLoading) return null;
  if (!business) return <Onboarding />;
  return <Overview business={business} />;
}
