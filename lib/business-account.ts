import type { Business } from "@/lib/types";

// İşletme hesabının saf kuralları. Model: 1 işletme hesabı = 1
// buyur_businesses kaydı = 1 kimlik (auth koleksiyonu). Kayıt, kimlik ve
// işletme bilgisinin TEK kaynağıdır — ayrı kullanıcı tablosu yok.

export const BUSINESS_COLLECTION = "buyur_businesses";

/** Hesap açılır açılmaz kayıt vardır ama ad/slug kurulum ekranında dolar;
 *  o zamana kadar menü yayında değildir ve panel kurulum ekranını gösterir. */
export function isBusinessSetUp(business: Pick<Business, "slug"> | null | undefined): business is Business {
  return Boolean(business?.slug);
}

/** Menüde gösterilecek iletişim e-postası. Tek kaynak ilkesi: giriş
 *  e-postasıyla aynı adres ikinci kez saklanmaz, "menüde göster" seçimi
 *  (emailVisibility) ile giriş e-postası kullanılır. Farklı bir adres
 *  isteniyorsa contact_email'de durur. */
export function publicContactEmail(business: Pick<Business, "contact_email" | "email" | "emailVisibility">): string {
  const contact = business.contact_email?.trim();
  if (contact) return contact;
  return business.emailVisibility && business.email ? business.email : "";
}

/** Ayarlardaki "menüde görünen e-posta" girdisini kayda yazılacak alanlara
 *  çevirir: giriş e-postasıyla aynıysa yalnızca görünürlük açılır. */
export function contactEmailPatch(
  input: string,
  loginEmail: string | undefined
): { contact_email: string; emailVisibility: boolean } {
  const value = input.trim();
  if (!value) return { contact_email: "", emailVisibility: false };
  if (loginEmail && value.toLowerCase() === loginEmail.trim().toLowerCase()) {
    return { contact_email: "", emailVisibility: true };
  }
  return { contact_email: value, emailVisibility: false };
}
