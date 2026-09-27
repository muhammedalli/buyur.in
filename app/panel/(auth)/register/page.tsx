"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { MailIcon, PhoneIcon, UtensilsIcon } from "@/components/icons";
import {
  AuthAlternative,
  AuthError,
  AuthHeading,
  AuthInput,
  AuthLabel,
  AuthNotice,
  AuthPasswordInput,
  AuthSubmit,
} from "@/components/panel/auth-form";
import { PLAN_LABELS } from "@/lib/entitlements";
import { parsePlanIntent, savePlanIntent, type IntentPlan } from "@/lib/plan-intent";
import { captureAttribution, trackMarketingEvent } from "@/lib/marketing-events";
import { OTP_RESEND_SECONDS } from "@/lib/otp-client";
import { checkSignupPhone } from "@/lib/phone";
import { passwordProblem } from "@/lib/password";
import { errorMessage } from "@/components/panel/auth-card";
import { markLogin } from "@/lib/auth-persistence";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { useUiLocale } from "@/components/ui-locale-provider";
import type { Translator } from "@/lib/ui-i18n";

function startTitle(intent: IntentPlan, t: Translator): ReactNode {
  return intent === "premium" ? (
    <>
      {t("Premium'u")}
      <br />
      {t("başlat")}
    </>
  ) : (
    <>
      {t("Elite'i")}
      <br />
      {t("başlat")}
    </>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { t, locale } = useUiLocale();
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [intent, setIntent] = useState<IntentPlan | null>(null);

  // Landing'deki "Premium'u başlat" buraya ?plan=premium ile gelir. Niyet
  // saklanır; hesap açılıp menü kurulunca ödeme adımı panelden başlatılır.
  // (useSearchParams yerine window: sayfa statik kalsın, Suspense gerekmesin.)
  useEffect(() => {
    captureAttribution();
    const parsed = parsePlanIntent(window.location.search);
    if (parsed) {
      savePlanIntent(parsed.plan, parsed.billing);
      setIntent(parsed.plan);
    }
  }, []);

  // "Kodu tekrar gönder" sayacı — sunucu da aynı süreyi uyguluyor, buradaki
  // sayaç yalnızca kullanıcıyı boşuna denemekten kurtarır.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(resend = false) {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Doğrulama e-postası arayüz dilinde gönderilir.
        body: JSON.stringify({ name, email, locale }),
      });
      if (!res.ok) {
        setError(t(await errorMessage(res, "Doğrulama kodu gönderilemedi, tekrar dene.")));
        return;
      }
      setStep("code");
      setCooldown(OTP_RESEND_SECONDS);
      if (resend) setNotice(t("Yeni kod gönderildi."));
    } catch {
      setError(t("Bağlantı kurulamadı, tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const phoneCheck = checkSignupPhone(phone);
    if (!phoneCheck.ok) {
      setError(t(phoneCheck.error));
      return;
    }
    setPhone(phoneCheck.value);
    const problem = passwordProblem(password, passwordConfirm);
    if (problem) {
      setError(t(problem.message, problem.vars));
      return;
    }
    await requestCode();
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, passwordConfirm, code, locale }),
      });
      if (!res.ok) {
        setError(t(await errorMessage(res, "Kayıt oluşturulamadı, tekrar dene.")));
        return;
      }
      await pb.collection(BUSINESS_COLLECTION).authWithPassword(email, password);
      // Yeni hesap hatırlanır; kısa ömürlü oturum isteyen giriş ekranından seçer.
      markLogin(true);
      trackMarketingEvent("signup_completed", { plan_intent: intent ?? "freemium" });
      router.replace("/panel");
    } catch {
      setError(t("Kayıt tamamlanamadı, giriş ekranından dene."));
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <>
        <AuthHeading
          title={
            <>
              {t("E-postanı")}
              <br />
              {t("doğrula")}
            </>
          }
          description={t("{email} adresine 6 haneli bir kod gönderdik. Gelen kutunda yoksa spam klasörüne bak.", { email })}
        />
        <form onSubmit={handleCodeSubmit} className="mt-10 space-y-6">
          <div>
            <AuthLabel htmlFor="code">{t("Doğrulama kodu")}</AuthLabel>
            <AuthInput
              id="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center font-mono text-xl tracking-[0.5em]"
            />
          </div>
          <AuthError>{error}</AuthError>
          <AuthNotice>{notice}</AuthNotice>
          <AuthSubmit loading={loading} disabled={code.length !== 6}>
            {t("Hesabı oluştur")}
          </AuthSubmit>
        </form>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setCode("");
              setError("");
              setNotice("");
            }}
            className="text-ink-soft hover:text-ink hover:underline"
          >
            {t("Bilgileri düzenle")}
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || loading}
            onClick={() => requestCode(true)}
            className="font-medium text-paprika hover:underline disabled:cursor-not-allowed disabled:text-ink-soft disabled:no-underline"
          >
            {cooldown > 0 ? t("Tekrar gönder ({seconds})", { seconds: cooldown }) : t("Kodu tekrar gönder")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={
          intent ? (
            startTitle(intent, t)
          ) : (
            <>
              {t("Ücretsiz")}
              <br />
              {t("hesap aç")}
            </>
          )
        }
        description={
          intent
            ? t("Önce hesabını aç ve menünü kur; {plan} geçişini panelden tek tıkla başlatırsın. Kredi kartı şimdi istenmez.", {
                plan: PLAN_LABELS[intent],
              })
            : t("Kredi kartı gerekmez, 5 dakikada kurulur. Telefon, işletmenin iletişim numarası olarak kaydedilir.")
        }
      />
      <form onSubmit={handleDetailsSubmit} className="mt-7 space-y-4">
        <div>
          <AuthLabel htmlFor="name">{t("İşletme adı")}</AuthLabel>
          <AuthInput
            id="name"
            required
            autoComplete="organization"
            placeholder={t("Alpha Cafe")}
            icon={<UtensilsIcon size={20} />}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        <div>
          <AuthLabel htmlFor="phone">{t("Telefon")}</AuthLabel>
          <AuthInput
            id="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="0532 123 45 67"
            icon={<PhoneIcon size={19} />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => {
              // Geçerliyse tek biçime getir; değilse kullanıcının yazdığına dokunma.
              const check = checkSignupPhone(phone);
              if (check.ok) setPhone(check.value);
            }}
          />
        </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <AuthLabel htmlFor="password">{t("Şifre")}</AuthLabel>
          <AuthPasswordInput
            id="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <AuthLabel htmlFor="passwordConfirm">{t("Şifre tekrar")}</AuthLabel>
          <AuthPasswordInput
            id="passwordConfirm"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        </div>
        </div>
        {passwordConfirm.length > 0 && password !== passwordConfirm && (
          <p className="text-sm text-paprika-deep">{t("Şifreler eşleşmiyor.")}</p>
        )}
        <AuthError>{error}</AuthError>
        <AuthSubmit loading={loading}>{t("Doğrulama kodu gönder")}</AuthSubmit>
      </form>
      <AuthAlternative question={t("Zaten hesabın var mı?")} href="/panel/login" label={t("Giriş yap")} />
    </>
  );
}
