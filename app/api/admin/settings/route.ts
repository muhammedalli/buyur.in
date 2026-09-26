import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { auditFailureResponse, runAuditedCreate, runAuditedUpdate } from "@/lib/admin-audit";
import { reasonError } from "@/lib/admin-business-actions";
import { ensurePlanCatalog, resetPlanCatalogCache } from "@/lib/plan-catalog-loader";
import { getServicePB } from "@/lib/pocketbase-server";
import { auditRequestContext } from "@/lib/system-audit";
import {
  SETTINGS_COLLECTION,
  SYSTEM_SETTINGS,
  isSystemSettingKey,
  settingValueError,
  type SettingRecordLike,
} from "@/lib/system-settings";

// Sistem geneli bir ayarı (buyur_settings) değiştirir — yalnızca super_admin.
// Sıra: 401/403 (oturum, rol) → 400 (girdi) → iş. Yazma yöneticinin kendi
// token'ıyla yapılır; PocketBase kuralı da yalnızca super_admin'e açık (ikinci
// kilit). Değişiklik gerekçesiyle denetim kaydına yazılır, kayıt yazılamazsa
// geri alınır. Ayar tanımları ve sınırları: lib/system-settings.ts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req, { action: "settings.edit" });
  if (!auth.ok) return auth.response;
  const { pb, admin } = auth.session;

  let body: { key?: unknown; value?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!isSystemSettingKey(body.key)) {
    return NextResponse.json({ error: "Bilinmeyen ayar." }, { status: 400 });
  }
  const key = body.key;
  const valueError = settingValueError(key, body.value);
  if (valueError) return NextResponse.json({ error: valueError }, { status: 400 });
  const value = body.value as number;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonProblem = reasonError(reason);
  if (reasonProblem) return NextResponse.json({ error: reasonProblem }, { status: 400 });

  let existing: SettingRecordLike | null;
  try {
    existing = await pb
      .collection(SETTINGS_COLLECTION)
      .getFirstListItem<SettingRecordLike>(pb.filter("key = {:key}", { key }), { requestKey: null })
      .catch((err) => {
        if ((err as { status?: number })?.status === 404) return null;
        throw err;
      });
  } catch (err) {
    console.error("[admin-settings] ayar okunamadı", key, err);
    return NextResponse.json({ error: "Ayar okunamadı, tekrar dene." }, { status: 503 });
  }
  if (existing?.value === value) {
    return NextResponse.json({ error: "Değer zaten bu; kaydedilecek bir değişiklik yok." }, { status: 400 });
  }

  // Kayıt satırında hangi ayarın değiştiği adıyla görünsün (meta.label).
  const request = auditRequestContext(req);
  const context = {
    admin,
    action: "settings.edit",
    reason,
    ip: request.ip,
    meta: { ...request.meta, label: SYSTEM_SETTINGS[key].label, key },
  };
  const result =
    existing?.id
      ? await runAuditedUpdate(pb, { ...context, collection: SETTINGS_COLLECTION, id: existing.id, patch: { value } })
      : await runAuditedCreate<Record<string, unknown> & { id: string }>(pb, {
          ...context,
          collection: SETTINGS_COLLECTION,
          data: { key, value },
        });
  if (!result.ok) {
    console.error("[admin-settings] ayar kaydedilemedi", key, result.reason, result.error);
    const failure = auditFailureResponse(result);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  // Bu sunucuda hemen geçerli olsun; diğer örnekler 60 sn önbellekle yakalar.
  resetPlanCatalogCache();
  await ensurePlanCatalog(await getServicePB()).catch((err) => console.error("[admin-settings] katalog yenilenemedi", err));
  return NextResponse.json({ ok: true });
}
