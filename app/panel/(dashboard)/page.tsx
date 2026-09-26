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
import { ROOT_DOMAIN, menuHost } from "@/lib/site";
import { AnalyticsError, fetchAnalytics } from "@/lib/analytics/panel-client";
import { PLAN_LABELS, freemiumUsage, isFeatureAvailable, normalizePlan } from "@/lib/entitlements";
import { SECTOR_TEMPLATES, sectorTemplate, type SectorKey } from "@/lib/sector-templates";
import { saveActivation } from "@/lib/activation";
import { trackMarketingEvent } from "@/lib/marketing-events";
import { readPlanIntent, type PlanIntent } from "@/lib/plan-intent";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
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

function Onboarding() {
  const { account, setBusiness } = useBusiness();
  const [name, setName] = useState(account?.name ?? "");
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
      setError("İşletme adını gir.");
      return;
    }
    if (!slug) {
      setError("Menü adresi boş olamaz.");
      return;
    }
    if (isReservedSlug(slug)) {
      setError("Bu adres sisteme ayrılmış, başka bir tane seç.");
      return;
    }
    if (!sector) {
      setError("İşletme türünü seç — kategorilerin buna göre hazır gelecek.");
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
        setError("Bu adres zaten kullanılıyor, başka bir isim dene.");
      } else {
        setError("Bir şeyler ters gitti, tekrar dene.");
      }
    } finally {
      setLoading(false);
    }
  }

  const selected = sector ? sectorTemplate(sector) : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Hoş geldin</h1>
      <p className="mt-2 text-sm text-ink-soft">Menünü oluşturmadan önce işletmeni tanıyalım.</p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="name">İşletme adı</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alpha Cafe" />
          </div>
          <div>
            <Label htmlFor="slug">Menü adresi</Label>
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
          </div>

          <fieldset>
            <legend className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              İşletme türün
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
                    <span className={`block text-sm font-semibold ${active ? "text-paprika" : ""}`}>{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{item.description}</span>
                  </button>
                );
              })}
            </div>
            {selected && selected.categories.length > 0 && (
              <p className="mt-3 rounded-md bg-crema/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">Hazır gelecek kategoriler: </span>
                {selected.categories.map((c) => c.name).join(", ")}. İstediğini silip yeniden adlandırabilirsin; ürün eklemediğin
                kategoriler menüde görünmez.
              </p>
            )}
          </fieldset>

          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} className="w-full">
            Menümü oluştur
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
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <Card>
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Henüz veri yok.</p>
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
        <p className="text-sm text-ink-soft">İstatistikler şu anda yüklenemiyor.</p>
        <Button type="button" variant="outline" onClick={() => setNonce((value) => value + 1)}>
          Tekrar dene
        </Button>
      </Card>
    );
  }

  if (!data) return <p className="mt-8 text-sm text-ink-soft">İstatistikler yükleniyor…</p>;

  const totals = data.totals ?? {};
  const series = data.series?.page_views ?? [];
  const todayViews = series.length > 0 ? (series[series.length - 1]?.value ?? 0) : 0;

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-bold">Ziyaretçi istatistikleri</h2>
        <div className="flex items-baseline gap-3 whitespace-nowrap">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Son 30 gün</span>
          <Link
            href="/panel/analytics"
            className="font-mono text-[11px] uppercase tracking-wider text-paprika transition-colors hover:text-paprika-deep"
          >
            Detaylı analiz →
          </Link>
        </div>
      </div>

      <StatGroup
        items={[
          { label: "Sayfa görüntülenme", value: (totals.page_views ?? 0).toLocaleString("tr-TR") },
          { label: "Bugün", value: todayViews.toLocaleString("tr-TR") },
          { label: "Sepete ekleme", value: (totals.cart_adds ?? 0).toLocaleString("tr-TR") },
        ]}
      />

      {(data.topProducts || data.topCategories) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BarList
            title="En çok görüntülenen ürünler"
            items={(data.topProducts ?? []).map((item) => ({ label: item.label, count: item.metrics.views ?? 0 }))}
          />
          <BarList
            title="En çok görüntülenen kategoriler"
            items={(data.topCategories ?? []).map((item) => ({ label: item.label, count: item.metrics.views ?? 0 }))}
          />
        </div>
      )}
    </div>
  );
}

/** Plan hücresinin alt satırı: süreli planda kalan gün ve görüntülenme, ücretli
 *  planda sınır olmadığı. Ayrıntılı ölçüler plan sayfasında. */
function planHint(business: Business): string {
  const usage = freemiumUsage(business);
  if (!usage.limited) return "Süre ve görüntülenme sınırı yok";
  if (usage.exhausted) return "Limit doldu — planını yükselt";
  const parts: string[] = [];
  if (usage.daysLeft !== null) parts.push(`${usage.daysLeft} gün kaldı`);
  if (usage.menuViewLimit !== null) {
    parts.push(`${usage.menuViews.toLocaleString("tr-TR")}/${usage.menuViewLimit.toLocaleString("tr-TR")} görüntülenme`);
  }
  return parts.join(" · ");
}

/** Landing'de "Premium'u başlat" deyip gelen Freemium işletmeye kaldığı yeri hatırlatır. */
function PlanIntentNotice({ business }: { business: Business }) {
  const [intent, setIntent] = useState<PlanIntent | null>(null);

  useEffect(() => {
    setIntent(readPlanIntent());
  }, []);

  const current = normalizePlan(business.plan);
  if (!intent || current !== "freemium") return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-paprika/30 bg-paprika/5 px-5 py-4">
      <p className="text-sm">
        <span className="font-semibold">{PLAN_LABELS[intent.plan]} planını başlatmak istiyordun.</span>{" "}
        <span className="text-ink-soft">Menünü kurarken istediğin an geçişi başlatabilirsin.</span>
      </p>
      <Link
        href="/panel/plan"
        className={buttonClass("primary")}
      >
        Planı başlat
      </Link>
    </div>
  );
}

function Overview({ business }: { business: Business }) {
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
          { label: "Kategori", value: counts?.categories ?? "—", href: "/panel/categories" },
          { label: "Ürün", value: counts?.products ?? "—", href: "/panel/products" },
          { label: "Plan", value: PLAN_LABELS[normalizePlan(business.plan)], hint: planHint(business), href: "/panel/plan" },
        ]}
      />
      <QrShare business={business} />
      {analyticsAllowed ? (
        <StatsSection business={business} />
      ) : (
        <div className="mt-10">
          <FeatureLocked
            feature="basic_analytics"
            subject="Ziyaretçi istatistikleri"
            description="Sayfa görüntülenme, en çok bakılan ürün ve kategori gibi istatistikler."
          />
        </div>
      )}

      <FooterNote>
        <UpdatedAt at={business.updated} label="İşletme bilgileri güncellendi" />
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
