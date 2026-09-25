import { describe, expect, it } from "vitest";
import type PocketBase from "pocketbase";
import { clearOtpRecords, findOtpRecord, type OtpRecord } from "@/lib/otp-store";

// Aynı e-postanın kayıt kodu, şifre sıfırlama kaydı ve admin giriş kodu aynı
// koleksiyonda durur; biri diğerinin yerine geçmemeli ya da onu silmemeli
// (işletme sahibi ile yönetici aynı adresi kullanabilir).
function fakePB(records: OtpRecord[]) {
  const table = [...records];
  const pb = {
    filter: (expr: string, params: Record<string, unknown>) => `${expr}|${params.email}`,
    collection() {
      return {
        async getFullList(options: { filter: string }) {
          const email = options.filter.split("|")[1];
          return table.filter((r) => r.email === email).sort((a, b) => b.created.localeCompare(a.created));
        },
        async delete(id: string) {
          table.splice(table.findIndex((r) => r.id === id), 1);
          return true;
        },
      };
    },
  };
  return { pb: pb as unknown as PocketBase, table };
}

const base = { email: "ali@buyur.in", code_hash: "h", expires_at: "", attempts: 0 };

describe("OTP amaç ayrımı", () => {
  const records: OtpRecord[] = [
    { ...base, id: "reg", purpose: "", created: "2026-09-25 10:00:00Z" },
    { ...base, id: "adm", purpose: "admin_login", created: "2026-09-25 10:02:00Z" },
    { ...base, id: "rst", purpose: "password_reset", created: "2026-09-25 10:01:00Z" },
  ];

  it("her akış yalnızca kendi kaydını bulur", async () => {
    const { pb } = fakePB(records);
    expect((await findOtpRecord(pb, "ali@buyur.in"))?.id).toBe("reg");
    expect((await findOtpRecord(pb, "ali@buyur.in", "admin_login"))?.id).toBe("adm");
    expect((await findOtpRecord(pb, "ali@buyur.in", "password_reset"))?.id).toBe("rst");
  });

  it("bir akışın temizliği diğerlerinin kaydına dokunmaz", async () => {
    const { pb, table } = fakePB(records);
    await clearOtpRecords(pb, "ali@buyur.in", "admin_login");
    expect(table.map((r) => r.id).sort()).toEqual(["reg", "rst"]);
    await clearOtpRecords(pb, "ali@buyur.in");
    expect(table.map((r) => r.id)).toEqual(["rst"]);
  });
});
