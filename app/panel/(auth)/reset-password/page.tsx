"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { Spinner } from "@/components/panel/ui";
import { RESET_DONE_PARAM, errorMessage } from "@/components/panel/auth-card";
import { AuthError, AuthHeading, AuthLabel, AuthPasswordInput, AuthSubmit } from "@/components/panel/auth-form";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/password";
import { useUiLocale } from "@/components/ui-locale-provider";

// Şifre sıfırlama bağlantısının açtığı ekran. Belirteç açılışta sunucuya
// doğrulatılır: geçersiz/süresi dolmuş bağlantıda kullanıcı boşuna şifre
// yazmaz. Belirteç adres çubuğundan hemen silinir ki tarayıcı geçmişinde ve
// ekran paylaşımında görünmesin.

type Phase = "checking" | "invalid" | "form" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useUiLocale();
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
      setInvalidReason(t("Bağlantı eksik görünüyor. E-postadaki bağlantıyı tam olarak açtığından emin ol."));
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
        setInvalidReason(t(await errorMessage(res, "Bu bağlantı geçersiz ya da süresi dolmuş.")));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(password, passwordConfirm);
    if (problem) {
      setError(t(problem.message, problem.vars));
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
        const message = t(await errorMessage(res, "Şifre güncellenemedi, tekrar dene."));
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
      setError(t("Bağlantı kurulamadı, tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  if (phase === "checking") {
    return (
      <p role="status" className="flex items-center gap-3 text-[15px] text-ink-soft">
        <Spinner className="h-5 w-5 text-paprika" />
        {t("Bağlantı kontrol ediliyor…")}
      </p>
    );
  }

  if (phase === "invalid") {
    return (
      <>
        <AuthHeading
          title={
            <>
              {t("Bağlantı")}
              <br />
              {t("kullanılamıyor")}
            </>
          }
          description={invalidReason}
        />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <Link href="/panel/forgot-password" className="font-medium text-paprika hover:underline">
            {t("Yeni bağlantı iste")}
          </Link>
          <Link href="/panel/login" className="text-ink-soft hover:text-ink hover:underline">
            {t("Giriş ekranına dön")}
          </Link>
        </div>
      </>
    );
  }

  if (phase === "done") {
    return (
      <div role="status">
        <AuthHeading
          title={
            <>
              {t("Şifren")}
              <br />
              {t("güncellendi")}
            </>
          }
          description={t("Güvenliğin için tüm cihazlardaki oturumların kapatıldı. Giriş ekranına yönlendiriliyorsun…")}
        />
        <Link href={`/panel/login?${RESET_DONE_PARAM}=1`} className="mt-10 inline-block text-[15px] font-medium text-paprika hover:underline">
          {t("Hemen giriş yap")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading
        title={
          <>
            {t("Yeni şifreni")}
            <br />
            {t("belirle")}
          </>
        }
        description={t("En az {min} karakter olmalı.", { min: MIN_PASSWORD_LENGTH })}
      />
      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <AuthLabel htmlFor="password">{t("Yeni şifre")}</AuthLabel>
          <AuthPasswordInput
            id="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <AuthLabel htmlFor="passwordConfirm">{t("Yeni şifre tekrar")}</AuthLabel>
          <AuthPasswordInput
            id="passwordConfirm"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          {passwordConfirm.length > 0 && password !== passwordConfirm && (
            <p className="mt-2 text-sm text-paprika-deep">{t("Şifreler eşleşmiyor.")}</p>
          )}
        </div>
        <AuthError>{error}</AuthError>
        <AuthSubmit loading={loading}>{t("Şifremi güncelle")}</AuthSubmit>
      </form>
    </>
  );
}
