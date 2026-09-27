"use client";

import Link from "next/link";
import { PageHeader } from "@/components/panel/ui";
import { AnalyticsFilterBar } from "@/components/panel/analytics/filters";
import { useAnalyticsQuery } from "@/components/panel/analytics/use-analytics";
import {
  AnalyticsErrorState,
  AnalyticsSkeleton,
  NoDataYet,
  Refreshable,
} from "@/components/panel/analytics/states";
import { ChartFrame } from "@/components/panel/charts/frame";
import { BarList } from "@/components/panel/charts/bar-chart";
import { DonutChart } from "@/components/panel/charts/donut-chart";
import { LineChart } from "@/components/panel/charts/line-chart";
import { StatTile } from "@/components/panel/charts/stat-tile";
import { CATEGORICAL } from "@/components/panel/charts/palette";
import { formatCompact, formatDuration, formatNumber, formatPercent } from "@/components/panel/charts/chart-utils";
import { QrCodeIcon } from "@/components/icons";
import { FeatureLocked } from "@/components/panel/plan-gate";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

interface SourceRow {
  key: string;
  label: string;
  sessions: number;
  visitors: number;
  page_views: number;
  product_views: number;
  cart_adds: number;
  share: number;
  conversion: number;
  avg_duration: number;
}

interface QrRow {
  key: string;
  label: string;
  scans: number;
  sessions: number;
  /** QR hunisi — adım başına tekil oturum. */
  menu_opens: number;
  product_viewers: number;
  cart_adders: number;
  conversion: number;
}

interface DeviceRow {
  key: string;
  label: string;
  sessions: number;
  page_views: number;
  product_views: number;
  cart_adds: number;
  share: number;
  avg_duration: number;
}

interface CampaignRow {
  key: string;
  label: string;
  views: number;
  clicks: number;
  click_rate: number;
}

const SOURCE_LABELS: Record<string, string> = {
  qr: msg("QR kod"),
  instagram: "Instagram",
  google: "Google",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  youtube: "YouTube",
  campaign: msg("Kampanya linki"),
  direct: msg("Doğrudan"),
  other: msg("Diğer"),
};

const DEVICE_LABELS: Record<string, string> = { mobile: msg("Mobil"), tablet: msg("Tablet"), desktop: msg("Masaüstü") };

