"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { Button, ErrorText, Input, Label } from "@/components/panel/ui";
import { PLAN_LABELS } from "@/lib/entitlements";
import { parsePlanIntent, savePlanIntent, type IntentPlan } from "@/lib/plan-intent";
import { captureAttribution, trackMarketingEvent } from "@/lib/marketing-events";
import { OTP_RESEND_SECONDS } from "@/lib/otp-client";
import { checkSignupPhone } from "@/lib/phone";
import { newPasswordError } from "@/lib/password";
import { AUTH_CARD_CLASS, errorMessage } from "@/components/panel/auth-card";
import { BUSINESS_COLLECTION } from "@/lib/business-account";

const START_TITLES: Record<IntentPlan, string> = {
  premium: "Premium'u başlat",
  elite: "Elite'i başlat",
};

export default function RegisterPage() {
  const router = useRouter();
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
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Doğrulama kodu gönderilemedi, tekrar dene."));
        return;
      }
      setStep("code");
      setCooldown(OTP_RESEND_SECONDS);
      if (resend) setNotice("Yeni kod gönderildi.");
    } catch {
      setError("Bağlantı kurulamadı, tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const phoneCheck = checkSignupPhone(phone);
    if (!phoneCheck.ok) {
      setError(phoneCheck.error);
      return;
    }
    setPhone(phoneCheck.value);
    const passwordError = newPasswordError(password, passwordConfirm);
    if (passwordError) {
      setError(passwordError);
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
        body: JSON.stringify({ name, email, phone, password, passwordConfirm, code }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, "Kayıt oluşturulamadı, tekrar dene."));
        return;
      }
      await pb.collection(BUSINESS_COLLECTION).authWithPassword(email, password);
      trackMarketingEvent("signup_completed", { plan_intent: intent ?? "freemium" });
      router.replace("/panel");
    } catch {
      setError("Kayıt tamamlanamadı, giriş ekranından dene.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <div className={AUTH_CARD_CLASS}>
        <h1 className="font-display text-xl font-bold">E-postanı doğrula</h1>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">{email}</span> adresine 6 haneli bir kod gönderdik. Gelen kutunda yoksa
          spam klasörüne bak.
        </p>
        <form onSubmit={handleCodeSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="code">Doğrulama kodu</Label>
            <Input
              id="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center font-mono text-lg tracking-[0.5em]"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          {notice && <p className="text-sm text-herb">{notice}</p>}
          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full">
            Hesabı oluştur
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setCode("");
              setError("");
              setNotice("");
            }}
            className="text-ink-soft hover:underline"
          >
            Bilgileri düzenle
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || loading}
            onClick={() => requestCode(true)}
            className="font-medium text-paprika hover:underline disabled:cursor-not-allowed disabled:text-ink-soft disabled:no-underline"
          >
            {cooldown > 0 ? `Tekrar gönder (${cooldown})` : "Kodu tekrar gönder"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={AUTH_CARD_CLASS}>
      <h1 className="font-display text-xl font-bold">{intent ? START_TITLES[intent] : "Ücretsiz hesap aç"}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {intent
          ? `Önce hesabını aç ve menünü kur; ${PLAN_LABELS[intent]} geçişini panelden tek tıkla başlatırsın. Kredi kartı şimdi istenmez.`
          : "Kredi kartı gerekmez, 5 dakikada kurulur."}
      </p>
      <form onSubmit={handleDetailsSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">İşletme adı</Label>
          <Input
            id="name"
            required
            autoComplete="organization"
            placeholder="Alpha Cafe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="0532 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => {
              // Geçerliyse tek biçime getir; değilse kullanıcının yazdığına dokunma.
              const check = checkSignupPhone(phone);
              if (check.ok) setPhone(check.value);
            }}
            aria-describedby="phone-hint"
          />
          <p id="phone-hint" className="mt-1.5 text-xs text-ink-soft">
            İşletmenin iletişim numarası olarak kaydedilir; ayarlardan değiştirebilirsin.
          </p>
        </div>
        <div>
          <Label htmlFor="password">Şifre</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="passwordConfirm">Şifre tekrar</Label>
          <Input
            id="passwordConfirm"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          {passwordConfirm.length > 0 && password !== passwordConfirm && (
            <p className="mt-1.5 text-sm text-paprika">Şifreler eşleşmiyor.</p>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={loading} className="w-full">
          Doğrulama kodu gönder
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Zaten hesabın var mı?{" "}
        <Link href="/panel/login" className="font-medium text-paprika hover:underline">
          Giriş yap
        </Link>
      </p>
    </div>
  );
}
