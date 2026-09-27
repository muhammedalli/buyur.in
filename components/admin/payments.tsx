"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreIcon } from "@/components/icons";
import { Button, Dropdown, ErrorText, Input, Label, Modal, Select, Table, Textarea } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { REASON_MAX, REASON_MIN } from "@/lib/admin-business-actions";
import { cn } from "@/lib/utils";
import {
  NOTE_MAX,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  amountInputValue,
  formatAmount,
  formatDay,
  parseAmount,
  todayIstanbul,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentType,
} from "@/lib/payments";

// Yönetim panelinin ödeme ekranları (genel liste ve işletme detayı) için
// istemci parçaları: kayıt formu (ekle/düzenle), silme onayı ve geçmiş
// tablosu. Yazmalar app/api/admin/payments uçlarından yapılır; ekran
// kaydedince router.refresh() ile sunucudan yeniden okunur, bakiye her
// seferinde kayıtlardan hesaplanır (lib/payments.ts).

export interface PaymentBusinessOption {
  id: string;
  name: string;
}

export interface PaymentRow {
  id: string;
  business: string;
  businessName: string;
  type: PaymentType;
  amount: number;
  day: string;
  method: PaymentMethod | "";
  status: PaymentStatus;
  note: string;
}

const TYPE_TONE: Record<PaymentType, string> = {
  charge: "text-ink",
  incoming: "text-herb",
  outgoing: "text-paprika-deep",
};

const STATUS_TONE: Record<PaymentStatus, string> = {
  completed: "border-herb/30 bg-herb/10 text-herb",
  pending: "border-paprika/30 bg-paprika/10 text-paprika-deep",
  cancelled: "border-line bg-crema text-ink-soft line-through",
};

const BADGE = "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={cn(BADGE, STATUS_TONE[status])}>{PAYMENT_STATUS_LABELS[status]}</span>;
}

/** İşaretli tutar: alınan +, verilen −, borç işaretsiz. */
export function SignedAmount({ type, amount, className = "" }: { type: PaymentType; amount: number; className?: string }) {
  const sign = type === "incoming" ? "+" : type === "outgoing" ? "−" : "";
  return (
    <span className={cn("whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums", TYPE_TONE[type], className)}>
      {sign}
      {formatAmount(amount)}
    </span>
  );
}

interface EditorState {
  business: string;
  type: PaymentType;
  amount: string;
  date: string;
  method: PaymentMethod | "";
  status: PaymentStatus;
  note: string;
}

function emptyState(business: string): EditorState {
  return { business, type: "incoming", amount: "", date: todayIstanbul(), method: "bank_transfer", status: "completed", note: "" };
}

function stateFromRow(row: PaymentRow): EditorState {
  return {
    business: row.business,
    type: row.type,
    amount: amountInputValue(row.amount),
    date: row.day,
    method: row.method,
    status: row.status,
    note: row.note,
  };
}

/** Ödeme ekleme/düzenleme penceresi. `fixedBusiness` verilirse işletme
 *  seçilemez (işletme detay sayfasından açılır). */
