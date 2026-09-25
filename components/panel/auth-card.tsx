// Giriş/kayıt/şifre ekranlarının ortak parçaları. Kart sınıfı tek yerde:
// dar ekranda (320px) iç boşluk küçülür, form alanları sıkışmaz.

export const AUTH_CARD_CLASS = "rounded-2xl border border-line bg-paper p-6 sm:p-8";

/** Şifre sıfırlandıktan sonra giriş ekranına eklenen işaret. */
export const RESET_DONE_PARAM = "sifre-yenilendi";

/** API'nin Türkçe hata metnini olduğu gibi kullanır; yoksa genel cümleye
 *  düşer. Kullanıcıya yığın izi değil, ne yapacağı söylenir. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    /* gövde okunamadıysa genel mesaj */
  }
  return fallback;
}
