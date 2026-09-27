"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AiActionButton, Button, Modal, Switch } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { MenuAssistant, importDraftToBusiness, statsLine, useMenuSession, type ImportSummary } from "@/components/admin/menu-builder";
import { draftStats } from "@/lib/ai/menu-assistant";

// Var olan bir işletmenin menüsüne asistanla toplu aktarım (yönetim paneli,
// menü sayfası). Yeni işletme sihirbazıyla aynı sayfa içi asistan ve aynı
// aktarım ucu: menüde zaten bulunan ürünler atlanır, yalnızca eksikler
// yazılır. Yazmadan önce onay penceresi açılır.

export function AdminMenuImport({ businessId, businessName, userName }: { businessId: string; businessName: string; userName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const session = useMenuSession();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const stats = draftStats(session.draft);

  async function write() {
    if (busy || stats.products === 0 || stats.missingPrices > 0) return;
    setBusy(true);
    setSummary(null);
    const result = await importDraftToBusiness(businessId, session.draft, publish, (done, total) => setProgress({ done, total }));
    setProgress(null);
    setBusy(false);
    setSummary(result);
    if (result.failed === 0 && result.errors.length === 0) {
      toast(`${result.created} ürün menüye yazıldı${result.skipped ? `, ${result.skipped} ürün zaten vardı` : ""}.`);
      session.reset();
      setSummary(null);
      setConfirmOpen(false);
      setOpen(false);
    } else {
      toast(`${result.created} ürün yazıldı, ${result.failed} ürün yazılamadı.`, "error");
    }
    router.refresh();
  }

  if (!open) {
    return (
      <div className="mb-6 flex justify-end">
        <AiActionButton type="button" onClick={() => setOpen(true)}>
          {stats.products > 0 ? `Asistana dön (${stats.products} ürün)` : "Asistanla menü aktar"}
        </AiActionButton>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <MenuAssistant
        session={session}
        businessName={businessName}
        userName={userName}
        disabled={busy}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Gizle
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={stats.products === 0}>
              Menüye yaz
            </Button>
          </>
        }
      />
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        dismissable={!busy}
        title="Menüye yaz"
        description={`${businessName || "İşletme"} menüsüne eklenecek. Menüde aynı adla bulunan ürünler atlanır; tekrar yazmak çift kayıt üretmez.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={() => void write()} loading={busy} disabled={stats.missingPrices > 0}>
              {stats.products} ürünü yaz
            </Button>
          </>
        }
      >
        <p className="text-sm">{statsLine(stats)}</p>
        <div className="mt-4 rounded-md border border-line bg-crema/40 p-3">
          <Switch checked={publish} onChange={setPublish} label="Aktarılanları yayında aç" description="Kapalıysa kategori ve ürünler taslak eklenir." />
        </div>
        {stats.missingPrices > 0 && (
          <p className="mt-4 rounded-md border border-paprika/40 bg-paprika/5 px-3 py-2 text-sm text-paprika-deep">
            {stats.missingPrices} ürünün fiyatı eksik. Önizlemede fiyatlarını yazın ya da asistana söyleyin.
          </p>
        )}
        {progress && (
          <p className="mt-4 text-sm text-ink-soft" role="status">
            Yazılıyor: {progress.done}/{progress.total} kategori…
          </p>
        )}
        {summary && summary.errors.length > 0 && (
          <ul className="mt-4 space-y-0.5 text-xs text-paprika-deep">
            {summary.errors.map((error) => (
              <li key={error} className="break-words">
                {error}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
