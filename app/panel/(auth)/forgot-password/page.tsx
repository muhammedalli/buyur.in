"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, ErrorText, Input, Label } from "@/components/panel/ui";
import { AUTH_CARD_CLASS, errorMessage } from "@/components/panel/auth-card";

// Şifremi unuttum — e-posta adresi alınır, kayıtlıysa sıfırlama bağlantısı
// gönderilir. Ekran hesabın var olup olmadığını söylemez: sunucu her durumda
// aynı yanıtı verir, burada da tek bir "gönderdik" mesajı gösterilir.

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "İstek gönderilemedi, tekrar dene."));
        return;
      }
      setSentTo(email.trim());
    } catch {
      setError("Bağlantı kurulamadı, tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className={AUTH_CARD_CLASS}>
        <h1 className="font-display text-xl font-bold">E-postanı kontrol et</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">{sentTo}</span> adresiyle kayıtlı bir hesap varsa, şifreni sıfırlaman
          için bir bağlantı gönderdik. Bağlantı 60 dakika geçerli. Gelen kutunda yoksa spam klasörüne bak.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/panel/login" className="text-center text-sm font-medium text-paprika hover:underline">
            Giriş ekranına dön
          </Link>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-center text-sm text-ink-soft hover:underline"
          >
            Farklı bir adres dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={AUTH_CARD_CLASS}>
      <h1 className="font-display text-xl font-bold">Şifreni mi unuttun?</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Hesabının e-posta adresini yaz, yeni şifre belirlemen için bir bağlantı gönderelim.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={loading} className="w-full">
          Sıfırlama bağlantısı gönder
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Şifreni hatırladın mı?{" "}
        <Link href="/panel/login" className="font-medium text-paprika hover:underline">
          Giriş yap
        </Link>
      </p>
    </div>
  );
}
