"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { Button, ErrorText, Input, Label, Spinner } from "@/components/panel/ui";
import { AUTH_CARD_CLASS, RESET_DONE_PARAM, errorMessage } from "@/components/panel/auth-card";
import { MIN_PASSWORD_LENGTH, newPasswordError } from "@/lib/password";

// Şifre sıfırlama bağlantısının açtığı ekran. Belirteç açılışta sunucuya
// doğrulatılır: geçersiz/süresi dolmuş bağlantıda kullanıcı boşuna şifre
// yazmaz. Belirteç adres çubuğundan hemen silinir ki tarayıcı geçmişinde ve
// ekran paylaşımında görünmesin.

type Phase = "checking" | "invalid" | "form" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useRef("");
  const [phase, setPhase] = useState<Phase>("checking");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Geliştirmede efekt iki kez çalışır; ikinci turda adres zaten temizlenmiştir.
    token.current ||= new URLSearchParams(window.location.search).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);

    if (!token.current) {
      setInvalidReason("Bağlantı eksik görünüyor. E-postadaki bağlantıyı tam olarak açtığından emin ol.");
      setPhase("invalid");
      return;
    }

    let cancelled = false;
    fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: token.current }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setPhase("form");
          return;
        }
        setInvalidReason(await errorMessage(res, "Bu bağlantı geçersiz ya da süresi dolmuş."));
        setPhase("invalid");
      })
      .catch(() => {
        if (cancelled) return;
        // Ağ hatası bağlantıyı geçersiz kılmaz: formu gösterip gönderimde tekrar deneriz.
        setPhase("form");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const passwordError = newPasswordError(password, passwordConfirm);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.current, password, passwordConfirm }),
      });
      if (!res.ok) {
        const body = (await res.clone().json().catch(() => null)) as { code?: string } | null;
        const message = await errorMessage(res, "Şifre güncellenemedi, tekrar dene.");
        if (body?.code === "invalid_token") {
          setInvalidReason(message);
          setPhase("invalid");
        } else {
          setError(message);
        }
        return;
      }
      // Eski oturumlar sunucuda geçersiz oldu; bu tarayıcıdaki de temizlenir.
      pb.authStore.clear();
      setPhase("done");
      setTimeout(() => router.replace(`/panel/login?${RESET_DONE_PARAM}=1`), 2500);
    } catch {
      setError("Bağlantı kurulamadı, tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className={`${AUTH_CARD_CLASS} flex items-center justify-center gap-3 text-sm text-ink-soft`}>
        <Spinner className="h-5 w-5 text-paprika" />
        Bağlantı kontrol ediliyor…
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className={AUTH_CARD_CLASS}>
        <h1 className="font-display text-xl font-bold">Bağlantı kullanılamıyor</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{invalidReason}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/panel/forgot-password" className="text-center text-sm font-medium text-paprika hover:underline">
            Yeni bağlantı iste
          </Link>
          <Link href="/panel/login" className="text-center text-sm text-ink-soft hover:underline">
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={AUTH_CARD_CLASS} role="status">
        <h1 className="font-display text-xl font-bold">Şifren güncellendi</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Güvenliğin için tüm cihazlardaki oturumların kapatıldı. Giriş ekranına yönlendiriliyorsun…
        </p>
        <Link
          href={`/panel/login?${RESET_DONE_PARAM}=1`}
          className="mt-6 block text-center text-sm font-medium text-paprika hover:underline"
        >
          Hemen giriş yap
        </Link>
      </div>
    );
  }

  return (
    <div className={AUTH_CARD_CLASS}>
      <h1 className="font-display text-xl font-bold">Yeni şifreni belirle</h1>
      <p className="mt-1 text-sm text-ink-soft">En az {MIN_PASSWORD_LENGTH} karakter olmalı.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">Yeni şifre</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="passwordConfirm">Yeni şifre tekrar</Label>
          <Input
            id="passwordConfirm"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          {passwordConfirm.length > 0 && password !== passwordConfirm && (
            <p className="mt-1.5 text-sm text-paprika-deep">Şifreler eşleşmiyor.</p>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={loading} className="w-full">
          Şifremi güncelle
        </Button>
      </form>
    </div>
  );
}
