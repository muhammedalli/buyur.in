import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTION_LABELS, AUDITED_COLLECTIONS } from "@/lib/audit-log";

// PocketBase hook'unun (pocketbase/pb_hooks) Next.js tarafıyla sözleşmesi:
// izlenen koleksiyonlar aynı, ürettiği her eylemin ekranda bir etiketi var,
// değişiklik farkı yalnızca değişen alanları taşır. Hook'un gerçek
// PocketBase'deki davranışı (transaction, giriş kaydı, token düşürme) yerel
// PocketBase v0.39.4 ile doğrulandı; bkz. docs/audit-log.md → Doğrulama.

const hooksDir = path.resolve(__dirname, "../pocketbase/pb_hooks");
const require = createRequire(import.meta.url);
const hook = require(path.join(hooksDir, "buyur_audit.js")) as {
  RESOURCES: Record<string, string>;
  diff: (before: Record<string, unknown> | null, after: Record<string, unknown> | null) => {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    changed: string[];
  };
};
const registration = readFileSync(path.join(hooksDir, "buyur_audit.pb.js"), "utf8");

describe("denetim kaydı hook'u", () => {
  it("izlenen koleksiyonlar lib/audit-log.ts ile aynı", () => {
    expect(Object.keys(hook.RESOURCES).sort()).toEqual([...AUDITED_COLLECTIONS].sort());
    // Her yazma türü (oluşturma, güncelleme, silme) aynı listeyle kayıtlı.
    for (const kind of ["onRecordCreateRequest", "onRecordUpdateRequest", "onRecordDeleteRequest"]) {
      // Kayıt bloğu satır başındaki ");" ile kapanır (handler içindekiyle karışmasın).
      const block = registration.split(`\n${kind}(`)[1]?.split("\n);")[0] ?? "";
      for (const collection of AUDITED_COLLECTIONS) expect(block, `${kind} → ${collection}`).toContain(`"${collection}"`);
    }
  });

  it("ürettiği her eylemin ekranda Türkçe etiketi var", () => {
    const actions = new Set<string>(["business.login", "business.login_failed", "business.password_change", "product.price_change"]);
    for (const resource of Object.values(hook.RESOURCES)) {
      for (const op of ["create", "update", "delete"]) actions.add(`${resource}.${op}`);
    }
    for (const action of actions) expect(AUDIT_ACTION_LABELS[action], action).toBeTruthy();
  });

  it("fark yalnızca değişen alanları taşır; boş değerler eşit sayılır", () => {
    const result = hook.diff(
      { id: "p1", name: "Kahve", price: 80, allergens: [], campaign_label: "", category: "c1" },
      { id: "p1", name: "Kahve", price: 95, allergens: null, campaign_label: "", category: "c2" }
    );
    expect(result.changed.sort()).toEqual(["category", "price"]);
    expect(result.before).toEqual({ price: 80, category: "c1" });
    expect(result.after).toEqual({ price: 95, category: "c2" });
  });

  it("büyük değerler kırpılır (kayıt satırı şişmesin)", () => {
    const long = "x".repeat(5000);
    const result = hook.diff({ description: "" }, { description: long });
    expect(String(result.after.description).length).toBeLessThanOrEqual(4001);
  });
});
