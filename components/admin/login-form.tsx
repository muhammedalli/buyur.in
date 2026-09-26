"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label } from "@/components/panel/ui";
import { AUTH_CARD_CLASS } from "@/components/panel/auth-card";
import { OTP_LENGTH } from "@/lib/otp-client";

type Step = "credentials" | "code";

interface ApiResult {
  ok: boolean;
  error?: string;
  restart?: boolean;
}

async function post(url: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return {
      ok: false,
      error: typeof data?.error === "string" && data.error ? data.error : "Bir sorun oluştu, tekrar dene.",
      restart: data?.restart === true,
    };
  } catch {
    return { ok: false, error: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." };
  }
}

// İki adımlı giriş: şifre, ardından e-postaya gelen kod. Şifre bu bileşende
// yalnızca "yeni kod iste" için bellekte tutulur; hiçbir yere yazılmaz.
export function AdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    setError("");
    setNotice("");
    setLoading(true);
    const result = await post("/api/admin/auth/login", { email: email.trim(), password });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "");
      return;
    }
    setCode("");
    setStep("code");
    setNotice(`Giriş kodu ${email.trim()} adresine gönderildi.`);
  }

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    await requestCode();
  }

  async function handleCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await post("/api/admin/auth/verify", { code: code.trim() });
    if (result.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    setLoading(false);
    setError(result.error ?? "");
    if (result.restart) {
      setStep("credentials");
      setNotice("");
      setCode("");
    }
  }

  function startOver() {
    setStep("credentials");
    setCode("");
    setError("");
    setNotice("");
  }

  return (
    <div className={AUTH_CARD_CLASS}>
      <h1 className="font-display text-xl font-bold">Yönetim paneline giriş</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {step === "credentials"
          ? "Yalnızca buyur ekibi içindir. İşletme hesabınla giriş yapmak için panel girişini kullan."
          : "E-postana gelen 6 haneli kodu gir."}
      </p>

      {notice && (
        <p role="status" className="mt-4 rounded-md border border-herb/30 bg-herb/10 px-3.5 py-2.5 text-sm text-herb">
          {notice}
        </p>
      )}

      {step === "credentials" ? (
        <form onSubmit={handleCredentials} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="admin-email">E-posta</Label>
            <Input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="admin-password">Şifre</Label>
            <Input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} className="w-full">
            Devam et
          </Button>
        </form>
      ) : (
        <form onSubmit={handleCode} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="admin-code">Giriş kodu</Label>
            <Input
              id="admin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d*"
              maxLength={OTP_LENGTH}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} disabled={code.length !== OTP_LENGTH} className="w-full">
            Giriş yap
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={startOver} className="px-0">
              Geri dön
            </Button>
            <Button type="button" variant="ghost" onClick={requestCode} disabled={loading} className="px-0">
              Yeni kod iste
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
