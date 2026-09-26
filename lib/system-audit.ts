// Sunucu akışlarının denetim kaydı: hesap açma, AI işlemleri, işletme
// çıkışı, şifre sıfırlama. Bunlar işletme adına sunucuda olur (servis
// hesabı yazar), PocketBase hook'u görmez ya da (servis hesabının
// yazmaları) bilerek atlar. Kayıt biçimi ve sözlük lib/audit-log.ts'te.
//
// En iyi çabayla yazılır: kullanıcının AI sonucu ya da açılmış hesabı, kayıt
// koleksiyonundaki bir arıza yüzünden geri alınmaz (geri alınacak bir PB
// değişikliği de yoktur). Yazılamayan kayıt sunucu günlüğüne düşer.

import { after, type NextRequest } from "next/server";
import { recordAudit, type AuditEntry } from "@/lib/admin-audit";
import { getServicePB } from "@/lib/pocketbase-server";
import { clientIp } from "@/lib/rate-limit";

/** İsteğin kayda girecek bağlamı: IP ve tarayıcı. */
export function auditRequestContext(req: NextRequest): { ip: string; meta: Record<string, unknown> } {
  const agent = req.headers.get("user-agent");
  return {
    ip: clientIp(req),
    meta: { source: "next", ...(agent ? { user_agent: agent.slice(0, 300) } : {}) },
  };
}

/** Servis hesabıyla kayıt yazar; hata fırlatmaz. Yazıldıysa true. */
export async function recordSystemAudit(entry: AuditEntry): Promise<boolean> {
  try {
    const pb = await getServicePB();
    await recordAudit(pb, entry);
    return true;
  } catch (err) {
    console.error("[system-audit] denetim kaydı yazılamadı", entry.action, entry.targetId ?? "", err);
    return false;
  }
}

/** AI işleminin kaydı: kim (işletme), hangi işlem, hangi model, kaç token.
 *  Yanıttan SONRA yazılır (next/server → after): kullanıcı kayıt turunu
 *  beklemez, sunucusuz ortamda da iş yarıda kesilmez. */
export function recordAiAction(
  req: NextRequest,
  business: { id: string; email?: string; name?: string },
  action: "ai.menu_scan" | "ai.translate" | "ai.image_search",
  details: Record<string, unknown> = {}
): void {
  const context = auditRequestContext(req);
  after(() =>
    recordSystemAudit({
      actor: { type: "business", id: business.id, email: business.email ?? "" },
      action,
      targetCollection: "ai",
      businessId: business.id,
      ip: context.ip,
      meta: { ...context.meta, label: business.name ?? "", ...details },
    }).then(() => undefined)
  );
}

/** OpenAI Responses yanıtındaki token kullanımı (maliyet takibi için). */
export function aiTokenUsage(response: { usage?: { input_tokens?: number; output_tokens?: number } | null }): Record<string, number> {
  const usage = response.usage;
  if (!usage) return {};
  return { input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 };
}
