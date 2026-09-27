// Ödemeler (cari hesap) — yönetim panelinin para kaydı. Saf katman: tutar
// ayrıştırma, doğrulama, bakiye hesabı ve liste filtreleri. Ağ yok; hem sunucu
// hem istemci bileşeni kullanır. Sözleşmesi tests/payments.test.ts, ayrıntısı
// docs/payments.md.
//
// Model: her kayıt bir cari hareketidir.
//   charge   (Borç kaydı)    → işletmenin borcunu artırır
//   incoming (Alınan ödeme)  → işletmeden gelen para, borcu azaltır
//   outgoing (Verilen ödeme) → işletmeye giden para (iade vb.), borcu geri artırır
// Kalan borç = toplam borç − (alınan − verilen). Negatifse işletme alacaklıdır.
//
// Bakiye SAKLANMAZ, her okumada kayıtlardan hesaplanır: bir kayıt eklenince,
// düzenlenince ya da silinince kalan borç kendiliğinden doğru olur; ayrı bir
// sayaç kayıtlarla çelişemez. Yalnızca "tamamlandı" kayıtlar bakiyeye girer;
// "bekliyor" kayıtlar ayrıca toplanır, "iptal" kayıtlar hiçbir toplama girmez.
//
// Tutarlar kuruş cinsinden tamsayıdır (1.250,50 ₺ = 125050): toplamlar
// kayan nokta hatası taşımaz.

import type { Payment, PaymentMethod, PaymentStatus, PaymentType } from "@/lib/types";

export type { Payment, PaymentMethod, PaymentStatus, PaymentType };

export const PAYMENTS_COLLECTION = "buyur_payments";

export const PAYMENT_TYPES: readonly PaymentType[] = ["charge", "incoming", "outgoing"];
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["completed", "pending", "cancelled"];
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["bank_transfer", "credit_card", "cash", "online", "other"];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  charge: "Borç kaydı",
  incoming: "Alınan ödeme",
  outgoing: "Verilen ödeme",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  completed: "Tamamlandı",
  pending: "Bekliyor",
  cancelled: "İptal",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Havale / EFT",
  credit_card: "Kredi kartı",
  cash: "Nakit",
  online: "Online ödeme",
  other: "Diğer",
};

export const NOTE_MAX = 500;
/** Tek kayıtta kabul edilen en büyük tutar (kuruş): 10 milyon ₺. Yazım hatasıyla
 *  eklenen bir sıfırın bütün raporu bozmaması için. */
export const AMOUNT_MAX = 1_000_000_000;

export const isPaymentType = (value: unknown): value is PaymentType => PAYMENT_TYPES.includes(value as PaymentType);
export const isPaymentStatus = (value: unknown): value is PaymentStatus => PAYMENT_STATUSES.includes(value as PaymentStatus);
export const isPaymentMethod = (value: unknown): value is PaymentMethod => PAYMENT_METHODS.includes(value as PaymentMethod);

/** Kullanıcının yazdığı tutarı kuruşa çevirir. Türkçe yazım esastır:
 *  "1.250,50" · "1250,5" · "1250.50" · "1.250" (binlik) · "₺ 90". Geçersiz,
 *  sıfır, negatif, ikiden fazla ondalık ya da sınır üstü tutar null döner. */
