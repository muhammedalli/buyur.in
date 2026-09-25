"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { BUSINESS_COLLECTION } from "@/lib/business-account";
import { Button, ErrorText, Input, Label } from "@/components/panel/ui";
import { AUTH_CARD_CLASS, RESET_DONE_PARAM } from "@/components/panel/auth-card";

/** Giriş hatasını kullanıcının diliyle anlatır. Ağ hatası "şifre hatalı"
 *  diye gösterilirse kullanıcı doğru şifresini boşuna değiştirmeye kalkar. */
function loginErrorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
    if (err.status === 429) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
    if (err.status >= 500) return "Şu anda giriş yapılamıyor. Biraz sonra tekrar dene.";
  }
  return "E-posta veya şifre hatalı.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Şifre sıfırlama ekranından dönüldüyse başarı mesajı (useSearchParams yerine
  // window: sayfa statik kalsın, Suspense gerekmesin).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(RESET_DONE_PARAM)) {
      setNotice("Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await pb.collection(BUSINESS_COLLECTION).authWithPassword(email.trim(), password);
      router.replace("/panel");
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={AUTH_CARD_CLASS}>
      <h1 className="font-display text-xl font-bold">Panele giriş yap</h1>
      <p className="mt-1 text-sm text-ink-soft">Menünü yönetmek için giriş yap.</p>
      {notice && (
        <p role="status" className="mt-4 rounded-xl border border-herb/30 bg-herb/10 px-3.5 py-2.5 text-sm text-herb">
          {notice}
        </p>
      )}
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
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Label htmlFor="password" className="mb-0">
              Şifre
            </Label>
            <Link
              href="/panel/forgot-password"
              className="text-xs font-medium text-paprika hover:underline"
            >
              Şifremi unuttum
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={loading} className="w-full">
          Giriş yap
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Hesabın yok mu?{" "}
        <Link href="/panel/register" className="font-medium text-paprika hover:underline">
          Kayıt ol
        </Link>
      </p>
    </div>
  );
}
