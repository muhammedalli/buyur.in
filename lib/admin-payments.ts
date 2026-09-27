// Yönetim panelinin ödeme kayıtlarını okuyan sunucu katmanı. Okuma
// yöneticinin kendi yetkisiyle yapılır (requireAdmin → pb); koleksiyon yalnızca
// yönetime açıktır. Yazmalar app/api/admin/payments uçlarındadır.

import type PocketBase from "pocketbase";
import { PAYMENTS_COLLECTION, paymentDay, sortPayments } from "@/lib/payments";
import type { PaymentRow } from "@/components/admin/payments";
import type { Payment } from "@/lib/types";

/** Kayıtlar okunamazsa null: ekran "okunamadı" der, sıfır bakiye göstermez
 *  (yanlış "borcu yok" bilgisi, hiç bilgi olmamasından kötüdür). */
export async function loadPayments(pb: PocketBase, businessId?: string): Promise<Payment[] | null> {
  try {
    const list = await pb.collection(PAYMENTS_COLLECTION).getFullList<Payment>({
      ...(businessId ? { filter: pb.filter("business = {:id}", { id: businessId }) } : {}),
      expand: "business",
      fields: "id,business,type,amount,date,method,status,note,created,updated,expand.business.id,expand.business.name,expand.business.slug",
      batch: 500,
      requestKey: null,
    });
    return sortPayments(list);
  } catch (err) {
    console.error("[admin-payments] kayıtlar okunamadı", err);
    return null;
  }
}

export function toPaymentRow(payment: Payment): PaymentRow {
  const business = payment.expand?.business;
  return {
    id: payment.id,
    business: payment.business,
    businessName: business?.name || business?.slug || "Adsız hesap",
    type: payment.type,
    amount: payment.amount,
    day: paymentDay(payment),
    method: payment.method ?? "",
    status: payment.status,
    note: payment.note ?? "",
  };
}