function PaymentEditor({
  open,
  editing,
  businesses,
  fixedBusiness,
  onClose,
}: {
  open: boolean;
  editing: PaymentRow | null;
  businesses: PaymentBusinessOption[];
  fixedBusiness?: PaymentBusinessOption;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<EditorState>(() => (editing ? stateFromRow(editing) : emptyState(fixedBusiness?.id ?? "")));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const amount = parseAmount(form.amount);
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.business) return setError("İşletme seçin.");
    if (amount === null) return setError("Geçerli bir tutar yazın (ör. 1.250,00).");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/payments/${editing.id}` : "/api/admin/payments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, method: form.type === "charge" ? "" : form.method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Kaydedilemedi, tekrar dene.");
        return;
      }
      toast(editing ? "Ödeme kaydı güncellendi." : "Ödeme kaydı eklendi.");
      onClose();
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? "Ödeme kaydını düzenle" : "Yeni ödeme kaydı"}
      description={fixedBusiness ? fixedBusiness.name : "Kayıt eklenince işletmenin kalan borcu kendiliğinden güncellenir."}
      onClose={() => !saving && onClose()}
      dismissable={!saving}
    >
      <form onSubmit={submit} className="space-y-4">
        {!fixedBusiness && (
          <div>
            <Label htmlFor="payment-business">İşletme</Label>
            <Select id="payment-business" required value={form.business} onChange={(e) => set("business", e.target.value)}>
              <option value="">İşletme seçin…</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="payment-type">İşlem tipi</Label>
            <Select id="payment-type" value={form.type} onChange={(e) => set("type", e.target.value as PaymentType)}>
              {PAYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PAYMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="payment-amount">Tutar (₺)</Label>
            <Input
              id="payment-amount"
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="1.250,00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="font-mono"
            />
            {form.amount.trim() !== "" && (
              <p className={cn("mt-1 text-xs", amount === null ? "text-paprika-deep" : "text-ink-soft")}>
                {amount === null ? "Tutar okunamadı." : formatAmount(amount)}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="payment-date">Tarih</Label>
            <Input id="payment-date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="payment-status">Durum</Label>
            <Select id="payment-status" value={form.status} onChange={(e) => set("status", e.target.value as PaymentStatus)}>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {form.type !== "charge" && (
          <div>
            <Label htmlFor="payment-method">Ödeme yöntemi</Label>
            <Select id="payment-method" value={form.method} onChange={(e) => set("method", e.target.value as PaymentMethod | "")}>
              <option value="">Belirtilmedi</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="payment-note">Açıklama / not</Label>
          <Textarea
            id="payment-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder={form.type === "charge" ? "Ör. Ekim 2026 Premium ücreti" : "Ör. Dekont no, açıklama"}
          />
        </div>
        <p className="text-xs text-ink-soft">
          Bakiyeye yalnızca “Tamamlandı” kayıtlar girer; “Bekliyor” kayıtlar ayrıca toplanır, “İptal” kayıtlar hiçbir toplama girmez.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Kaydet" : "Kaydı ekle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeletePayment({ row, onClose }: { row: PaymentRow | null; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!row) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/payments/${row.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Silinemedi, tekrar dene.");
        return;
      }
      toast("Ödeme kaydı silindi.");
      onClose();
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={row !== null}
      size="sm"
      title="Ödeme kaydını sil"
      description={row ? `${PAYMENT_TYPE_LABELS[row.type]} · ${formatAmount(row.amount)} · ${formatDay(row.day)}` : undefined}
      onClose={() => !loading && onClose()}
      dismissable={!loading}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Kayıt listeden kalkar ve işletmenin bakiyesi yeniden hesaplanır. Silinen kaydın tamamı gerekçesiyle denetim kaydında kalır.
        </p>
        <div>
          <Label htmlFor="payment-delete-reason">Gerekçe</Label>
          <Textarea
            id="payment-delete-reason"
            rows={2}
            required
            minLength={REASON_MIN}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ör. Yanlış işletmeye girilmişti"
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button type="submit" variant="danger" loading={loading} disabled={reason.trim().length < REASON_MIN}>
            Sil
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** "Yeni ödeme" butonu ve penceresi. */
export function NewPaymentButton({
  businesses,
  fixedBusiness,
  label = "Yeni ödeme",
}: {
  businesses: PaymentBusinessOption[];
  fixedBusiness?: PaymentBusinessOption;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + {label}
      </Button>
      {open && <PaymentEditor open editing={null} businesses={businesses} fixedBusiness={fixedBusiness} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Ödeme geçmişi tablosu: Tarih | İşlem | Tutar | Yöntem | Açıklama | Durum.
 *  Dar ekranda tutar "İşlem" hücresinin sağına, tarih ve durum altına iner;
 *  yöntem ve açıklama yer açıldıkça sütun olur — tablo 320px'te de kabına sığar. */
export function PaymentsTable({
  rows,
  businesses,
  showBusiness = false,
  canEdit = false,
  fixedBusiness,
}: {
  rows: PaymentRow[];
  businesses: PaymentBusinessOption[];
  showBusiness?: boolean;
  canEdit?: boolean;
  fixedBusiness?: PaymentBusinessOption;
}) {
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentRow | null>(null);

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th className="hidden sm:table-cell">Tarih</th>
            <th>İşlem</th>
            <th className="hidden text-right sm:table-cell">Tutar</th>
            <th className="hidden md:table-cell">Yöntem</th>
            <th className="hidden xl:table-cell">Açıklama</th>
            <th className="hidden sm:table-cell">Durum</th>
            {canEdit && (
              <th className="w-px">
                <span className="sr-only">İşlem menüsü</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.status === "cancelled" ? "opacity-60" : undefined}>
              <td className="hidden whitespace-nowrap font-mono text-[12px] text-ink-soft sm:table-cell">{formatDay(row.day)}</td>
              <td className="w-full max-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-semibold text-ink">{PAYMENT_TYPE_LABELS[row.type]}</p>
                  <SignedAmount type={row.type} amount={row.amount} className="sm:hidden" />
                </div>
                {showBusiness && (
                  <Link href={`/admin/businesses/${row.business}`} className="block truncate text-[13px] text-ink-soft hover:text-paprika">
                    {row.businessName}
                  </Link>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-soft sm:hidden">
                  <span className="font-mono">{formatDay(row.day)}</span>
                  <PaymentStatusBadge status={row.status} />
                </p>
                {row.note && <p className="mt-0.5 truncate text-[12px] text-ink-soft xl:hidden">{row.note}</p>}
              </td>
              <td className="hidden text-right sm:table-cell">
                <SignedAmount type={row.type} amount={row.amount} />
              </td>
              <td className="hidden whitespace-nowrap text-[13px] text-ink-soft md:table-cell">
                {row.method ? PAYMENT_METHOD_LABELS[row.method] : "—"}
              </td>
              <td className="hidden max-w-[18rem] xl:table-cell">
                <p className="line-clamp-2 break-words text-[13px] text-ink-soft" title={row.note || undefined}>
                  {row.note || "—"}
                </p>
              </td>
              <td className="hidden sm:table-cell">
                <PaymentStatusBadge status={row.status} />
              </td>
              {canEdit && (
                <td className="w-px whitespace-nowrap text-right">
                  <Dropdown
                    label="Kayıt işlemleri"
                    chevron={false}
                    triggerClassName="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-ink-soft transition-colors hover:border-paprika hover:text-paprika"
                    trigger={
                      <>
                        <MoreIcon size={16} />
                        <span className="sr-only">Kayıt işlemleri</span>
                      </>
                    }
                    items={[
                      { label: "Düzenle", onSelect: () => setEditing(row) },
                      "separator",
                      { label: "Sil", tone: "danger", onSelect: () => setDeleting(row) },
                    ]}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      {editing && (
        <PaymentEditor
          key={editing.id}
          open
          editing={editing}
          businesses={businesses}
          fixedBusiness={fixedBusiness}
          onClose={() => setEditing(null)}
        />
      )}
      <DeletePayment key={deleting?.id ?? "none"} row={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