export function parseAmount(input: unknown): number | null {
  let text: string;
  if (typeof input === "number") text = String(input);
  else if (typeof input === "string") text = input;
  else return null;

  text = text.replace(/\s|₺|tl/gi, "");
  if (text === "" || !/^[\d.,]+$/.test(text)) return null;

  if (text.includes(",")) {
    // Virgül ondalıktır; noktalar binlik ayırıcı.
    if (text.indexOf(",") !== text.lastIndexOf(",")) return null;
    const [whole, fraction] = text.split(",");
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(whole)) return null;
    text = `${whole.replace(/\./g, "")}.${fraction}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.250" ya da "12.500.000": yalnızca binlik ayırıcı.
    text = text.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [lira, kurus = ""] = text.split(".");
  const value = Number(lira) * 100 + Number(kurus.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value <= 0 || value > AMOUNT_MAX) return null;
  return value;
}

const TL = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 125050 → "1.250,50 ₺". */
export function formatAmount(kurus: number): string {
  const sign = kurus < 0 ? "−" : "";
  return `${sign}${TL.format(Math.abs(kurus) / 100)} ₺`;
}

/** Form alanı için: 125050 → "1250,50". */
export function amountInputValue(kurus: number): string {
  return (kurus / 100).toFixed(2).replace(".", ",");
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" geçerli bir takvim günü mü? */
export function isValidDay(day: unknown): day is string {
  if (typeof day !== "string" || !DAY_PATTERN.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

/** Gün → PocketBase tarih değeri. Öğlen UTC: hangi saat diliminde okunursa
 *  okunsun aynı gün görünür. */
export function dayToRecordDate(day: string): string {
  return `${day} 12:00:00.000Z`;
}

/** Kaydın günü ("YYYY-MM-DD"). */
export function paymentDay(payment: Pick<Payment, "date">): string {
  return (payment.date ?? "").slice(0, 10);
}

/** Bugün (İstanbul) "YYYY-MM-DD". */
export function todayIstanbul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

/** "2026-09-27" → "27.09.2026". */
export function formatDay(day: string): string {
  if (!isValidDay(day)) return "";
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

export interface PaymentInput {
  business: string;
  type: PaymentType;
  amount: number;
  date: string;
  method: PaymentMethod | "";
  status: PaymentStatus;
  note: string;
}

export type PaymentInputResult = { ok: true; data: PaymentInput } | { ok: false; error: string };

/** İstekten gelen kaydı doğrular ve PocketBase'e yazılacak biçime çevirir.
 *  Hata mesajı yöneticiye olduğu gibi gösterilir. */
export function validatePaymentInput(raw: unknown): PaymentInputResult {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const business = typeof body.business === "string" ? body.business.trim() : "";
  if (!/^[a-z0-9]{15}$/.test(business)) return { ok: false, error: "İşletme seçin." };
  if (!isPaymentType(body.type)) return { ok: false, error: "İşlem tipini seçin." };
  const amount = parseAmount(body.amount);
  if (amount === null) return { ok: false, error: "Geçerli bir tutar yazın (ör. 1.250,00)." };
  if (!isValidDay(body.date)) return { ok: false, error: "Geçerli bir tarih seçin." };
  const method = body.method === "" || body.method === undefined || body.method === null ? "" : body.method;
  if (method !== "" && !isPaymentMethod(method)) return { ok: false, error: "Ödeme yöntemi geçersiz." };
  if (!isPaymentStatus(body.status)) return { ok: false, error: "Durumu seçin." };
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > NOTE_MAX) return { ok: false, error: `Açıklama en fazla ${NOTE_MAX} karakter olabilir.` };
  return {
    ok: true,
    data: { business, type: body.type, amount, date: body.date, method, status: body.status, note },
  };
}

/** Doğrulanmış girdiyi kayıt alanlarına çevirir. */
export function toPaymentRecord(input: PaymentInput): Record<string, unknown> {
  return { ...input, date: dayToRecordDate(input.date) };
}

export interface PaymentSummary {
  /** Tamamlanmış borç kayıtları. */
  totalDebt: number;
  /** Tamamlanmış alınan ödemeler. */
  totalReceived: number;
  /** Tamamlanmış verilen ödemeler. */
  totalPaidOut: number;
  /** Net ödenen = alınan − verilen. */
  totalPaid: number;
  /** Kalan borç = toplam borç − net ödenen. Negatifse işletme alacaklıdır. */
  balance: number;
  pendingDebt: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  /** Son tamamlanmış alınan ödemenin günü. */
  lastPaymentDay: string | null;
  count: number;
}

export function summarizePayments(payments: readonly Pick<Payment, "type" | "amount" | "status" | "date">[]): PaymentSummary {
  const summary: PaymentSummary = {
    totalDebt: 0,
    totalReceived: 0,
    totalPaidOut: 0,
    totalPaid: 0,
    balance: 0,
    pendingDebt: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
    lastPaymentDay: null,
    count: 0,
  };
  for (const payment of payments) {
    const amount = Number.isSafeInteger(payment.amount) && payment.amount > 0 ? payment.amount : 0;
    if (payment.status === "cancelled" || amount === 0) continue;
    summary.count += 1;
    if (payment.status === "pending") {
      if (payment.type === "charge") summary.pendingDebt += amount;
      else if (payment.type === "incoming") summary.pendingIncoming += amount;
      else if (payment.type === "outgoing") summary.pendingOutgoing += amount;
      continue;
    }
    if (payment.status !== "completed") continue;
    if (payment.type === "charge") summary.totalDebt += amount;
    else if (payment.type === "incoming") {
      summary.totalReceived += amount;
      const day = paymentDay(payment);
      if (isValidDay(day) && (summary.lastPaymentDay === null || day > summary.lastPaymentDay)) summary.lastPaymentDay = day;
    } else if (payment.type === "outgoing") summary.totalPaidOut += amount;
  }
  summary.totalPaid = summary.totalReceived - summary.totalPaidOut;
  summary.balance = summary.totalDebt - summary.totalPaid;
  return summary;
}

export interface PaymentsOverview {
  totalReceived: number;
  totalPaidOut: number;
  /** Tahsil edilmeyi bekleyen (bekleyen alınan ödemeler). */
  totalPending: number;
  /** İşletmelerin kalan borçlarının toplamı (alacaklı işletmeler düşülmez). */
  totalOutstanding: number;
  /** Borcu kalan işletme sayısı. */
  debtorCount: number;
  monthReceived: number;
  monthPaidOut: number;
}

/** Genel Ödemeler ekranının özeti. "Bu ay" İstanbul takvimine göredir. */
export function paymentsOverview(payments: readonly Payment[], now: Date = new Date()): PaymentsOverview {
  const month = todayIstanbul(now).slice(0, 7);
  const all = summarizePayments(payments);
  const thisMonth = summarizePayments(payments.filter((payment) => paymentDay(payment).startsWith(month)));
  const byBusiness = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = byBusiness.get(payment.business) ?? [];
    list.push(payment);
    byBusiness.set(payment.business, list);
  }
  let totalOutstanding = 0;
  let debtorCount = 0;
  for (const list of byBusiness.values()) {
    const { balance } = summarizePayments(list);
    if (balance > 0) {
      totalOutstanding += balance;
      debtorCount += 1;
    }
  }
  return {
    totalReceived: all.totalReceived,
    totalPaidOut: all.totalPaidOut,
    totalPending: all.pendingIncoming,
    totalOutstanding,
    debtorCount,
    monthReceived: thisMonth.totalReceived,
    monthPaidOut: thisMonth.totalPaidOut,
  };
}

// ─── Liste filtreleri (adres çubuğunda durur: bağlantı paylaşılabilir) ───

export interface PaymentQuery {
  business: string;
  type: PaymentType | "";
  status: PaymentStatus | "";
  from: string;
  to: string;
  page: number;
}

export const PAYMENTS_PAGE_SIZE = 50;

export function parsePaymentQuery(params: Record<string, string | string[] | undefined>): PaymentQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const business = one("isletme");
  const type = one("tip");
  const status = one("durum");
  const from = one("baslangic");
  const to = one("bitis");
  const page = Number.parseInt(one("sayfa"), 10);
  return {
    business: /^[a-z0-9]{15}$/.test(business) ? business : "",
    type: isPaymentType(type) ? type : "",
    status: isPaymentStatus(status) ? status : "",
    from: isValidDay(from) ? from : "",
    to: isValidDay(to) ? to : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function isFilteredQuery(query: PaymentQuery): boolean {
  return Boolean(query.business || query.type || query.status || query.from || query.to);
}

export function filterPayments<T extends Payment>(payments: readonly T[], query: PaymentQuery): T[] {
  return payments.filter((payment) => {
    const day = paymentDay(payment);
    if (query.business && payment.business !== query.business) return false;
    if (query.type && payment.type !== query.type) return false;
    if (query.status && payment.status !== query.status) return false;
    if (query.from && day < query.from) return false;
    if (query.to && day > query.to) return false;
    return true;
  });
}

/** Yeni önce: gün, sonra kayıt zamanı. */
export function sortPayments<T extends Payment>(payments: readonly T[]): T[] {
  return [...payments].sort((a, b) => paymentDay(b).localeCompare(paymentDay(a)) || (b.created ?? "").localeCompare(a.created ?? ""));
}

export function paymentListHref(query: PaymentQuery, overrides: Partial<PaymentQuery> = {}): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.business) params.set("isletme", next.business);
  if (next.type) params.set("tip", next.type);
  if (next.status) params.set("durum", next.status);
  if (next.from) params.set("baslangic", next.from);
  if (next.to) params.set("bitis", next.to);
  if (next.page > 1) params.set("sayfa", String(next.page));
  const search = params.toString();
  return search ? `/admin/payments?${search}` : "/admin/payments";
}
