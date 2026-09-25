// Yönetim panelinin plan ekranları için sunucu okuma katmanı. Planlar admin'in
// kendi token'ıyla okunur (listRule pasif planları da admin'e açar); plan
// başına işletme sayısı servis hesabıyla okunan liste satırlarından sayılır.

import type PocketBase from "pocketbase";
import { loadBusinessRows } from "@/lib/admin-businesses";
import { normalizePlan } from "@/lib/entitlements";
import type { Plan, PlanRecord } from "@/lib/types";

export async function loadPlans(pb: PocketBase): Promise<PlanRecord[]> {
  return pb.collection("buyur_plans").getFullList<PlanRecord>({ sort: "order,created", requestKey: null });
}

export async function planBusinessCounts(): Promise<Record<Plan, number>> {
  const rows = await loadBusinessRows();
  const counts: Record<Plan, number> = { freemium: 0, premium: 0, elite: 0 };
  for (const row of rows) counts[normalizePlan(row.plan)] += 1;
  return counts;
}
