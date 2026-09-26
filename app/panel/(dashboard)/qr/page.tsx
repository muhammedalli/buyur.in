"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { Button, Card, ErrorText, FooterNote, Input, Label, PageHeader, SectionHeader, Select } from "@/components/panel/ui";
import { QrShare } from "@/components/panel/qr-share";
import { QrPrintSheet, type PrintableQr } from "@/components/panel/qr-print-sheet";
import { markActivation } from "@/lib/activation";
import { menuUrl } from "@/lib/site";
import { slugify } from "@/lib/slug";
import { withRetry } from "@/lib/pb-retry";
import { FileTextIcon, QrCodeIcon, TrashIcon } from "@/components/icons";
import type { Business, QrCode, QrPlacement } from "@/lib/types";

// Etiketli QR kodları: masa, vitrin, Instagram… Her QR menü linkine `?qr=<code>`
// ekler; /api/track bu kodu tarama kaydına bağlar, böylece hangi QR'ın ne kadar
// tarandığı ve menüyü sepete dönüştürdüğü Trafik sayfasında karşılaştırılabilir.

const PLACEMENTS: { value: QrPlacement; label: string }[] = [
  { value: "table", label: "Masa" },
  { value: "counter", label: "Kasa / tezgâh" },
  { value: "window", label: "Vitrin" },
  { value: "instagram", label: "Instagram" },
  { value: "campaign", label: "Kampanya" },
  { value: "other", label: "Diğer" },
];

const PLACEMENT_LABELS = Object.fromEntries(PLACEMENTS.map((item) => [item.value, item.label])) as Record<
  QrPlacement,
  string
>;

/** Tek seferde oluşturulabilecek en fazla masa QR'ı. */
const MAX_BULK = 100;
/** PocketBase'i boğmadan toplu oluşturma. */
function qrUrlFor(slug: string, code: string): string {
  return `${menuUrl(slug)}?qr=${encodeURIComponent(code)}`;
}

/** Kod URL'de taşınıyor: okunur bir slug + kısa ek ile çakışmayı önlüyoruz. */
function makeCode(name: string, placement: QrPlacement): string {
  const base = slugify(name) || placement;
  const suffix = Math.random().toString(36).slice(2, 5);
  return `${base}-${suffix}`.slice(0, 40);
}

