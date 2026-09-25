import type PocketBase from "pocketbase";
import { createServerPB } from "@/lib/pocketbase";
import { BUSINESS_COLLECTION, isBusinessSetUp } from "@/lib/business-account";
import type { Business } from "@/lib/types";

// Route handler'larda oturum doğrulama. Oturumun sahibi işletme kaydının
// kendisidir: "bu işletme bu kullanıcıya mı ait?" diye ayrı bir sahiplik
// sorgusu yoktur — kayıt kimliği = işletme kimliği.

export interface BusinessSession {
  /** Kullanıcının kendi yetkisiyle konuşan istemci (istek başına taze). */
  pb: PocketBase;
  business: Business;
}

/** Authorization başlığındaki oturumu PocketBase'e doğrulatır. Geçersizse
 *  null. Kurulumu bitmemiş hesap da döner; gerekiyorsa çağıran
 *  `isBusinessSetUp` ile ayırır. */
export async function authenticateBusiness(authHeader: string | null): Promise<BusinessSession | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const pb = createServerPB();
  pb.authStore.save(token, null);
  try {
    const auth = await pb.collection(BUSINESS_COLLECTION).authRefresh<Business>({ requestKey: null });
    return { pb, business: auth.record };
  } catch {
    return null;
  }
}

/** Servis hesabıyla e-postadan hesap bulur (kayıt, şifre sıfırlama).
 *
 *  `email = {:email}` filtresi KULLANILMAZ: PocketBase, e-posta görünürlüğü
 *  kapalı hesaplarda auth `email` alanıyla filtrelemeye yalnızca süper
 *  kullanıcıya izin veriyor — manageRule yetmiyor ve filtre hata vermeden
 *  boş (404) dönüyor. Bu yüzden "şifremi unuttum" hesabı hiç bulamıyor,
 *  "bu e-posta zaten kayıtlı" kontrolü hiç tutmuyordu. Servis hesabı yönetim
 *  yetkisiyle e-postaları görebildiği için eşleşme burada aranır; yalnızca
 *  seyrek işlemlerde çağrılır ve kimlik+e-posta alanlarını çeker. */
export async function findBusinessByEmail(
  service: PocketBase,
  email: string
): Promise<{ id: string; email: string; name: string } | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const accounts = await service
    .collection(BUSINESS_COLLECTION)
    .getFullList<{ id: string; email: string; name: string }>({ fields: "id,email,name", batch: 1000, requestKey: null });
  return accounts.find((account) => account.email?.trim().toLowerCase() === target) ?? null;
}

export { isBusinessSetUp };
