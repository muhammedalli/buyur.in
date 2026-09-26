"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label, Modal, Select, Table, Textarea } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { REASON_MAX, REASON_MIN } from "@/lib/admin-business-actions";
import { ADMIN_ROLE_LABELS, ADMIN_ROLES } from "@/lib/admin-roles";
import { ADMIN_ACCOUNT_ACTIONS, ADMIN_NAME_MAX, type AdminAccountActionKind } from "@/lib/admin-users";
import type { AdminRole } from "@/lib/types";

// Yönetici hesapları listesi ve işlemleri (yalnızca super_admin). Hesap
// silinmez, erişimi kapatılır; kişi kendi hesabına işlem yapamaz (sunucu ve
// PocketBase kuralı da reddeder). Yeni hesabın geçici şifresi yalnızca bir kez
// gösterilir.

export interface AdminAccountRow {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  disabled: boolean;
  created: string;
  lastLogin: string;
}

type Dialog =
  | { kind: "create" }
  | { kind: AdminAccountActionKind; target: AdminAccountRow }
  | { kind: "created"; email: string; password: string };

export function AdminAccounts({ rows, selfId }: { rows: AdminAccountRow[]; selfId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("support");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function openDialog(next: Dialog) {
    setEmail("");
    setName("");
    setRole(next.kind === "role_change" ? (next.target.role === "support" ? "super_admin" : "support") : "support");
    setReason("");
    setError("");
    setDialog(next);
  }

  async function post(url: string, payload: Record<string, unknown>) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "İşlem yapılamadı, tekrar dene.");
    return data as Record<string, unknown>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dialog || dialog.kind === "created") return;
    setError("");
    setLoading(true);
    try {
      if (dialog.kind === "create") {
        const data = await post("/api/admin/admins", { email, name, role, reason });
        setDialog({ kind: "created", email: String(data.email), password: String(data.password) });
      } else {
        await post(`/api/admin/admins/${dialog.target.id}`, { action: dialog.kind, role, reason });
        toast(`${ADMIN_ACCOUNT_ACTIONS[dialog.kind].label}: tamamlandı.`);
        setDialog(null);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  const title =
    dialog?.kind === "create"
      ? "Yönetici ekle"
      : dialog?.kind === "created"
        ? "Hesap açıldı"
        : dialog
          ? `${ADMIN_ACCOUNT_ACTIONS[dialog.kind].label}: ${dialog.target.name || dialog.target.email}`
          : "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Hesaplar silinmez, erişimi kapatılır. Kimse kendi rolüne ya da erişimine dokunamaz.</p>
        <Button type="button" size="sm" onClick={() => openDialog({ kind: "create" })}>
          Yönetici ekle
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Yönetici</th>
            <th>Rol</th>
            <th className="hidden sm:table-cell">Son giriş</th>
            <th>
              <span className="sr-only">İşlemler</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const self = row.id === selfId;
            return (
              <tr key={row.id} className={row.disabled ? "text-ink-soft" : undefined}>
                <td className="max-w-[16rem]">
                  <p className="truncate font-semibold text-ink">
                    {row.name || row.email}
                    {self && <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft">sen</span>}
                  </p>
                  <p className="truncate text-[13px] text-ink-soft">{row.email}</p>
                </td>
                <td className="whitespace-nowrap">
                  {ADMIN_ROLE_LABELS[row.role]}
                  {row.disabled && <span className="block text-[12px] text-paprika-deep">Erişim kapalı</span>}
                </td>
                <td className="hidden whitespace-nowrap font-mono text-[12px] text-ink-soft sm:table-cell">{row.lastLogin || "Henüz giriş yok"}</td>
                <td className="w-px whitespace-nowrap text-right">
                  {!self && (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "role_change", target: row })}>
                        Rolü değiştir
                      </Button>
                      {row.disabled ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => openDialog({ kind: "enable", target: row })}>
                          Erişimi aç
                        </Button>
                      ) : (
                        <Button type="button" variant="danger" size="sm" onClick={() => openDialog({ kind: "disable", target: row })}>
                          Erişimi kapat
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Modal open={dialog !== null} title={title} onClose={() => !loading && setDialog(null)} dismissable={!loading}>
        {dialog?.kind === "created" ? (
          <div className="space-y-4">
            <p className="rounded-md border border-paprika/30 bg-paprika/10 px-3.5 py-2.5 text-sm text-paprika">
              Geçici şifre yalnızca şimdi gösteriliyor. Güvenli bir kanaldan ilet; ilk girişte sağ üstteki hesap menüsünden (Şifreyi değiştir) yenilemesini iste.
            </p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">E-posta</dt>
                <dd className="break-all text-ink">{dialog.email}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Geçici şifre</dt>
                <dd className="select-all break-all font-mono text-base text-ink">{dialog.password}</dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setDialog(null)}>
                Kaydettim, kapat
              </Button>
            </div>
          </div>
        ) : dialog ? (
          <form onSubmit={submit} className="space-y-4">
            {dialog.kind === "create" && (
              <>
                <div>
                  <Label htmlFor="admin-email">E-posta</Label>
                  <Input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
                </div>
                <div>
                  <Label htmlFor="admin-name">Ad soyad</Label>
                  <Input id="admin-name" required maxLength={ADMIN_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </>
            )}
            {(dialog.kind === "create" || dialog.kind === "role_change") && (
              <div>
                <Label htmlFor="admin-role">Rol</Label>
                <Select id="admin-role" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                  {ADMIN_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ADMIN_ROLE_LABELS[value]}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-ink-soft">
                  Destek: işletmeleri görür, not ekler, süre uzatır. Süper yönetici: plan, askı, silme, içerik ve yönetici işlemleri.
                </p>
              </div>
            )}
            {dialog.kind === "disable" && (
              <p className="rounded-md border border-paprika/30 bg-paprika/10 px-3.5 py-2.5 text-sm text-paprika">
                Yönetici panelden hemen çıkarılır ve giriş yapamaz. Hesap ve geçmişi silinmez; erişim geri açılabilir.
              </p>
            )}
            <div>
              <Label htmlFor="admin-reason">Gerekçe (denetim kaydına yazılır)</Label>
              <Textarea
                id="admin-reason"
                rows={2}
                required={dialog.kind !== "create"}
                minLength={dialog.kind === "create" ? undefined : REASON_MIN}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={dialog.kind === "create" ? "Ör. Destek ekibine katıldı." : "Ör. Ekipten ayrıldı."}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={loading}>
                Vazgeç
              </Button>
              <Button type="submit" variant={dialog.kind === "disable" ? "danger" : "primary"} loading={loading}>
                Onayla
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
