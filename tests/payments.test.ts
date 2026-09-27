import { describe, expect, it } from "vitest";
import {
  AMOUNT_MAX,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  dayToRecordDate,
  filterPayments,
  formatAmount,
  isValidDay,
  parseAmount,
  parsePaymentQuery,
  paymentListHref,
  paymentsOverview,
  sortPayments,
  summarizePayments,
  validatePaymentInput,
} from "@/lib/payments";
import { PAYMENT_METHOD_VALUES, PAYMENT_STATUS_VALUES, PAYMENT_TYPE_VALUES } from "@/scripts/payments-schema.mjs";
import type { Payment } from "@/lib/types";

// Ödemeler (cari hesap) sözleşmesi. Korunan kurallar: tutarlar kuruş
// cinsinden tamsayıdır, bakiye kayıtlardan hesaplanır ve yalnızca tamamlanan
// kayıtlar bakiyeye girer. Kural değişiyorsa önce bu test değişir.

const BUSINESS_A = "aaaaaaaaaaaaaaa";
const BUSINESS_B = "bbbbbbbbbbbbbbb";

let seq = 0;
function payment(partial: Partial<Payment> & Pick<Payment, "type" | "amount">): Payment {
  seq += 1;
  return {
    id: `p${String(seq).padStart(14, "0")}`,
    business: BUSINESS_A,
    date: dayToRecordDate("2026-09-10"),
    status: "completed",
    method: "",
    note: "",
    created: `2026-09-10 10:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    updated: "",
    ...partial,
  };
}

describe("tutar ayrıştırma", () => {
  it("Türkçe yazımı kuruşa çevirir", () => {
    expect(parseAmount("1.250,50")).toBe(125050);
    expect(parseAmount("1250,5")).toBe(125050);
    expect(parseAmount("1250.50")).toBe(125050);
    expect(parseAmount("1.250")).toBe(125000);
    expect(parseAmount("2.500.000")).toBe(250_000_000);
    expect(parseAmount("₺ 90")).toBe(9000);
    expect(parseAmount("0,01")).toBe(1);
    expect(parseAmount(249.9)).toBe(24990);
  });

  it("belirsiz, sıfır, negatif ve sınır üstü tutarı reddeder", () => {
    for (const bad of ["", "abc", "0", "0,00", "-5", "1,2,3", "12,345", "1.5.0", "1e5", "10.000.001", null, undefined, {}]) {
      expect(parseAmount(bad), String(bad)).toBeNull();
    }
    // Üst sınır 10 milyon ₺: fazladan yazılmış bir sıfır raporu bozmasın.
    expect(parseAmount("10.000.000")).toBe(AMOUNT_MAX);
    expect(parseAmount("12.500.000")).toBeNull();
  });

  it("kuruşu Türkçe para biçiminde gösterir", () => {
    expect(formatAmount(125050).replace(/\s/g, " ")).toBe("1.250,50 ₺");
    expect(formatAmount(-500).replace(/\s/g, " ")).toBe("−5,00 ₺");
  });
});

describe("kayıt doğrulama", () => {
  const valid = { business: BUSINESS_A, type: "incoming", amount: "1.000", date: "2026-09-27", method: "cash", status: "completed", note: " dekont 12 " };

  it("geçerli kaydı yazılacak biçime çevirir", () => {
    const result = validatePaymentInput(valid);
    expect(result).toEqual({
      ok: true,
      data: { business: BUSINESS_A, type: "incoming", amount: 100000, date: "2026-09-27", method: "cash", status: "completed", note: "dekont 12" },
    });
  });

  it("eksik ya da geçersiz alanı Türkçe hatayla reddeder", () => {
    expect(validatePaymentInput({ ...valid, business: "" })).toEqual({ ok: false, error: "İşletme seçin." });
    expect(validatePaymentInput({ ...valid, type: "refund" }).ok).toBe(false);
    expect(validatePaymentInput({ ...valid, amount: "0" }).ok).toBe(false);
    expect(validatePaymentInput({ ...valid, date: "2026-02-30" }).ok).toBe(false);
    expect(validatePaymentInput({ ...valid, method: "bitcoin" }).ok).toBe(false);
    expect(validatePaymentInput({ ...valid, status: "done" }).ok).toBe(false);
    expect(validatePaymentInput({ ...valid, note: "x".repeat(501) }).ok).toBe(false);
  });

  it("yöntem boş bırakılabilir (borç kaydında yöntem yoktur)", () => {
    const result = validatePaymentInput({ ...valid, type: "charge", method: "" });
    expect(result.ok && result.data.method).toBe("");
  });

  it("tarih takvim günü olarak saklanır; saat dilimi günü kaydırmaz", () => {
    expect(isValidDay("2026-09-27")).toBe(true);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(dayToRecordDate("2026-09-27")).toBe("2026-09-27 12:00:00.000Z");
  });
});

describe("bakiye", () => {
  it("kalan borç = toplam borç − (alınan − verilen)", () => {
    const summary = summarizePayments([
      payment({ type: "charge", amount: 100000 }),
      payment({ type: "incoming", amount: 60000 }),
      payment({ type: "outgoing", amount: 10000 }),
    ]);
    expect(summary).toMatchObject({ totalDebt: 100000, totalReceived: 60000, totalPaidOut: 10000, totalPaid: 50000, balance: 50000 });
  });

  it("ödeme eklenince kalan borç kendiliğinden düşer", () => {
    const records = [payment({ type: "charge", amount: 74900 })];
    expect(summarizePayments(records).balance).toBe(74900);
    records.push(payment({ type: "incoming", amount: 50000 }));
    expect(summarizePayments(records).balance).toBe(24900);
    records.push(payment({ type: "incoming", amount: 24900 }));
    expect(summarizePayments(records).balance).toBe(0);
  });

  it("yalnızca tamamlanan kayıtlar bakiyeye girer; bekleyenler ayrı, iptaller hiçbir yerde", () => {
    const summary = summarizePayments([
      payment({ type: "charge", amount: 100000 }),
      payment({ type: "charge", amount: 5000, status: "pending" }),
      payment({ type: "incoming", amount: 30000, status: "pending" }),
      payment({ type: "outgoing", amount: 2000, status: "pending" }),
      payment({ type: "incoming", amount: 99999, status: "cancelled" }),
    ]);
    expect(summary).toMatchObject({ totalDebt: 100000, totalReceived: 0, balance: 100000, pendingDebt: 5000, pendingIncoming: 30000, pendingOutgoing: 2000, count: 4 });
  });

  it("fazla ödemede bakiye negatiftir (işletme alacaklı); iade onu sıfırlar", () => {
    const records = [payment({ type: "charge", amount: 1000 }), payment({ type: "incoming", amount: 1500 })];
    expect(summarizePayments(records).balance).toBe(-500);
    records.push(payment({ type: "outgoing", amount: 500 }));
    expect(summarizePayments(records).balance).toBe(0);
  });

  it("son ödeme tarihi en yeni tamamlanan alınan ödemedir", () => {
    const summary = summarizePayments([
      payment({ type: "incoming", amount: 100, date: dayToRecordDate("2026-08-01") }),
      payment({ type: "incoming", amount: 100, date: dayToRecordDate("2026-09-15") }),
      payment({ type: "incoming", amount: 100, date: dayToRecordDate("2026-09-20"), status: "pending" }),
      payment({ type: "outgoing", amount: 100, date: dayToRecordDate("2026-09-25") }),
    ]);
    expect(summary.lastPaymentDay).toBe("2026-09-15");
    expect(summarizePayments([]).lastPaymentDay).toBeNull();
  });

  it("toplamlar kuruşu kuruşuna tutar (kayan nokta hatası yok)", () => {
    const records = Array.from({ length: 10 }, () => payment({ type: "incoming", amount: parseAmount("0,10")! }));
    expect(summarizePayments(records).totalReceived).toBe(100);
  });
});

describe("genel özet", () => {
  const now = new Date("2026-09-27T09:00:00Z");
  const records = [
    payment({ type: "charge", amount: 100000, business: BUSINESS_A }),
    payment({ type: "incoming", amount: 40000, business: BUSINESS_A, date: dayToRecordDate("2026-09-01") }),
    payment({ type: "charge", amount: 20000, business: BUSINESS_B }),
    payment({ type: "incoming", amount: 30000, business: BUSINESS_B, date: dayToRecordDate("2026-08-31") }),
    payment({ type: "outgoing", amount: 5000, business: BUSINESS_B, date: dayToRecordDate("2026-09-30") }),
    payment({ type: "incoming", amount: 7000, business: BUSINESS_B, status: "pending" }),
  ];

  it("toplam borç yalnızca borcu kalan işletmeleri toplar; alacaklı işletme borcu düşürmez", () => {
    const overview = paymentsOverview(records, now);
    // A: 100000 − 40000 = 60000 borç; B: 20000 − (30000 − 5000) = −5000 alacaklı.
    expect(overview.totalOutstanding).toBe(60000);
    expect(overview.debtorCount).toBe(1);
    expect(overview.totalReceived).toBe(70000);
    expect(overview.totalPaidOut).toBe(5000);
    expect(overview.totalPending).toBe(7000);
  });

  it("bu ay İstanbul takvimine göredir", () => {
    const overview = paymentsOverview(records, now);
    expect(overview.monthReceived).toBe(40000);
    expect(overview.monthPaidOut).toBe(5000);
  });
});

describe("liste filtreleri", () => {
  const records = sortPayments([
    payment({ type: "incoming", amount: 1, date: dayToRecordDate("2026-09-01") }),
    payment({ type: "charge", amount: 2, date: dayToRecordDate("2026-09-20"), business: BUSINESS_B }),
    payment({ type: "incoming", amount: 3, date: dayToRecordDate("2026-10-02"), status: "pending" }),
  ]);

  it("yeni kayıt önce sıralanır", () => {
    expect(records.map((r) => r.amount)).toEqual([3, 2, 1]);
  });

  it("işletme, tip, durum ve tarih aralığıyla süzer (uçlar dahil)", () => {
    const query = parsePaymentQuery({ tip: "incoming", baslangic: "2026-09-01", bitis: "2026-09-30" });
    expect(filterPayments(records, query).map((r) => r.amount)).toEqual([1]);
    expect(filterPayments(records, parsePaymentQuery({ isletme: BUSINESS_B })).map((r) => r.amount)).toEqual([2]);
    expect(filterPayments(records, parsePaymentQuery({ durum: "pending" })).map((r) => r.amount)).toEqual([3]);
  });

  it("geçersiz filtre değerini yok sayar ve bağlantıyı geri kurar", () => {
    const query = parsePaymentQuery({ tip: "x", durum: "y", baslangic: "dün", isletme: "../", sayfa: "-2" });
    expect(query).toEqual({ business: "", type: "", status: "", from: "", to: "", page: 1 });
    const full = parsePaymentQuery({ isletme: BUSINESS_A, tip: "charge", durum: "completed", baslangic: "2026-09-01", bitis: "2026-09-30", sayfa: "2" });
    expect(parsePaymentQuery(Object.fromEntries(new URL(paymentListHref(full), "https://x").searchParams))).toEqual(full);
  });
});

describe("şema ile uygulama aynı sözlüğü konuşur", () => {
  it("tür, durum ve yöntem değerleri scripts/payments-schema.mjs ile birebir aynı", () => {
    expect([...PAYMENT_TYPES]).toEqual(PAYMENT_TYPE_VALUES);
    expect([...PAYMENT_STATUSES]).toEqual(PAYMENT_STATUS_VALUES);
    expect([...PAYMENT_METHODS]).toEqual(PAYMENT_METHOD_VALUES);
  });
});
