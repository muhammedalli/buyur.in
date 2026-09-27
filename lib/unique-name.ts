// İŞLETME BAZLI AD TEKİLLİĞİ.
//
// Aynı işletmede iki "Türk Kahvesi" ya da iki "İçecekler" olması müşteri
// menüsünde kafa karıştırır, panelde de hangisini düzenlediğinizi belirsizleştirir.
// Karşılaştırma ham metinle değil, aktarımın da kullandığı katlama anahtarıyla
// yapılır: "TÜRK KAHVESİ", "turk kahvesi" ve "Türk  Kahvesi" aynı addır.
//
// Kontrol yazmadan ÖNCE yapılır; kullanıcı hatayı kaydetmeden görür.

import { pb } from "@/lib/pocketbase";
import { normalizeEntryName } from "@/lib/ai/import-plan";
import { msg } from "@/lib/ui-i18n";

type Collection = "buyur_categories" | "buyur_products";

/** Aynı adı taşıyan başka bir kaydın kimliği (yoksa null).
 *  `excludeId` düzenleme akışı içindir: kayıt kendi adıyla çakışmaz. */
export async function findSameName(
  collection: Collection,
  businessId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  const key = normalizeEntryName(name);
  // Adsız kayıt tekillik kuralına girmez; zaten form zorunlu alan olarak eler.
  if (key === "") return null;

  const records = await pb.collection(collection).getFullList<{ id: string; name: string }>({
    filter: pb.filter("business = {:id}", { id: businessId }),
    fields: "id,name",
  });

  const match = records.find((record) => record.id !== excludeId && normalizeEntryName(record.name) === key);
  return match?.id ?? null;
}

/** Ad başka bir kategoride kullanılıyorsa Türkçe hata metni, değilse null.
 *  Altyapı hatasında null döner: geçici bir ağ sorunu kaydetmeyi engellemesin
 *  (bkz. lib/plan-limits.ts — kısıtlama değil serbestlik varsayılır). */
export async function categoryNameTaken(
  businessId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  try {
    const found = await findSameName("buyur_categories", businessId, name, excludeId);
    return found ? msg("Bu adda bir kategoriniz zaten var. Farklı bir ad girin.") : null;
  } catch {
    return null;
  }
}

/** Ad başka bir üründe kullanılıyorsa Türkçe hata metni, değilse null.
 *  Tekillik kategori değil İŞLETME genelindedir: aynı ürün iki kategoride
 *  ayrı ayrı durmasın. */
export async function productNameTaken(
  businessId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  try {
    const found = await findSameName("buyur_products", businessId, name, excludeId);
    return found ? msg("Bu adda bir ürününüz zaten var. Farklı bir ad girin.") : null;
  } catch {
    return null;
  }
}

/** Aktarımın ÇİFT KAYIT KORUMASI için: ad menüde şu an var mı?
 *  Yazma isteği 503 döndüğünde çağrılır — kayıt sessizce oluşmuşsa ikinci kez
 *  yazılmaz. Hata yutulmaz: okunamazsa null döner, çağıran tekrar dener. */
export async function findCategoryByName(businessId: string, name: string): Promise<{ id: string } | null> {
  const id = await findSameName("buyur_categories", businessId, name);
  return id ? { id } : null;
}

export async function findProductByName(businessId: string, name: string): Promise<{ id: string } | null> {
  const id = await findSameName("buyur_products", businessId, name);
  return id ? { id } : null;
}