function QrCard({
  code,
  business,
  onDelete,
  onDownloaded,
}: {
  code: QrCode;
  business: Business;
  onDelete: (code: QrCode) => void;
  onDownloaded: () => void;
}) {
  const { toast } = useToast();
  const [dataUrl, setDataUrl] = useState("");
  const url = qrUrlFor(business.slug, code.code);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#231812", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [url]);

  return (
    <Card className="flex gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-line bg-crema/40 p-2">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`${code.name} QR kodu`} className="h-full w-full" />
        ) : (
          <div className="h-full w-full animate-pulse rounded-md bg-crema" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold">{code.name}</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {PLACEMENT_LABELS[code.placement] ?? code.placement}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(code)}
            aria-label={`${code.name} QR kodunu sil`}
            className="shrink-0 text-ink-soft transition-colors hover:text-paprika"
          >
            <TrashIcon size={16} />
          </button>
        </div>

        <p className="mt-2 truncate font-mono text-[11px] text-ink-soft">{url}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={dataUrl || undefined}
            download={`buyur-qr-${code.code}.png`}
            onClick={onDownloaded}
            className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors hover:border-paprika hover:text-paprika"
          >
            PNG indir
          </a>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast("QR linki kopyalandı");
            }}
            className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors hover:border-paprika hover:text-paprika"
          >
            Linki kopyala
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Masa numaralı QR'ları toplu oluşturma formu. */
function BulkTableForm({ onCreate }: { onCreate: (prefix: string, from: number, count: number) => Promise<void> }) {
  const [prefix, setPrefix] = useState("Masa");
  const [from, setFrom] = useState("1");
  const [count, setCount] = useState("10");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const start = Number.parseInt(from, 10);
    const total = Number.parseInt(count, 10);
    if (!prefix.trim()) {
      setError("Bir ön ek yaz (ör. Masa, Bahçe, Teras).");
      return;
    }
    if (!Number.isInteger(start) || start < 0 || !Number.isInteger(total) || total < 1 || total > MAX_BULK) {
      setError(`Başlangıç numarası 0 ya da üstü, adet 1–${MAX_BULK} arasında olmalı.`);
      return;
    }
    setSaving(true);
    try {
      await onCreate(prefix.trim(), start, total);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6">
      <form onSubmit={handleSubmit}>
        <SectionHeader
          title="Masa QR'larını toplu oluştur"
          description="Her masaya ayrı QR: hangi masanın menüyü açıp sepete dönüştürdüğünü Trafik sayfasında ayrı ayrı görürsün."
          action={
            <Button type="submit" loading={saving}>
              Oluştur
            </Button>
          }
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="bulk-prefix">Ön ek</Label>
            <Input id="bulk-prefix" value={prefix} maxLength={40} onChange={(e) => setPrefix(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bulk-from">Başlangıç no</Label>
            <Input id="bulk-from" type="number" min={0} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bulk-count">Adet</Label>
            <Input id="bulk-count" type="number" min={1} max={MAX_BULK} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        </div>
      </form>
      <ErrorText>{error}</ErrorText>
      <FooterNote className="font-mono text-[11px]">
        Örnek: {prefix || "Masa"} {from || 1} … {prefix || "Masa"} {(Number.parseInt(from, 10) || 0) + (Number.parseInt(count, 10) || 1) - 1} ·
        aynı adla var olan QR&apos;lar atlanır
      </FooterNote>
    </Card>
  );
}

export default function QrCodesPage() {
  const { business, setBusiness } = useBusiness();
  const { toast } = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [codes, setCodes] = useState<QrCode[] | null>(null);
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState<QrPlacement>("table");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [printScope, setPrintScope] = useState<"table" | "all">("table");
  const [printing, setPrinting] = useState<PrintableQr[] | null>(null);

  const load = useCallback(async () => {
    if (!business) return;
    try {
      const records = await pb.collection("buyur_qr_codes").getFullList<QrCode>({
        filter: pb.filter("business = {:id}", { id: business.id }),
        sort: "created",
        requestKey: null,
      });
      setCodes(records);
    } catch {
      setCodes([]);
    }
  }, [business]);

  useEffect(() => {
    load();
  }, [load]);

  const markDownloaded = useCallback(async () => {
    if (!business) return;
    const updated = await markActivation(business, "qr_downloaded_at");
    if (updated) setBusiness(updated);
  }, [business, setBusiness]);

  const donePrinting = useCallback(() => setPrinting(null), []);

  const tableCodes = useMemo(() => (codes ?? []).filter((code) => code.placement === "table"), [codes]);
  const printable = printScope === "table" && tableCodes.length > 0 ? tableCodes : (codes ?? []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!business) return;
    setError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("QR koduna bir ad verin (ör. Masa 1).");
      return;
    }

    setSaving(true);
    try {
      await pb.collection("buyur_qr_codes").create({
        business: business.id,
        name: trimmed,
        code: makeCode(trimmed, placement),
        placement,
        is_active: true,
      });
      setName("");
      toast("QR kodu oluşturuldu");
      await load();
    } catch {
      setError("QR kodu oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkCreate(prefix: string, from: number, count: number) {
    if (!business) return;
    const existing = new Set((codes ?? []).map((code) => code.name.toLocaleLowerCase("tr")));
    const names = Array.from({ length: count }, (_, index) => `${prefix} ${from + index}`).filter(
      (candidate) => !existing.has(candidate.toLocaleLowerCase("tr"))
    );

    if (names.length === 0) {
      toast("Bu adlarla QR'lar zaten var");
      return;
    }

    // Tek tek ve sırayla: 5'erli paralel gönderim sunucudan 503 aldırıp
    // sessizce düşüyordu ("10 iste, 2 gelsin"). Kod bir kez üretilir; tekrar
    // denemeden önce kaydın oluşup oluşmadığına bakılır, böylece 503 sonrası
    // yazılmış bir QR ikinci kez açılmaz.
    let created = 0;
    for (const qrName of names) {
      const code = makeCode(qrName, "table");
      try {
        await withRetry(
          () =>
            pb.collection("buyur_qr_codes").create({
              business: business.id,
              name: qrName,
              code,
              placement: "table",
              is_active: true,
            }),
          {
            verify: () =>
              pb.collection("buyur_qr_codes").getFirstListItem(
                pb.filter("business = {:id} && code = {:code}", { id: business.id, code }),
                { requestKey: null }
              ),
          }
        );
        created += 1;
      } catch {
        /* sayılır, aşağıda kullanıcıya bildirilir; kalanlar denenmeye devam eder */
      }
    }

    await load();
    setPrintScope("table");
    const failed = names.length - created;
    toast(failed > 0 ? `${created} QR oluşturuldu, ${failed} tanesi oluşturulamadı` : `${created} masa QR'ı oluşturuldu`, failed > 0 ? "error" : undefined);
  }

  function handlePrint() {
    if (!business || printable.length === 0) return;
    setPrinting(printable.map((code) => ({ id: code.id, name: code.name, url: qrUrlFor(business.slug, code.code) })));
    void markDownloaded();
  }

  async function handleDelete(code: QrCode) {
    const ok = await confirm({
      title: `“${code.name}” QR kodu silinsin mi?`,
      tone: "danger",
      confirmLabel: "QR'ı sil",
      details: [
        "Basılı QR'lar menüyü açmaya devam eder, ama taramalar artık bu QR adına sayılmaz.",
        "Bu QR'ın geçmiş tarama verileri raporlarda kalır.",
      ],
    });
    if (!ok) return;
    try {
      await pb.collection("buyur_qr_codes").delete(code.id);
      toast("QR kodu silindi");
      await load();
    } catch {
      toast("QR kodu silinemedi", "error");
    }
  }

  if (!business) return null;

  return (
    <div>
      <PageHeader
        title="QR kodlar"
        description="Masa, vitrin ve sosyal medya için ayrı QR'lar oluşturun; hangisinin menüyü açıp sepete dönüştürdüğünü Trafik sayfasında görün"
      />

      <QrShare business={business} />

      <BulkTableForm onCreate={handleBulkCreate} />

      <Card className="mt-6">
        <form onSubmit={handleCreate}>
          <SectionHeader
            title="Tek QR oluştur"
            description="Vitrin, sosyal medya ya da paket servis için tek tek QR ekleyin."
            action={
              <Button type="submit" loading={saving}>
                <QrCodeIcon size={15} /> QR oluştur
              </Button>
            }
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="qr-name">QR adı</Label>
              <Input
                id="qr-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Vitrin, Instagram bio, Paket poşeti…"
                maxLength={60}
              />
            </div>
            <div className="sm:w-48">
              <Label htmlFor="qr-placement">Nerede kullanılacak</Label>
              <Select
                id="qr-placement"
                value={placement}
                onChange={(event) => setPlacement(event.target.value as QrPlacement)}
              >
                {PLACEMENTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      {codes === null ? (
        <p className="mt-6 text-sm text-ink-soft">QR kodları yükleniyor…</p>
      ) : codes.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
          Henüz etiketli QR kodunuz yok. Masa QR&apos;larını toplu oluşturun ya da vitrin, Instagram gibi yerler için tek
          tek ekleyin — hangisinin işe yaradığını ölçebilirsiniz.
        </p>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="font-display text-lg font-bold">
              QR kodları <span className="font-mono text-xs font-normal text-ink-soft">({codes.length})</span>
            </p>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {tableCodes.length > 0 && tableCodes.length < codes.length && (
                <Select
                  aria-label="Yazdırılacak QR'lar"
                  value={printScope}
                  onChange={(event) => setPrintScope(event.target.value as "table" | "all")}
                  className="w-auto py-2"
                >
                  <option value="table">Yalnızca masalar ({tableCodes.length})</option>
                  <option value="all">Tüm QR&apos;lar ({codes.length})</option>
                </Select>
              )}
              <Button type="button" variant="outline" onClick={handlePrint} disabled={printing !== null}>
                <FileTextIcon size={15} /> Toplu PDF indir ({printable.length})
              </Button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {codes.map((code) => (
              <QrCard key={code.id} code={code} business={business} onDelete={handleDelete} onDownloaded={markDownloaded} />
            ))}
          </div>
          <FooterNote>
            Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin · A4 sayfaya 6 kart düşer, kesim çizgileri kesiklidir
          </FooterNote>
        </>
      )}

      {printing && <QrPrintSheet businessName={business.name} items={printing} onDone={donePrinting} />}
      {confirmDialog}
    </div>
  );
}
