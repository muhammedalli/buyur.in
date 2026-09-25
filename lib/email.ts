// Brevo (transactional e-posta) istemcisi. Yalnızca sunucuda çalışır —
// BREVO_API_KEY hiçbir koşulda NEXT_PUBLIC_ ile tanımlanmaz.
//
// Şablonlar marka token'larının e-posta karşılığıdır: e-posta istemcileri CSS
// değişkeni ve harici font yüklemediği için renkler satır içi hex, yazı tipleri
// sistem yığınıdır. Değer değişirse app/globals.css ile elle eşitlenmeli.

import { ROOT_DOMAIN, menuHost } from "@/lib/site";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? `noreply@${ROOT_DOMAIN}`;
const SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "buyur";

// Marka renkleri (app/globals.css @theme karşılıkları)
const PAPER = "#fbf5ea";
const CREMA = "#f4ead9";
const INK = "#231812";
const INK_SOFT = "#6b5a4e";
const PAPRIKA = "#e8491f";
const LINE = "#e0d3bf";

const SITE_URL = `https://${ROOT_DOMAIN}`;
// Logo mutlak URL olmak zorunda: e-posta istemcisinde göreli yol çözülmez.
// wordmark-dark, açık zeminde kullanılan koyu mürekkep varyantıdır.
const LOGO_URL = `${SITE_URL}/assets/wordmark-dark.png`;
const LOGO_WIDTH = 104; // 468x200 oranında yükseklik ~44px

const FONT_BODY = "'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_MONO = "'Courier New',Courier,monospace";

/** Brevo anahtarı iki biçimde gelebilir: ham `xkeysib-...` ya da MCP panelinin
 *  verdiği base64 JSON sarmalı. İkincisini burada açıyoruz ki yanlış biçim
 *  yüzünden sessiz 401 almayalım. */
function readApiKey(): string | null {
  const raw = process.env.BREVO_API_KEY?.trim();
  if (!raw) return null;
  if (raw.startsWith("xkeysib-")) return raw;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (typeof decoded?.api_key === "string") return decoded.api_key;
  } catch {
    // base64/JSON değilse ham değeri olduğu gibi deneriz.
  }
  return raw;
}

export function isEmailConfigured(): boolean {
  return readApiKey() !== null;
}

