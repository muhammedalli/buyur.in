import { after, NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin-audit";
import { aiErrorResponse, isGuardFailure, openaiClient } from "@/lib/ai/guard";
import {
  addSource,
  applyMenuOps,
  buildAssistantPrompt,
  buildFollowUpInstruction,
  fillFromSource,
  groundScan,
  detectLinks,
  stripLinks,
  draftStats,
  draftSummary,
  mergeExtracted,
  normalizeAssistantReply,
  normalizeDraft,
  readJsonSource,
  type MenuDraft,
  type MenuOp,
} from "@/lib/ai/menu-assistant";
import { addUsage, emptyUsage, extractFromPages, extractGrounded, readMenuLink, safeJson, type LinkReadResult } from "@/lib/ai/menu-extract";
import { MAX_SOURCE_CHARS } from "@/lib/ai/menu-link";
import { parseMenuPages, type MenuPage, type ScanResult } from "@/lib/ai/menu-scan";
import { getServicePB } from "@/lib/pocketbase-server";
import { auditRequestContext } from "@/lib/system-audit";

// Yönetim panelinin menü asistanı: yönetici sohbet eder, asistan menü
// TASLAĞINI günceller. Kayda hiçbir şey yazılmaz; taslak yöneticinin
// tarayıcısında durur ve onaydan sonra /api/admin/businesses/[id]/import ile
// yazılır.
//
// Tek mesaj birkaç kaynak taşıyabilir: ekli fotoğraf/PDF, bağlantı(lar), JSON
// ya da düz metin. Kaynaklar menü çıkarma kurallarıyla (tahmin yok, okunamayan
// fiyat null) okunup taslağa eklenir; mesajın geri kalanı düzenleme komutu
// sayılır ve modelden işlem listesi istenir (lib/ai/menu-assistant.ts).
// Yetki business.content: aynı asistan var olan işletmenin menüsünde de çalışır.
//
// Okunan bağlantı taslağın `sources` alanında taşınır: sonraki mesajda
// ("fiyatları al") model `reread_source` der, kaynak yeniden okunur ve
// taslaktaki boşluklar doldurulur (fillFromSource) — model kaynağı görmeden
// "çekemem" demek zorunda kalmaz.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Sohbet modeli talimat takibinde güçlü olmalı (işlem listesi, "uydurma" kuralı,
// toplu açıklama/ayrıntı). Kaynaktan çıkarma MENU_MODEL'de kalır: o iş kodla
// kaynağa karşı sınanıyor (groundScan).
const ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL ?? "gpt-5-mini";
/** Akıl yürüten modeller (gpt-5*, o*) için düşük efor: yanıt süresi kısa kalsın. */
const REASONING = /^(gpt-5|o\d)/.test(ASSISTANT_MODEL) ? { reasoning: { effort: "low" as const } } : {};
const MAX_MESSAGE_CHARS = MAX_SOURCE_CHARS;
const MAX_ATTACHMENTS = 5;
const MAX_HISTORY = 8;

type HistoryEntry = { role: "user" | "assistant"; text: string };

function readHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is HistoryEntry => {
      const item = entry as HistoryEntry;
      return (item?.role === "user" || item?.role === "assistant") && typeof item.text === "string";
    })
    .slice(-MAX_HISTORY)
    .map((entry) => ({ role: entry.role, text: entry.text.slice(0, 2000) }));
}

function viaLabel(read: LinkReadResult): string {
  switch (read.via) {
    case "alt sayfa":
      return ` (${read.pages ?? 0} alt sayfa okunarak)`;
    case "tarayıcı":
      return " (tarayıcıda açılarak)";
    case "görsel":
      return " (sayfadaki menü görsellerinden)";
    default:
      return "";
  }
}

function droppedNote(count: number): string {
  return `Kaynakta adı geçmeyen ${count} ürün alınmadı (model uydurmuş olabilir).`;
}

function describeMerge(label: string, added: { categories: number; products: number; duplicates: number }): string {
  if (added.products === 0) {
    return added.duplicates > 0 ? `${label}: ürünlerin hepsi taslakta zaten vardı.` : `${label}: okunabilir ürün bulunamadı.`;
  }
  const parts = [`${label}: ${added.products} ürün eklendi`];
  if (added.categories > 0) parts[0] += ` (${added.categories} yeni kategori)`;
  if (added.duplicates > 0) parts.push(`${added.duplicates} tekrar atlandı`);
  return parts.join(", ") + ".";
}

