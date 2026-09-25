"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label, Modal, Select, Textarea } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import {
  BUSINESS_ACTIONS,
  NOTE_MAX,
  REASON_MAX,
  REASON_MIN,
  TRIAL_EXTEND_MAX_DAYS,
  type BusinessActionKind,
} from "@/lib/admin-business-actions";
import { SUSPENSION_REASON_MAX } from "@/lib/business-suspension";
import { PLAN_LABELS, PLAN_ORDER } from "@/lib/entitlements";
import type { Plan } from "@/lib/types";

export interface BusinessActionsProps {
  businessId: string;
  /** Rolün yapabildiği işlemler (sunucuda canPerform ile hesaplanır). */
  allowed: BusinessActionKind[];
  current: {
    plan: Plan;
    /** YYYY-MM-DD ya da boş. */
    expiresOn: string;
    suspended: boolean;
    slug: string;
    email: string;
  };
}

type ModalKind = Exclude<BusinessActionKind, "note">;

async function postAction(businessId: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`/api/admin/businesses/${businessId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: typeof data?.error === "string" ? data.error : "İşlem yapılamadı, tekrar dene." };
    return { ok: true as const, message: typeof data?.message === "string" ? data.message : undefined };
  } catch {
    return { ok: false as const, error: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." };
  }
}

/** Geri alınması zor ya da müşteriyi doğrudan etkileyen işlemlerin uyarısı. */
const WARNINGS: Partial<Record<ModalKind, string>> = {
  suspend: "Menü ve web sitesi hemen yayından kalkar; müşteriler \"menü şu anda görüntülenemiyor\" görür. Veri silinmez.",
  slug_change:
    "Basılı QR kodları ve paylaşılmış bağlantılar ESKİ adrese gider ve çalışmaz. İşletme yeni QR'larını basmalı.",
  plan_assign: "Plan hemen geçerli olur; özellik kilitleri ve limitler yeni plana göre çalışır.",
};

export function BusinessActions({ businessId, allowed, current }: BusinessActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState<ModalKind | null>(null);
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<Plan>(current.plan);
  const [expiresOn, setExpiresOn] = useState(current.expiresOn);
  const [days, setDays] = useState("30");
  const [slug, setSlug] = useState(current.slug);
  const [ownerMessage, setOwnerMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const can = (kind: BusinessActionKind) => allowed.includes(kind);

  function openModal(kind: ModalKind) {
    setError("");
    setReason("");
    setPlan(current.plan);
    setExpiresOn(current.expiresOn);
    setDays("30");
    setSlug(current.slug);
    setOwnerMessage("");
    setOpen(kind);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!open) return;
    setError("");
    setLoading(true);
    const payload: Record<string, unknown> = { action: open, reason };
    if (open === "plan_assign") Object.assign(payload, { plan, expiresOn });
    if (open === "trial_extend") payload.days = Number(days);
    if (open === "slug_change") payload.slug = slug;
    if (open === "suspend") payload.ownerMessage = ownerMessage;
    const result = await postAction(businessId, payload);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(result.message ?? `${BUSINESS_ACTIONS[open].label}: tamamlandı.`);
    setOpen(null);
    router.refresh();
  }

  const buttons: { kind: ModalKind; show: boolean; variant?: "outline" | "danger" }[] = [
    { kind: "plan_assign", show: can("plan_assign") },
    { kind: "trial_extend", show: can("trial_extend") && Boolean(current.expiresOn) },
    { kind: "ai_quota_reset", show: can("ai_quota_reset") },
    { kind: "password_reset", show: can("password_reset") && Boolean(current.email) },
    { kind: "slug_change", show: can("slug_change") && Boolean(current.slug) },
    { kind: current.suspended ? "unsuspend" : "suspend", show: can("suspend"), variant: current.suspended ? "outline" : "danger" },
  ];
  const visible = buttons.filter((b) => b.show);

  let fields: ReactNode = null;
  if (open === "plan_assign") {
    fields = (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="action-plan">Plan</Label>
          <Select id="action-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            {PLAN_ORDER.map((key) => (
              <option key={key} value={key}>
                {PLAN_LABELS[key]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="action-expires">Bitiş tarihi</Label>
          <Input id="action-expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          <p className="mt-1 text-xs text-ink-soft">Boş = süresiz. Süreli planda zorunlu.</p>
        </div>
      </div>
    );
  } else if (open === "trial_extend") {
    fields = (
      <div>
        <Label htmlFor="action-days">Kaç gün uzatılsın</Label>
        <Input id="action-days" type="number" min={1} max={TRIAL_EXTEND_MAX_DAYS} value={days} onChange={(e) => setDays(e.target.value)} />
        <p className="mt-1 text-xs text-ink-soft">Süre dolmuşsa bugünden, dolmamışsa mevcut bitişten itibaren eklenir.</p>
      </div>
    );
  } else if (open === "slug_change") {
    fields = (
      <div>
        <Label htmlFor="action-slug">Yeni menü adresi</Label>
        <Input id="action-slug" value={slug} onChange={(e) => setSlug(e.target.value)} autoComplete="off" />
      </div>
    );
  } else if (open === "suspend") {
    fields = (
      <div>
        <Label htmlFor="action-owner-message">Sahibine gösterilecek mesaj (isteğe bağlı)</Label>
        <Textarea
          id="action-owner-message"
          rows={2}
          maxLength={SUSPENSION_REASON_MAX}
          value={ownerMessage}
          onChange={(e) => setOwnerMessage(e.target.value)}
          placeholder="Ör. Ödemeniz alındığında menünüz yeniden açılacak."
        />
        <p className="mt-1 text-xs text-ink-soft">İşletme sahibi bunu panelinde görür; müşteriler görmez.</p>
      </div>
    );
  } else if (open === "password_reset") {
    fields = <p className="text-sm text-ink-soft">Tek kullanımlık bağlantı {current.email} adresine gider. Şifreyi sen görmezsin.</p>;
  } else if (open === "ai_quota_reset") {
    fields = <p className="text-sm text-ink-soft">Bu ayki AI tarama sayacı sıfırlanır.</p>;
  }

  return (
    <>
      {visible.length === 0 ? (
        <p className="text-sm text-ink-soft">Bu işletme için rolünün yapabileceği bir işlem yok.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map(({ kind, variant }) => (
            <Button key={kind} type="button" variant={variant ?? "outline"} onClick={() => openModal(kind)} className="px-3.5 py-2 text-[12px]">
              {BUSINESS_ACTIONS[kind].label}
            </Button>
          ))}
        </div>
      )}

      <Modal
        open={open !== null}
        title={open ? BUSINESS_ACTIONS[open].label : ""}
        onClose={() => !loading && setOpen(null)}
        dismissable={!loading}
      >
        {open && (
          <form onSubmit={submit} className="space-y-4">
            {WARNINGS[open] && (
              <p className="rounded-xl border border-paprika/30 bg-paprika/10 px-3.5 py-2.5 text-sm text-paprika">{WARNINGS[open]}</p>
            )}
            {fields}
            <div>
              <Label htmlFor="action-reason">Gerekçe (denetim kaydına yazılır)</Label>
              <Textarea
                id="action-reason"
                rows={3}
                required
                minLength={REASON_MIN}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ör. Havale alındı, 1 yıllık Premium."
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(null)} disabled={loading}>
                Vazgeç
              </Button>
              <Button type="submit" variant={open === "suspend" ? "danger" : "primary"} loading={loading}>
                Onayla
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** İç not ekleme formu. Not müşteriye görünmez ve silinemez. */
export function BusinessNoteForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await postAction(businessId, { action: "note", body });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    toast("Not eklendi.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor="admin-note" className="sr-only">
        Yeni not
      </Label>
      <Textarea
        id="admin-note"
        rows={3}
        maxLength={NOTE_MAX}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ör. Telefonda görüştük, çarşamba geri dönülecek."
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <Button type="submit" loading={loading} disabled={!body.trim()} className="px-3.5 py-2 text-[12px]">
          Not ekle
        </Button>
      </div>
    </form>
  );
}