interface SendArgs {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

async function send({ to, toName, subject, html, text }: SendArgs): Promise<void> {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("BREVO_API_KEY tanımlı değil.");

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [toName ? { email: to, name: toName } : { email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Kart içinde bölüm başlığı olarak kullanılan küçük mono etiket. */
function eyebrow(text: string): string {
  return `<div style="font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${PAPRIKA};">${escapeHtml(text)}</div>`;
}

/** Turuncu birincil buton — Outlook'ta da dolgusu kaybolmasın diye tablo hücresi. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td align="center" bgcolor="${PAPRIKA}" style="border-radius:10px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT_MONO};font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
  </td>
</tr></table>`;
}

interface ShellArgs {
  title: string;
  /** Gelen kutusunda konu satırının yanında görünen ön izleme metni. */
  preheader: string;
  body: string;
}

/** Tüm e-postaların ortak kabuğu: kâğıt zemin, logo, turuncu şeritli kart, alt bilgi. */
function shell({ title, preheader, body }: ShellArgs): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${escapeHtml(SITE_URL)}" style="text-decoration:none;">
            <img src="${escapeHtml(LOGO_URL)}" width="${LOGO_WIDTH}" alt="buyur" style="display:block;width:${LOGO_WIDTH}px;max-width:${LOGO_WIDTH}px;height:auto;border:0;outline:none;">
          </a>
        </td></tr>

        <tr><td style="background:${CREMA};border:1px solid ${LINE};border-radius:20px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="5" bgcolor="${PAPRIKA}" style="height:5px;line-height:5px;font-size:0;">&nbsp;</td></tr>
            <tr><td style="padding:32px;font-family:${FONT_BODY};color:${INK};">
${body}
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:24px 8px 0;font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${INK_SOFT};">
          <a href="${escapeHtml(SITE_URL)}" style="color:${INK_SOFT};text-decoration:none;font-weight:600;">buyur</a>
          &nbsp;·&nbsp; QR menü, tek bağlantıda.<br>
          Bu e-posta ${escapeHtml(ROOT_DOMAIN)} tarafından gönderildi.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Kayıt doğrulama kodu. */
export async function sendOtpEmail(to: string, name: string, code: string, ttlMinutes: number): Promise<void> {
  const greeting = name.trim() ? `Merhaba ${escapeHtml(name.trim())},` : "Merhaba,";
  const html = shell({
    title: "buyur doğrulama kodun",
    preheader: `Kodun ${code} — ${ttlMinutes} dakika geçerli.`,
    body: `${eyebrow("Hesap doğrulama")}
<h1 style="margin:10px 0 12px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${INK};">Doğrulama kodun</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${INK_SOFT};">${greeting} hesabını açmak için aşağıdaki kodu kayıt ekranına gir.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="background:${PAPER};border:1px solid ${LINE};border-radius:16px;padding:22px 12px;">
    <span style="font-family:${FONT_MONO};font-size:34px;font-weight:700;letter-spacing:10px;color:${INK};">${escapeHtml(code)}</span>
  </td></tr>
</table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:${INK_SOFT};">Kod <strong style="color:${INK};">${ttlMinutes} dakika</strong> geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin — hesabın güvende.</p>`,
  });

  await send({
    to,
    toName: name || undefined,
    subject: `buyur doğrulama kodun: ${code}`,
    html,
    text: `Doğrulama kodun: ${code}\nKod ${ttlMinutes} dakika geçerli.\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
  });
}

/** Şifre sıfırlama bağlantısı. Bağlantının tabanı yapılandırılmış alan
 *  adıdır (SITE_URL) — isteğin Host başlığı kullanılmaz. */
export async function sendPasswordResetEmail(to: string, name: string, url: string, ttlMinutes: number): Promise<void> {
  const greeting = name.trim() ? `Merhaba ${escapeHtml(name.trim())},` : "Merhaba,";
  const html = shell({
    title: "buyur şifre sıfırlama",
    preheader: `Yeni şifreni belirlemek için bağlantı — ${ttlMinutes} dakika geçerli.`,
    body: `${eyebrow("Şifre sıfırlama")}
<h1 style="margin:10px 0 12px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${INK};">Yeni şifreni belirle</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${INK_SOFT};">${greeting} buyur hesabın için şifre sıfırlama isteği aldık. Aşağıdaki düğmeyle yeni şifreni belirleyebilirsin.</p>
${button(url, "Şifremi sıfırla")}
<p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:${INK_SOFT};">Bağlantı <strong style="color:${INK};">${ttlMinutes} dakika</strong> geçerli ve yalnızca bir kez kullanılabilir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin — şifren değişmez.</p>
<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${INK_SOFT};word-break:break-all;">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br><a href="${escapeHtml(url)}" style="color:${PAPRIKA};">${escapeHtml(url)}</a></p>`,
  });

  await send({
    to,
    toName: name || undefined,
    subject: "buyur şifre sıfırlama bağlantın",
    html,
    text: `Şifreni sıfırlamak için bu bağlantıyı aç (${ttlMinutes} dakika geçerli, tek kullanımlık):\n${url}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.`,
  });
}

/** Sıfırlama bağlantılarının tabanı. */
export const PASSWORD_RESET_SITE_URL = SITE_URL;

interface WelcomeArgs {
  businessName: string;
  slug: string;
}

/** Karşılama mailindeki numaralı adım satırı. */
function step(index: number, title: string, detail: string): string {
  return `<tr>
  <td width="32" valign="top" style="padding:0 12px 16px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="28" height="28" align="center" valign="middle" bgcolor="${PAPER}" style="width:28px;height:28px;border:1px solid ${LINE};border-radius:14px;font-family:${FONT_MONO};font-size:13px;font-weight:700;color:${PAPRIKA};">${index}</td>
    </tr></table>
  </td>
  <td valign="top" style="padding:0 0 16px;font-family:${FONT_BODY};">
    <div style="font-size:15px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(title)}</div>
    <div style="font-size:13px;line-height:1.6;color:${INK_SOFT};margin-top:2px;">${escapeHtml(detail)}</div>
  </td>
</tr>`;
}

/** İşletme kurulduktan sonraki karşılama maili. */
export async function sendWelcomeEmail(to: string, { businessName, slug }: WelcomeArgs): Promise<void> {
  const url = `https://${menuHost(slug)}`;
  // Hesap işletmenin kendisi: selamlama işletme adıyla (ayrı kişi adı tutulmuyor).
  const greeting = businessName.trim() ? `Merhaba ${escapeHtml(businessName.trim())},` : "Merhaba,";
  const html = shell({
    title: `Aramıza hoş geldin, ${businessName}!`,
    preheader: `Dijital menün yayında: ${menuHost(slug)}`,
    body: `${eyebrow("Hoş geldin")}
<h1 style="margin:10px 0 12px;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${INK};">Aramıza hoş geldin, ${escapeHtml(businessName)}!</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${INK_SOFT};">${greeting} dijital menün yayında. QR kodunu masalara koyduğun an müşterilerin menünü telefonlarından görebilir.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
  <tr><td style="background:${PAPER};border:1px solid ${LINE};border-radius:16px;padding:18px 20px;">
    <div style="font-family:${FONT_MONO};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px;">Menü adresin</div>
    <a href="${escapeHtml(url)}" style="font-family:${FONT_BODY};font-size:17px;font-weight:700;color:${PAPRIKA};text-decoration:none;">${escapeHtml(menuHost(slug))}</a>
  </td></tr>
</table>

${eyebrow("Sıradaki üç adım")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 24px;">
${step(1, "Ürünlerini ekle", "Kategoriler, fiyatlar ve görseller — ya da fiziksel menünü yapay zekâya taratıp hazır başla.")}
${step(2, "Markanı ayarla", "Logonu yükle, marka rengini seç; menü senin gibi görünsün.")}
${step(3, "QR kodunu bas", "Panelden indir, masalara yerleştir; ilk taramaları anında raporlarda gör.")}
</table>

${button(`${SITE_URL}/panel`, "Panele git")}

<p style="margin:26px 0 0;font-size:13px;line-height:1.7;color:${INK_SOFT};">Takıldığın bir yer olursa bu e-postayı yanıtlaman yeterli — gerçekten okuyoruz.</p>`,
  });

  await send({
    to,
    toName: businessName || undefined,
    subject: `Aramıza hoş geldin, ${businessName}!`,
    html,
    text: `Aramıza hoş geldin, ${businessName}!\n\nDijital menün yayında: ${url}\n\nSıradaki adımlar:\n1. Ürünlerini ve fiyatlarını ekle\n2. Logonu ve marka rengini ayarla\n3. QR kodunu indirip masalara yerleştir\n\nPanel: ${SITE_URL}/panel`,
  });
}