export async function POST(req: NextRequest) {
  const auth = await authenticateAdminRequest(req, { action: "business.content" });
  if (!auth.ok) return auth.response;
  const { admin } = auth.session;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Mesaj çok uzun. Menüyü parçalara bölerek gönderin." }, { status: 400 });
  }
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!message && attachments.length === 0) {
    return NextResponse.json({ error: "Bir mesaj yazın ya da dosya ekleyin." }, { status: 400 });
  }
  let pages: MenuPage[] = [];
  if (attachments.length > 0) {
    const parsed = parseMenuPages(attachments, MAX_ATTACHMENTS);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    pages = parsed.pages;
  }
  const businessName = typeof body.businessName === "string" ? body.businessName.trim().slice(0, 120) : "";
  const history = readHistory(body.history);

  const client = openaiClient();
  if (isGuardFailure(client)) return client.response;

  let draft: MenuDraft = normalizeDraft(body.draft);
  const before = draftStats(draft);
  const notes: string[] = [];
  const sources: string[] = [];
  const usage = emptyUsage();
  const readThisTurn: string[] = [];
  let reply = "";

  const merge = (label: string, scan: ScanResult) => {
    const result = mergeExtracted(draft, scan);
    draft = result.draft;
    notes.push(describeMerge(label, { categories: result.addedCategories, products: result.addedProducts, duplicates: result.duplicateProducts }));
  };

  try {
    // 1) Ekli fotoğraf/PDF
    if (pages.length > 0) {
      sources.push(`dosya:${pages.length}`);
      merge(pages.length === 1 ? "Ekli dosya" : `Ekli ${pages.length} dosya`, await extractFromPages(client, pages, usage));
    }

    // 2) Mesajın tamamı JSON mu
    const json = message ? readJsonSource(message) : null;
    let instruction = message;
    if (json?.kind === "native") {
      sources.push("json");
      merge("JSON", json.scan);
      instruction = "";
    } else if (json?.kind === "foreign") {
      sources.push("json-ai");
      merge("JSON", (await extractGrounded(client, "bir menüyü taşıyan, biçimi bilinmeyen bir JSON verisi", json.text, usage)).scan);
      instruction = "";
    } else if (message) {
      // 3) Bağlantılar: her biri ayrı okunur; biri açılmazsa diğerleri sürer.
      //    Okuma kademeli: düz sayfa → tarayıcıda açma → sayfadaki menü görselleri.
      const links = detectLinks(message);
      for (const link of links) {
        sources.push("link");
        const read = await readMenuLink(client, link, usage);
        if (!read.scan) {
          notes.push(`${read.host}: ${read.error ?? "menü okunamadı."}`);
          continue;
        }
        merge(`${read.host}${viaLabel(read)}`, read.scan);
        draft = addSource(draft, link);
        readThisTurn.push(draft.sources[draft.sources.length - 1]);
        if (read.dropped > 0) notes.push(droppedNote(read.dropped));
      }
      // Yapıştırılmış menü metninin satırları korunur; yalnızca bağlantı varsa ayıklanır.
      if (links.length > 0) {
        instruction = stripLinks(message);
        if (instruction.length < 4) instruction = "";
      }
    }

    // 4) Geri kalan: düzenleme komutu ya da yapıştırılmış menü metni.
    if (instruction) {
      const ask = async (rereadDone: boolean) => {
        const response = await client.responses.create({
          model: ASSISTANT_MODEL,
          ...REASONING,
          input: [
            { role: "system", content: buildAssistantPrompt(draftSummary(draft), businessName, draft.sources, notes, rereadDone) },
            ...history.map((entry) => ({ role: entry.role, content: entry.text })),
            { role: "user", content: instruction },
            ...(rereadDone ? [{ role: "system" as const, content: buildFollowUpInstruction(draft, notes) }] : []),
          ],
          text: { format: { type: "json_object" } },
          max_output_tokens: 32000,
        });
        addUsage(usage, response);
        if (response.status === "incomplete") {
          // Yarım JSON hiçbir şey uygulamaz; yöneticiye işi bölmesi söylenir.
          notes.push("Yanıt çok uzun olduğu için yarıda kesildi, değişiklik uygulanmadı. İsteği kategori kategori yazın.");
        }
        return normalizeAssistantReply(safeJson(response.output_text));
      };
      const applyOps = (ops: MenuOp[]): string[] => {
        if (ops.length === 0) return [];
        const applied = applyMenuOps(draft, ops);
        draft = applied.draft;
        notes.push(...applied.skipped);
        return applied.described;
      };

      const answer = await ask(false);
      reply = answer.reply;
      if (answer.add.categories.length > 0) {
        sources.push("metin");
        // Yapıştırılan metinden çıkan menü de metnin kendisiyle sınanır.
        const grounded = groundScan(answer.add, instruction);
        merge("Mesajdaki menü", grounded.scan);
        if (grounded.droppedProducts > 0) notes.push(droppedNote(grounded.droppedProducts));
      }
      const described = applyOps(answer.ops);

      if (answer.rereadSource) {
        // Bu mesajda zaten okunan bağlantı ikinci kez okunmaz (aynı sonuç, ikinci maliyet).
        const pending = draft.sources.filter((source) => !readThisTurn.includes(source));
        if (draft.sources.length === 0) {
          notes.push("Taslağın okunduğu bir bağlantı yok; kaynaktan doldurmak için menü bağlantısını gönderin.");
        }
        let reread = false;
        for (const source of pending) {
          sources.push("reread");
          const read = await readMenuLink(client, source, usage);
          if (!read.scan) {
            notes.push(`${read.host}: ${read.error ?? "kaynak yeniden okunamadı."}`);
            continue;
          }
          reread = true;
          const filled = fillFromSource(draft, read.scan, described);
          draft = filled.draft;
          const parts = [
            filled.prices && `${filled.prices} fiyat`,
            filled.descriptions && `${filled.descriptions} açıklama`,
            filled.details && `${filled.details} ayrıntı (alerjen/kalori/süre/rozet)`,
            filled.addedProducts && `${filled.addedProducts} yeni ürün`,
          ].filter(Boolean);
          notes.push(
            parts.length
              ? `${read.host}${viaLabel(read)}: kaynaktan ${parts.join(", ")} dolduruldu.`
              : `${read.host}${viaLabel(read)}: kaynakta taslağa eklenecek yeni bilgi bulunamadı.`
          );
          if (read.dropped > 0) notes.push(droppedNote(read.dropped));
        }
        // Model işin tamamını kaynağa bıraktıysa ("fiyatları al ve açıklama
        // ekle"), kaynağın KAPSAMADIĞI kısım (açıklama yazma, ayrıntı önerme)
        // için ikinci tur: model artık kaynağın ne getirdiğini görür.
        if (reread && answer.ops.length === 0) {
          const second = await ask(true);
          applyOps(second.ops);
          if (second.reply) reply = second.reply;
        }
      }
    }
  } catch (error) {
    console.error("[admin/menu-assistant] hata", error);
    return aiErrorResponse(error, "Asistan bu mesajı işleyemedi. Tekrar deneyin.");
  }

  const stats = draftStats(draft);
  if (!reply && notes.length === 0) reply = "Bir değişiklik yapmadım. Ne yapmamı istediğinizi biraz daha açık yazar mısınız?";
  if (stats.missingPrices > 0 && stats.missingPrices !== before.missingPrices) {
    notes.push(`${stats.missingPrices} ürünün fiyatı eksik; önizlemede sarı işaretli. Fiyatları yazın ya da bana söyleyin.`);
  }

  // AI kullanımının izi: kim, hangi kaynak, kaç token. Yanıttan sonra yazılır.
  const context = auditRequestContext(req);
  after(async () => {
    try {
      const service = await getServicePB();
      await recordAudit(service, {
        actor: { type: "admin", id: admin.id, email: admin.email },
        action: "ai.menu_assist",
        targetCollection: "ai",
        ip: context.ip,
        meta: { ...context.meta, label: businessName, model: ASSISTANT_MODEL, sources, ...usage, products: stats.products },
      });
    } catch (err) {
      console.error("[admin/menu-assistant] denetim kaydı yazılamadı", err);
    }
  });

  return NextResponse.json({ reply, notes, draft, stats });
}
