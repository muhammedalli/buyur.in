"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label } from "@/components/panel/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

// Yöneticinin kendi şifresini değiştirmesi (ilk girişte geçici şifre bu formla değişir).
export function AdminPasswordForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
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
      setOldPassword("");
      setPassword("");
      setPasswordConfirm("");
      setOpen(false);
      setDone(true);
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink-soft">
          {done ? "Şifren değişti. Diğer cihazlardaki oturumların kapandı." : "Geçici şifreyle giriş yaptıysan hemen değiştir."}
        </p>
        <Button type="button" variant="outline" onClick={() => { setDone(false); setOpen(true); }} className="px-3.5 py-2 text-[12px]">
          Şifre değiştir
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-line pt-4">
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
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(""); }}>
          Vazgeç
        </Button>
        <Button type="submit" loading={loading}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}
