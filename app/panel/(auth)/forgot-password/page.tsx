"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MailIcon } from "@/components/icons";
import { errorMessage } from "@/components/panel/auth-card";
import { AuthAlternative, AuthError, AuthHeading, AuthInput, AuthLabel, AuthSubmit } from "@/components/panel/auth-form";

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
      <>
        <AuthHeading
          title={
            <>
              E-postanı
              <br />
              kontrol et
            </>
          }
          description={
            <>
              <span className="font-medium text-ink">{sentTo}</span> adresiyle kayıtlı bir hesap varsa, şifreni sıfırlaman
              için bir bağlantı gönderdik. Bağlantı 60 dakika geçerli. Gelen kutunda yoksa spam klasörüne bak.
            </>
          }
        />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <Link href="/panel/login" className="font-medium text-paprika hover:underline">
            Giriş ekranına dön
          </Link>
          <button type="button" onClick={() => setSentTo(null)} className="text-ink-soft hover:text-ink hover:underline">
            Farklı bir adres dene
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={
          <>
            Şifreni mi
            <br />
            unuttun?
          </>
        }
        description="Hesabının e-posta adresini yaz, yeni şifre belirlemen için bir bağlantı gönderelim."
      />
      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <AuthLabel htmlFor="email">E-posta</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ornek@isletme.com"
            icon={<MailIcon size={20} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <AuthError>{error}</AuthError>
        <AuthSubmit loading={loading}>Bağlantı gönder</AuthSubmit>
      </form>
      <AuthAlternative question="Şifreni hatırladın mı?" href="/panel/login" label="Giriş yap" />
    </>
  );
}
