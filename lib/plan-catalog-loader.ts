// `buyur_plans` kayıtlarını canlı katalog olarak yükler (bkz. applyPlanRecords).
// Aynı turda sistem ayarları da (`buyur_settings`, ör. yıllık indirim oranı)
// okunur: fiyatın yıllık karşılığı ikisinden birlikte hesaplanır.
//
// Plan kuralları admin panelinden değişir; kod bu kayıtları okur. Ama her
// menü açılışında ekstra bir PocketBase turu (~250ms) atmak "menü 2 saniyenin
// altında açılmalı" hedefine ters düşer. Bu yüzden kayıtlar süreç belleğinde
// kısa süre saklanır: kural değişince en geç TTL sonra her yere yansır. İki
// koleksiyon paralel okunur; ek gecikme yoktur.
//
// Hata sessizce yutulur: okunamazsa son bilinen katalog (ya da koddaki yedek)
// geçerli kalır — geçici bir ağ sorunu ödeme yapan işletmeyi kilitlemez
// (bkz. lib/plan-limits.ts). Ayarlar okunamazsa plan kataloğu yine yüklenir;
// ayarlar son bilinen/yedek değerde kalır.

import type PocketBase from "pocketbase";
import { applyPlanRecords, type PlanRecordLike } from "@/lib/entitlements";
import { applyPlanPrices, resetPlanPrices } from "@/lib/pricing";
import {
  SETTINGS_COLLECTION,
  applySystemSettings,
  resetSystemSettings,
  type SettingRecordLike,
} from "@/lib/system-settings";

/** Bir plan değişikliğinin en geç bu kadar sürede yansıması kabul edilir. */
export const PLAN_CATALOG_TTL_MS = 60_000;

let loadedAt = Number.NEGATIVE_INFINITY;
let loadedRecords: PlanRecordLike[] = [];
let loadedSettings: SettingRecordLike[] = [];
let version = 0;
let inflight: Promise<void> | null = null;

export async function ensurePlanCatalog(client: Pick<PocketBase, "collection">, now: number = Date.now()): Promise<void> {
  if (now - loadedAt < PLAN_CATALOG_TTL_MS) return;
  // Aynı anda gelen istekler tek bir okumayı paylaşır.
  if (inflight) return inflight;

  const plans = client.collection("buyur_plans").getFullList<PlanRecordLike>({ requestKey: null });
  // Ayar koleksiyonu henüz kurulmamış bir ortamda 404 döner: yedek değer geçerli.
  const settings = client
    .collection(SETTINGS_COLLECTION)
    .getFullList<SettingRecordLike>({ fields: "id,key,value,updated", requestKey: null })
    .catch(() => null);

  inflight = Promise.all([plans, settings])
    .then(([records, settingRecords]) => {
      let changed = false;
      if (settingRecords) {
        applySystemSettings(settingRecords);
        if (JSON.stringify(settingRecords) !== JSON.stringify(loadedSettings)) changed = true;
        loadedSettings = settingRecords;
      }
      if (records.length > 0) {
        applyPlanRecords(records);
        applyPlanPrices(records);
        if (JSON.stringify(records) !== JSON.stringify(loadedRecords)) changed = true;
        loadedRecords = records;
      }
      // Yalnızca içerik değiştiyse sürüm artar: gereksiz yeniden çizimi önler.
      if (changed) version += 1;
      loadedAt = now;
    })
    .catch(() => {
      // Başarısızlıkta zaman damgası güncellenmez: bir sonraki istek yeniden dener.
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Son okunan ham plan kayıtları (ad, açıklama, özellik metinleri). Pazarlama
 *  kartları bunları sunucudan istemci bileşene prop olarak taşır. */
export function loadedPlanRecords(): PlanRecordLike[] {
  return loadedRecords;
}

/** Katalog içeriği her değiştiğinde artan sayaç (arayüz yeniden çizimi için). */
export function catalogVersion(): number {
  return version;
}

/** Testler için: önbelleği sıfırlar. */
export function resetPlanCatalogCache(): void {
  loadedAt = Number.NEGATIVE_INFINITY;
  loadedRecords = [];
  loadedSettings = [];
  version = 0;
  inflight = null;
  resetPlanPrices();
  resetSystemSettings();
}
