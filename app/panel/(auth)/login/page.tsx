"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { markLogin } from "@/lib/auth-persistence";
import { MailIcon } from "@/components/icons";
import { RESET_DONE_PARAM } from "@/components/panel/auth-card";
import {
  AuthAlternative,
  AuthCheckbox,
  AuthError,
  AuthHeading,
  AuthInput,
  AuthLabel,
  AuthNotice,
  AuthPasswordInput,
  AuthSubmit,
} from "@/components/panel/auth-form";
import { useUiLocale } from "@/components/ui-locale-provider";
import { msg } from "@/lib/ui-i18n";

/** Giriş hatasını kullanıcının diliyle anlatır. Ağ hatası "şifre hatalı"
 *  diye gösterilirse kullanıcı doğru şifresini boşuna değiştirmeye kalkar.
 *  Türkçe kaynak metin döner; ekrana basılırken çevrilir. */
function loginErrorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return msg("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    if (err.status === 429) return msg("Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.");
    if (err.status >= 500) return msg("Şu anda giriş yapılamıyor. Biraz sonra tekrar dene.");
  }
  return msg("E-posta veya şifre hatalı.");
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useUiLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Şifre sıfırlama ekranından dönüldüyse başarı mesajı (useSearchParams yerine
  // window: sayfa statik kalsın, Suspense gerekmesin).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(RESET_DONE_PARAM)) {
      setNotice(t("Şifren güncellendi. Yeni şifrenle giriş yapabilirsin."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await pb.collection(BUSINESS_COLLECTION).authWithPassword(email.trim(), password);
      markLogin(remember);
      router.replace("/panel");
    } catch (err) {
      setError(t(loginErrorMessage(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthHeading
        title={
          <>
            {t("Panele")}
            <br />
            {t("giriş yap")}
          </>
        }
        description={t("Menünü yönetmek için giriş yap.")}
      />
      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <AuthNotice>{notice}</AuthNotice>
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
          <AuthLabel htmlFor="password">{t("Şifre")}</AuthLabel>
          <AuthPasswordInput
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AuthCheckbox checked={remember} onChange={setRemember}>
            {t("Beni hatırla")}
          </AuthCheckbox>
          <Link href="/panel/forgot-password" className="text-[15px] font-medium text-paprika hover:underline lg:text-base">
            {t("Şifremi unuttum?")}
          </Link>
        </div>
        <AuthError>{error}</AuthError>
        <AuthSubmit loading={loading}>{t("Giriş yap")}</AuthSubmit>
      </form>
      <AuthAlternative question={t("Hesabın yok mu?")} href="/panel/register" label={t("Kayıt ol")} />
    </>
  );
}