export default function AcquisitionPage() {
  const { t } = useUiLocale();
  const sources = useAnalyticsQuery<{ items: SourceRow[]; totalSessions: number }>("sources");
  const qr = useAnalyticsQuery<{
    totals: { scans: number };
    series: { date: string; value: number }[];
    items: QrRow[];
  }>("qr");
  const devices = useAnalyticsQuery<{
    devices: DeviceRow[];
    countries: { key: string; label: string; sessions: number; share: number }[];
    cities: { key: string; label: string; sessions: number; share: number }[];
  }>("devices");
  const campaigns = useAnalyticsQuery<{ items: CampaignRow[] }>("campaigns");

  const loading = sources.loading && !sources.data;
  const planLocked = sources.error?.isPlanLocked;

  return (
    <div>
      <PageHeader title={t("Trafik")} description={t("Ziyaretçiler menüye nereden geliyor")} />
      <AnalyticsFilterBar />

      {loading && <AnalyticsSkeleton />}
      {planLocked && (
        <FeatureLocked
          feature="advanced_analytics"
          subject={t("Trafik analizi")}
          description={t("Trafik kaynağı kırılımı, QR performansı, cihaz ve konum analizi.")}
        />
      )}
      {sources.error && !planLocked && !sources.data && (
        <AnalyticsErrorState error={sources.error} onRetry={sources.reload} />
      )}

      {sources.data && (
        <Refreshable refreshing={sources.refreshing}>
          {sources.data.totalSessions === 0 ? (
            <NoDataYet description={t("Bu dönemde menünüz ziyaret edilmemiş. QR kodlarınızı masalara koyduktan sonra trafik kaynakları burada görünecek.")} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label={t("Toplam oturum")} value={formatCompact(sources.data.totalSessions)} />
                <StatTile
                  label={t("QR tarama")}
                  value={formatCompact(qr.data?.totals.scans ?? 0)}
                  hint={t("Menüye QR kod üzerinden başlayan ziyaretler.")}
                />
                <StatTile
                  label={t("En güçlü kaynak")}
                  value={t(SOURCE_LABELS[sources.data.items[0]?.key ?? ""] ?? sources.data.items[0]?.label ?? "—")}
                  hint={t("Oturum sayısına göre ilk sıradaki trafik kaynağı.")}
                />
                <StatTile
                  label={t("Mobil payı")}
                  value={formatPercent(devices.data?.devices.find((item) => item.key === "mobile")?.share ?? 0, 0)}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFrame title={t("Kaynak dağılımı")} hint={t("Oturumların kaynağa göre payı")}>
                  <DonutChart
                    centerLabel={t("oturum")}
                    items={sources.data.items.map((item) => ({
                      key: item.key,
                      label: t(SOURCE_LABELS[item.key] ?? item.label),
                      value: item.sessions,
                    }))}
                  />
                </ChartFrame>

                <ChartFrame title={t("Cihazlar")} hint={t("Menü hangi cihazlardan açılıyor")}>
                  <BarList
                    color={CATEGORICAL[3]}
                    items={(devices.data?.devices ?? []).map((item) => ({
                      key: item.key,
                      label: t(DEVICE_LABELS[item.key] ?? item.label),
                      value: item.sessions,
                      note: formatPercent(item.share, 0),
                    }))}
                    emptyLabel={t("Cihaz kırılımı için henüz ziyaret yok.")}
                  />
                </ChartFrame>
              </div>

              {/* Veri yoğun tablo tam genişlikte: dar kartta son sütun kırpılıyordu. */}
              {/* Kaynak kırılımında "tekil ziyaretçi" günlük tekillerin toplamıdır ve
                  günlük hacimde oturum sayısına çok yakın çıkar; yanıltmamak için
                  sütun olarak göstermiyoruz (aralık geneli tekil sayım yalnızca
                  toplam metrikte gerçek dedupe ile hesaplanıyor). */}
              <ChartFrame title={t("Kaynak performansı")} hint={t("Hangi kaynak sepete daha çok dönüyor")}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                        <th className="py-2">{t("Kaynak")}</th>
                        <th className="py-2 text-right">{t("Oturum")}</th>
                        <th className="py-2 text-right">{t("Ürün görüntülenme")}</th>
                        <th className="py-2 text-right">{t("Sepet")}</th>
                        <th className="py-2 text-right">{t("Dönüşüm")}</th>
                        <th className="py-2 text-right">{t("Ort. süre")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.data.items.map((item) => (
                        <tr key={item.key} className="border-b border-line/50 last:border-0">
                          <td className="py-2">{t(SOURCE_LABELS[item.key] ?? item.label)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(item.sessions)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(item.product_views)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(item.cart_adds)}</td>
                          <td className="py-2 text-right tabular-nums">{formatPercent(item.conversion, 0)}</td>
                          <td className="py-2 text-right tabular-nums">{formatDuration(item.avg_duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartFrame>

              <ChartFrame
                title={t("QR performansı")}
                hint={t("Etiketli QR kodlarınızın karşılaştırması")}
                actions={
                  <Link
                    href="/panel/qr"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-paprika"
                  >
                    <QrCodeIcon size={14} />{" "}{t("QR kodları yönet")}
                  </Link>
                }
              >
                {(qr.data?.items.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto">
                    {/* QR bazında huni: tarama → menü açılışı → ürün görüntüleme → sepete ekleme
                        (adım başına tekil oturum). Dönüşüm = sepete ekleyen oturum / QR oturumu. */}
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                          <th className="py-2">{t("QR")}</th>
                          <th className="py-2 text-right">{t("Tarama")}</th>
                          <th className="py-2 text-right">{t("Menü açılışı")}</th>
                          <th className="py-2 text-right">{t("Ürün görüntüleme")}</th>
                          <th className="py-2 text-right">{t("Sepete ekleme")}</th>
                          <th className="py-2 text-right">{t("Dönüşüm")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(qr.data?.items ?? []).map((item) => {
                          const base = Math.max(item.sessions, item.menu_opens, 1);
                          return (
                            <tr key={item.key} className="border-b border-line/50 last:border-0">
                              <td className="py-2.5">
                                <span className="block font-medium">{item.label}</span>
                                <span className="mt-1 flex h-1.5 w-32 overflow-hidden rounded-full bg-crema" aria-hidden>
                                  <span
                                    className="h-full"
                                    style={{ width: `${(item.cart_adders / base) * 100}%`, background: CATEGORICAL[2] }}
                                  />
                                </span>
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{formatNumber(item.scans)}</td>
                              <td className="py-2.5 text-right tabular-nums">{formatNumber(item.menu_opens)}</td>
                              <td className="py-2.5 text-right tabular-nums">{formatNumber(item.product_viewers)}</td>
                              <td className="py-2.5 text-right tabular-nums">{formatNumber(item.cart_adders)}</td>
                              <td className="py-2.5 text-right tabular-nums">{formatPercent(item.conversion, 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <LineChart
                      series={[
                        {
                          key: "scans",
                          label: t("QR tarama"),
                          points: qr.data?.series ?? [],
                        },
                      ]}
                      height={180}
                      emptyLabel={t("QR taraması kaydedilmemiş.")}
                    />
                    <p className="text-xs text-ink-soft">
                      {t("Masa, vitrin ve Instagram için ayrı QR kodları oluşturursanız hangisinin daha çok tarandığını buradan karşılaştırabilirsiniz.")}
                    </p>
                  </div>
                )}
              </ChartFrame>

              <ChartFrame title={t("Konum")} hint={t("Yalnızca ülke/şehir seviyesinde, kişisel konum tutulmaz")}>
                {(devices.data?.cities.length ?? 0) > 0 ? (
                  <BarList
                    color={CATEGORICAL[4]}
                    items={(devices.data?.cities ?? []).slice(0, 8).map((item) => ({
                      key: item.key,
                      label: item.label,
                      value: item.sessions,
                      note: formatPercent(item.share, 0),
                    }))}
                  />
                ) : (
                  <p className="rounded-md border border-dashed border-line px-4 py-10 text-center text-sm text-ink-soft">
                    {t("Konum verisi sunucu sağlayıcısından gelmiyor. Yayına alındığında ülke/şehir kırılımı burada görünecek.")}
                  </p>
                )}
              </ChartFrame>

              {(campaigns.data?.items.length ?? 0) > 0 && (
                <ChartFrame title={t("Kampanya performansı")} hint={t("Menü açılışında gösterilen kampanyalar")}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                          <th className="py-2">{t("Kampanya")}</th>
                          <th className="py-2 text-right">{t("Gösterim")}</th>
                          <th className="py-2 text-right">{t("Tıklama")}</th>
                          <th className="py-2 text-right">{t("Tıklama oranı")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(campaigns.data?.items ?? []).map((item) => (
                          <tr key={item.key} className="border-b border-line/50 last:border-0">
                            <td className="py-2">{item.label}</td>
                            <td className="py-2 text-right tabular-nums">{formatNumber(item.views)}</td>
                            <td className="py-2 text-right tabular-nums">{formatNumber(item.clicks)}</td>
                            <td className="py-2 text-right tabular-nums">{formatPercent(item.click_rate, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartFrame>
              )}
            </div>
          )}
        </Refreshable>
      )}
    </div>
  );
}
