// Yönetimden askıya alma. Askıdaki işletmenin menüsü ve sitesi yayından kalkar,
// görüntülenme sayılmaz, vitrinde ve sitemap'te görünmez; hiçbir veri silinmez,
// askı kaldırılınca her şey olduğu gibi geri gelir.
//
// `is_active`'ten ayrı bir alan: is_active'i sahibi kurulum ekranında yazar ve
// değiştirebilir; askıyı yalnızca super_admin koyar ve kaldırır (alan hesap
// sahibine kapalıdır, bkz. scripts/business-schema.mjs).
//
// Kontrol bilerek PocketBase filtresinde değil kodda yapılır: alan eksik bir
// kurulumda filtre 400 verir ve menüyü kapatırdı. Alan yoksa işletme askıda
// sayılmaz (serbestlik varsayımı).

import type { Business } from "@/lib/types";

export const SUSPENSION_REASON_MAX = 300;

export function isSuspended(business: Pick<Business, "suspended_at"> | null | undefined): boolean {
  return Boolean(business?.suspended_at?.trim());
}
