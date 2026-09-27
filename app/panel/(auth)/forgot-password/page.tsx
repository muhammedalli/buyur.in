"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MailIcon } from "@/components/icons";
import { errorMessage } from "@/components/panel/auth-card";
import { AuthAlternative, AuthError, AuthHeading, AuthInput, AuthLabel, AuthSubmit } from "@/components/panel/auth-form";
import { useUiLocale } from "@/components/ui-locale-provider";

// Şifremi unuttum — e-posta adresi alınır, kayıtlıysa sıfırlama bağlantısı
// gönderilir. Ekran hesabın var olup olmadığını söylemez: sunucu her durumda
// aynı yanıtı verir, burada da tek bir "gönderdik" mesajı gösterilir.

export default function ForgotPasswordPage() {
  const { t, locale } = useUiLocale();
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
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      if (!res.ok) {
        setError(t(await errorMessage(res, "İstek gönderilemedi, tekrar dene.")));
        return;
      }
      setSentTo(email.trim());
    } catch {
      setError(t("Bağlantı kurulamadı, tekrar dene."));
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
              {t("E-postanı")}
              <br />
              {t("kontrol et")}
            </>
          }
          description={t(
            "{email} adresiyle kayıtlı bir hesap varsa, şifreni sıfırlaman için bir bağlantı gönderdik. Bağlantı 60 dakika geçerli. Gelen kutunda yoksa spam klasörüne bak.",
            { email: sentTo }
          )}
        />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <Link href="/panel/login" className="font-medium text-paprika hover:underline">
            {t("Giriş ekranına dön")}
          </Link>
          <button type="button" onClick={() => setSentTo(null)} className="text-ink-soft hover:text-ink hover:underline">
            {t("Farklı bir adres dene")}
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
            {t("Şifreni mi")}
            <br />
            {t("unuttun?")}
          </>
        }
        description={t("Hesabının e-posta adresini yaz, yeni şifre belirlemen için bir bağlantı gönderelim.")}
      />
      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <AuthLabel htmlFor="email">{t("E-posta")}</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t("ornek@isletme.com")}
            icon={<MailIcon size={20} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <AuthError>{error}</AuthError>
        <AuthSubmit loading={loading}>{t("Bağlantı gönder")}</AuthSubmit>
      </form>
      <AuthAlternative question={t("Şifreni hatırladın mı?")} href="/panel/login" label={t("Giriş yap")} />
    </>
  );
}
