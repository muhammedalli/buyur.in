"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

// Yöneticinin kendi şifresini değiştirmesi (ilk girişte geçici şifre bu formla
// değişir). Başlıktaki hesap menüsünden açılan pencerede durur.
export function AdminPasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, password, passwordConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Şifre değiştirilemedi, tekrar dene.");
        return;
      }
      if (data?.signedOut) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }
      toast("Şifren değişti. Diğer cihazlardaki oturumların kapandı.");
      onDone();
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="admin-old-password">Mevcut şifre</Label>
        <Input id="admin-old-password" type="password" required autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="admin-new-password">Yeni şifre</Label>
        <Input id="admin-new-password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="admin-new-password-confirm">Yeni şifre (tekrar)</Label>
        <Input id="admin-new-password-confirm" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Vazgeç
        </Button>
        <Button type="submit" loading={loading}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}
