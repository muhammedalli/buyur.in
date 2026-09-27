"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { AiActionButton, Button, Card, Input, Modal, Textarea } from "@/components/panel/ui";
import { useToast } from "@/components/panel/toast";
import { useConfirm } from "@/components/panel/confirm-dialog";
import { ArrowRightIcon, EyeIcon, FileTextIcon, ImageIcon, PlusIcon, SparklesIcon, TrashIcon, XIcon } from "@/components/icons";
import { draftStats, emptyDraft, type DraftCategory, type DraftProduct, type DraftStats, type MenuDraft } from "@/lib/ai/menu-assistant";
import type { StoredProductImage } from "@/lib/ai/image-source";
import { cn } from "@/lib/utils";

// Yönetim panelinin menü asistanı: sayfanın içinde duran sohbet + pencerede
// açılan düzenlenebilir önizleme. Taslak yalnızca tarayıcıda durur; kayda
// importDraftToBusiness ile, yönetici onay penceresinde onayladıktan sonra
// yazılır.
//
// Sohbet kaynağı ayırt etmez: menü bağlantısı, JSON, düz metin, fotoğraf/PDF
// ya da "fiyatlara %10 ekle" gibi bir komut aynı kutuya yazılır; sunucu
// (/api/admin/menu-assistant) hangisi olduğuna bakıp taslağı günceller.
//
// Durum (taslak, sohbet, görsel araması) useMenuSession'da tutulur; sohbet
// bileşeni yalnızca gösterir.

const MAX_FILES = 5;
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const IMAGE_CONCURRENCY = 3;
/** Mesaj kutusunun büyüyebileceği en fazla yükseklik (px); sonrası kayar. */
const COMPOSER_MAX_HEIGHT = 192;
/** Bu süreden yeni asistan yanıtı harf harf akar; eskiler (geri dönüşte) akmaz. */
const STREAM_WINDOW_MS = 15_000;

export interface ChatMessage {
  /** Oluşturulma anı (ms); liste anahtarı olarak da kullanılır. */
  id: number;
  role: "user" | "assistant";
  text: string;
  notes?: string[];
  files?: string[];
  error?: boolean;
  /** Bu yanıttan sonra taslağın durumu (önizleme kısayolu için). */
  stats?: DraftStats;
}

interface Attachment {
  name: string;
  dataUrl: string;
}

interface ImageProgress {
  done: number;
  total: number;
  found: number;
}

const JSON_EXAMPLE = `{
  "categories": [
    { "name": "Kahvaltı", "products": [
      { "name": "Serpme Kahvaltı", "description": "İki kişilik", "price": 650 },
      { "name": "Menemen", "price": 180 }
    ] }
  ]
}`;

const EDIT_SUGGESTIONS = [
  "Fiyatlara %10 ekle, 5'in katına yuvarla",
  "Açıklaması olmayan ürünlere kısa açıklama yaz",
  "İçecekler kategorisini en alta taşı",
  "Benzer kategorileri birleştir",
];

/** Yanıt beklenirken sırayla gösterilen durum cümleleri. */
const THINKING_STEPS = ["Mesajınızı okuyorum…", "Kaynağı açıyorum…", "Ürünleri ve fiyatları çıkarıyorum…", "Taslağı güncelliyorum…"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "İstek tamamlanamadı. Tekrar deneyin." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin." };
  }
}

export function statsLine(stats: DraftStats): string {
  if (stats.products === 0) return "Henüz ürün yok";
  return `${stats.categories} kategori · ${stats.products} ürün · ${stats.withImages} görselli${stats.missingPrices ? ` · ${stats.missingPrices} fiyat eksik` : ""}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toLocaleUpperCase("tr");
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ── Oturum durumu ───────────────────────────────────────────────────────

export interface MenuSession {
  draft: MenuDraft;
  setDraft: Dispatch<SetStateAction<MenuDraft>>;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  images: ImageProgress | null;
  findImages: () => Promise<void>;
  stopImages: () => void;
  reset: () => void;
}

export function useMenuSession(): MenuSession {
  const { toast } = useToast();
  const [draft, setDraft] = useState<MenuDraft>(emptyDraft);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [images, setImages] = useState<ImageProgress | null>(null);
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /** Görseli olmayan ürünlere sırayla (en fazla 3 istek aynı anda) görsel arar.
   *  Bulunamayan ürün boş kalır; yönetici istemediği görseli tek tıkla kaldırır. */
  async function findImages() {
    if (runningRef.current) return;
    const queue = draftRef.current.categories.flatMap((category) =>
      category.products.filter((product) => !product.image_url).map((product) => ({ categoryName: category.name, product }))
    );
    if (queue.length === 0) {
      toast("Bütün ürünlerin görseli var.");
      return;
    }
    runningRef.current = true;
    stopRef.current = false;
    let done = 0;
    let found = 0;
    let unconfigured = false;
    setImages({ done, total: queue.length, found });

    const worker = async () => {
      while (queue.length > 0 && !stopRef.current && !unconfigured) {
        const item = queue.shift()!;
        const result = await postJson<{ image: StoredProductImage | null; configured: boolean }>("/api/admin/menu-assistant/images", {
          name: item.product.name,
          category: item.categoryName,
        });
        done += 1;
        if (result.ok && result.data.configured === false) unconfigured = true;
        const image = result.ok ? result.data.image : null;
        if (image) {
          found += 1;
          // Arama sürerken yönetici düzenleme yapabilir: ürün kimliğiyle eşlenir
          // ve o arada elle görsel eklenmiş ürün ezilmez.
          setDraft((current) => ({
            ...current,
            categories: current.categories.map((category) => ({
              ...category,
              products: category.products.map((product) =>
                product.id === item.product.id && !product.image_url ? { ...product, image_url: image.url, image_source: image.source } : product
              ),
            })),
          }));
        }
        setImages({ done, total: done + queue.length, found });
      }
    };
    await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));
    runningRef.current = false;
    setImages(null);
    if (unconfigured) toast("Görsel sağlayıcısı yapılandırılmamış; görsel aranamadı.", "error");
    else toast(stopRef.current ? `Durduruldu: ${found} görsel bulundu.` : `${found} ürüne görsel bulundu, ${done - found} ürün görselsiz kaldı.`);
  }

  return {
    draft,
    setDraft,
    messages,
    setMessages,
    images,
    findImages,
    stopImages: () => (stopRef.current = true),
    reset: () => {
      setDraft(emptyDraft());
      setMessages([]);
    },
  };
}

// ── Aktarım ─────────────────────────────────────────────────────────────

export interface ImportSummary {
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Taslağı işletmenin menüsüne kategori kategori yazar. Sunucu her kategoride
 *  menünün güncel hâline bakar; aynı taslak ikinci kez gönderilirse yalnızca
 *  eksikler yazılır. Bir kategori düşerse diğerleri sürer, sonda özet döner. */
export async function importDraftToBusiness(
  businessId: string,
  draft: MenuDraft,
  publish: boolean,
  onProgress: (done: number, total: number) => void
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, skipped: 0, failed: 0, errors: [] };
  const total = draft.categories.length;
  for (const [index, category] of draft.categories.entries()) {
    onProgress(index, total);
    const result = await postJson<{ created: number; skipped: number; failed: number }>(`/api/admin/businesses/${businessId}/import`, {
      category,
      publish,
    });
    if (result.ok) {
      summary.created += result.data.created;
      summary.skipped += result.data.skipped;
      summary.failed += result.data.failed;
    } else {
      summary.failed += category.products.length;
      summary.errors.push(`${category.name}: ${result.error}`);
    }
  }
  onProgress(total, total);
  return summary;
}

// ── Sohbet parçaları ────────────────────────────────────────────────────

/** Asistanın simgesi: hafifçe süzülür; düşünürken çevresinde halka döner. */
export function AiAvatar({ thinking = false, size = "md" }: { thinking?: boolean; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14" : "h-8 w-8";
  return (
    <span className={cn("relative inline-flex shrink-0", box)} aria-hidden>
      {thinking && <span className="ai-orbit absolute -inset-1 rounded-full border-2 border-paprika/20 border-t-paprika" />}
      <span
        className={cn(
          "relative inline-flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-paprika to-paprika-deep text-paper shadow-sm",
          thinking && "ai-thinking"
        )}
      >
        <SparklesIcon size={size === "lg" ? 26 : 16} className="ai-float" />
      </span>
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper" aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

/** Asistan yanıtını ChatGPT gibi harf harf akıtır (en çok ~1,2 sn). Hareket
 *  azaltma açıksa, eski bir mesajsa ya da sekme arka plandaysa metin olduğu
 *  gibi görünür (arka planda zamanlayıcı kısılır, metin yarıda kalmasın). */
function StreamText({ text, animate, onTick, onDone }: { text: string; animate: boolean; onTick: () => void; onDone: () => void }) {
  const [shown, setShown] = useState(() => (animate && !prefersReducedMotion() ? 0 : text.length));
  const doneRef = useRef(shown >= text.length);

  useEffect(() => {
    if (shown >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    if (document.visibilityState === "hidden") {
      setShown(text.length);
      return;
    }
    const step = Math.max(2, Math.ceil(text.length / 70));
    const timer = setTimeout(() => {
      setShown((current) => Math.min(text.length, current + step));
      onTick();
    }, 16);
    return () => clearTimeout(timer);
  }, [shown, text, onTick, onDone]);

  const streaming = shown < text.length;
  return (
    <p className="whitespace-pre-wrap break-words">
      {text.slice(0, shown)}
      {streaming && <span className="stream-caret ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm bg-paprika" />}
    </p>
  );
}

function MessageRow({
  message,
  userName,
  onPreview,
  onTick,
}: {
  message: ChatMessage;
  userName: string;
  onPreview: () => void;
  onTick: () => void;
}) {
  const mine = message.role === "user";
  const animate = !mine && Date.now() - message.id < STREAM_WINDOW_MS;
  const [streamDone, setStreamDone] = useState(!animate || !message.text);
  const text = message.text.length > 1200 ? `${message.text.slice(0, 1200)}…` : message.text;

  return (
    <div className={cn("chat-in flex items-start gap-3", mine && "flex-row-reverse")}>
      {mine ? <UserAvatar name={userName} /> : <AiAvatar />}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1", mine ? "items-end" : "items-start")}>
        <span className="px-1 text-xs font-medium text-ink-soft">{mine ? "Siz" : "buyur asistanı"}</span>
        <div
          className={cn(
            "min-w-0 max-w-full rounded-md px-3.5 py-2.5 text-sm leading-relaxed",
            mine
              ? "bg-ink text-paper"
              : message.error
                ? "border border-paprika/40 bg-paprika/5 text-paprika-deep"
                : "border border-line bg-crema/60 text-ink shadow-xs"
          )}
        >
          {mine ? (
            text && <p className="whitespace-pre-wrap break-words">{text}</p>
          ) : (
            text && <StreamText text={text} animate={animate} onTick={onTick} onDone={() => setStreamDone(true)} />
          )}
          {message.files && message.files.length > 0 && (
            <p className={cn("mt-1 flex flex-wrap gap-x-3 text-xs", mine ? "text-paper/70" : "text-ink-soft")}>
              {message.files.map((name) => (
                <span key={name} className="inline-flex min-w-0 items-center gap-1">
                  <FileTextIcon size={12} className="shrink-0" />
                  <span className="truncate">{name}</span>
                </span>
              ))}
            </p>
          )}
          {streamDone && message.notes && message.notes.length > 0 && (
            <ul className="chat-in mt-1.5 space-y-0.5 text-xs text-ink-soft">
              {message.notes.map((note, index) => (
                <li key={index} className="break-words">
                  · {note}
                </li>
              ))}
            </ul>
          )}
          {streamDone && message.stats && message.stats.products > 0 && (
            <button
              type="button"
              onClick={onPreview}
              className="chat-in mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink transition-colors hover:border-paprika"
            >
              <EyeIcon size={12} className="shrink-0" />
              <span className="truncate">{statsLine(message.stats)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingRow() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((current) => Math.min(current + 1, THINKING_STEPS.length - 1)), 2600);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="chat-in flex items-start gap-3" role="status" aria-live="polite">
      <AiAvatar thinking />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="px-1 text-xs font-medium text-ink-soft">buyur asistanı</span>
        <div className="flex items-center gap-3 rounded-md border border-line bg-crema/60 px-3.5 py-2.5 text-sm text-ink-soft">
          <span className="flex items-center gap-1" aria-hidden>
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-paprika" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-paprika" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-paprika" />
          </span>
          <span key={step} className="chat-in">
            {THINKING_STEPS[step]}
          </span>
        </div>
      </div>
    </div>
  );
}

function StartCard({ title, description, onClick, disabled }: { title: string; description: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex min-w-0 flex-col items-start gap-0.5 rounded-md border border-line bg-paper px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-paprika hover:shadow-sm disabled:opacity-50"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {title}
        <ArrowRightIcon size={13} className="text-ink-soft transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
      </span>
      <span className="text-xs text-ink-soft">{description}</span>
    </button>
  );
}

function Welcome({ onPick, disabled }: { onPick: (kind: "link" | "file" | "text" | "json") => void; disabled: boolean }) {
  return (
    <div className="chat-in mx-auto flex max-w-xl flex-col items-center px-2 py-8 text-center">
      <AiAvatar size="lg" />
      <p className="mt-4 font-display text-xl font-bold">Menüyü birlikte hazırlayalım</p>
      <p className="mt-1 text-sm text-ink-soft">
        Mevcut menüyü verin, ben kategorileri, ürünleri ve fiyatları çıkarayım. Sonra sohbetle düzenleriz: fiyat güncelleme, kategori birleştirme,
        açıklama yazma…
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        <StartCard title="Menü bağlantısı" description="QR menü sitesi ya da web sayfası" onClick={() => onPick("link")} disabled={disabled} />
        <StartCard title="Fotoğraf veya PDF" description="Basılı menünün fotoğrafı, en çok 5 dosya" onClick={() => onPick("file")} disabled={disabled} />
        <StartCard title="Düz metin" description="Menüyü kopyalayıp yapıştırın" onClick={() => onPick("text")} disabled={disabled} />
        <StartCard title="JSON" description="Başka sistemden dışa aktarılmış menü" onClick={() => onPick("json")} disabled={disabled} />
      </div>
    </div>
  );
}

function Chip({ children, onClick, disabled, className }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-paprika hover:text-ink disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function ImageProgressBar({ progress }: { progress: ImageProgress }) {
  return (
    <div className="min-w-0">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-crema">
        <div className="h-full rounded-full bg-paprika transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Görseller aranıyor: {progress.done}/{progress.total} · {progress.found} bulundu
      </p>
    </div>
  );
}

// ── Sohbet ──────────────────────────────────────────────────────────────

/** Sayfa içindeki menü asistanı. `actions` çağıranın başlık eylemleridir (ör.
 *  "Menüye yaz"); önizleme ve görsel arama burada eklenir. */
export function MenuAssistant({
  session,
  businessName,
  userName,
  actions,
  status,
  disabled = false,
}: {
  session: MenuSession;
  businessName: string;
  /** Sohbetteki kullanıcı rozeti için yöneticinin adı. */
  userName: string;
  actions?: ReactNode;
  /** Ana eylemin durumu (yazılıyor, hata): sohbetin üstünde gösterilir. */
  status?: ReactNode;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const { draft, setDraft, messages, setMessages } = session;
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stats = draftStats(draft);
  const empty = draft.categories.length === 0;
  const locked = disabled || sending;

  const scrollToEnd = useRef(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }).current;
  const noop = useRef(() => undefined).current;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages.length, sending]);

  // Kutu ilk açılışta yanındaki düğmelerle aynı boydadır; yazdıkça uzar,
  // sınırdan sonra kendi içinde kayar.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    const border = field.offsetHeight - field.clientHeight;
    field.style.height = `${Math.min(field.scrollHeight + border, COMPOSER_MAX_HEIGHT)}px`;
    field.style.overflowY = field.scrollHeight + border > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, [input]);

  function fill(text: string) {
    setInput(text);
    requestAnimationFrame(() => {
      const field = inputRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(text.length, text.length);
    });
  }

  function pick(kind: "link" | "file" | "text" | "json") {
    if (kind === "file") fileRef.current?.click();
    else if (kind === "link") fill("https://");
    else if (kind === "json") fill(JSON_EXAMPLE);
    else fill("");
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (files.length + picked.length > MAX_FILES) {
      toast(`Tek mesajda en fazla ${MAX_FILES} dosya eklenebilir.`, "error");
      return;
    }
    const next: Attachment[] = [];
    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) {
        toast(`${file.name} 6 MB'tan büyük.`, "error");
        continue;
      }
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast(`${file.name}: yalnızca görsel ya da PDF eklenebilir.`, "error");
        continue;
      }
      try {
        next.push({ name: file.name, dataUrl: await readAsDataUrl(file) });
      } catch {
        toast(`${file.name} okunamadı.`, "error");
      }
    }
    setFiles((current) => [...current, ...next]);
    inputRef.current?.focus();
  }

  async function send() {
    const message = input.trim();
    if ((!message && files.length === 0) || sending || disabled) return;
    const sent = files;
    const history = messages.map((entry) => ({ role: entry.role, text: entry.text }));
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: message, files: sent.map((file) => file.name) }]);
    setInput("");
    setFiles([]);
    setSending(true);

    const result = await postJson<{ reply: string; notes: string[]; draft: MenuDraft; stats: DraftStats }>("/api/admin/menu-assistant", {
      message,
      attachments: sent.map((file) => file.dataUrl),
      draft,
      businessName,
      history,
    });
    setSending(false);
    if (!result.ok) {
      setMessages((current) => [...current, { id: Date.now(), role: "assistant", text: result.error, error: true }]);
      // Gönderilemeyen dosya ve metin kaybolmasın: yönetici tekrar deneyebilir.
      setFiles(sent);
      setInput(message);
      return;
    }
    setDraft(result.data.draft);
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "assistant",
        // Yanıt metni boşsa (yalnızca kaynak okundu) notlar konuşur.
        text: result.data.reply || (result.data.stats.products > 0 ? "Menüyü okudum, taslağa ekledim." : ""),
        notes: result.data.notes,
        stats: result.data.stats,
      },
    ]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <Card className="flex h-[min(78dvh,48rem)] min-h-[30rem] min-w-0 flex-col p-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
        <AiAvatar thinking={sending} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold leading-tight">Menü asistanı</p>
          <p className="truncate text-xs text-ink-soft">{sending ? "Yazıyor…" : statsLine(stats)}</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <EyeIcon size={14} />
            Önizleme{stats.products > 0 ? ` (${stats.products})` : ""}
          </Button>
          {actions}
        </div>
      </div>

      {(session.images || status) && (
        <div className="space-y-2 border-b border-line bg-crema/40 px-4 py-2.5 text-sm sm:px-5">
          {session.images && (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <ImageProgressBar progress={session.images} />
              </div>
              <Button size="sm" variant="ghost" onClick={session.stopImages}>
                Durdur
              </Button>
            </div>
          )}
          {status}
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          {messages.length === 0 && !sending ? (
            <Welcome onPick={pick} disabled={locked} />
          ) : (
            messages.map((message) => (
              <MessageRow key={message.id} message={message} userName={userName} onPreview={() => setPreviewOpen(true)} onTick={message.role === "assistant" ? scrollToEnd : noop} />
            ))
          )}
          {sending && <ThinkingRow />}
        </div>
      </div>

      <div className="border-t border-line bg-paper px-4 py-3 sm:px-5">
        <div className="mx-auto w-full max-w-3xl">
          {!empty && !sending && (
            <div className="mb-2 flex flex-wrap gap-2">
              <Chip onClick={() => void session.findImages()} disabled={locked || session.images !== null}>
                <SparklesIcon size={12} className="shrink-0 text-paprika" />
                Tüm ürünlere görsel bul
              </Chip>
              {/* Dar ekranda yalnızca ilk iki öneri: çipler mesaj alanını yemesin
                  (yatay kayan şerit kullanılmaz). */}
              {EDIT_SUGGESTIONS.map((suggestion, index) => (
                <Chip key={suggestion} onClick={() => fill(suggestion)} disabled={locked} className={index >= 2 ? "hidden sm:inline-flex" : undefined}>
                  {suggestion}
                </Chip>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`} className="chat-in inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-line bg-crema/60 px-2 py-1 text-xs">
                  <FileTextIcon size={12} className="shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`${file.name} dosyasını çıkar`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="shrink-0 text-ink-soft hover:text-paprika"
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              className="h-10 w-10 px-0"
              aria-label="Fotoğraf ya da PDF ekle"
              title="Fotoğraf ya da PDF ekle"
              onClick={() => fileRef.current?.click()}
              disabled={locked}
            >
              <PlusIcon size={16} />
            </Button>
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={empty ? "Menü bağlantısı, JSON ya da metin yapıştırın…" : "Ne değiştireyim? (ör. Tatlılar'ı en üste al)"}
              className="min-h-10 flex-1 resize-none leading-5"
              disabled={locked}
              aria-label="Asistana mesaj"
            />
            <Button className="h-10" onClick={() => void send()} loading={sending} disabled={disabled || (!input.trim() && files.length === 0)}>
              Gönder
            </Button>
          </div>
          <p className="mt-1.5 hidden text-xs text-ink-soft/80 sm:block">Enter ile gönderin, Shift+Enter ile yeni satır.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            hidden
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <MenuPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} session={session} disabled={disabled} />
    </Card>
  );
}

// ── Önizleme ────────────────────────────────────────────────────────────

function ProductRow({
  product,
  disabled,
  onChange,
  onDelete,
}: {
  product: DraftProduct;
  disabled: boolean;
  onChange: (patch: Partial<DraftProduct>) => void;
  onDelete: () => void;
}) {
  const missingPrice = product.price === null;
  return (
    // Dar ekranda fiyat ve sil düğmesi alt satıra iner; ad okunur genişlikte kalır.
    <div className={cn("flex flex-wrap items-start gap-2 rounded-md border p-2", missingPrice ? "border-paprika/40 bg-paprika/5" : "border-line")}>
      <button
        type="button"
        disabled={disabled || !product.image_url}
        onClick={() => onChange({ image_url: "", image_source: null })}
        title={product.image_url ? "Görseli kaldır" : "Görsel yok"}
        aria-label={product.image_url ? `${product.name} görselini kaldır` : `${product.name} için görsel yok`}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-crema text-ink-soft enabled:hover:border-paprika"
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={16} />
        )}
      </button>
      <div className="min-w-36 flex-1 space-y-1">
        <input
          value={product.name}
          disabled={disabled}
          onChange={(event) => onChange({ name: event.target.value })}
          aria-label="Ürün adı"
          className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium outline-none hover:border-line focus:border-paprika"
        />
        <input
          value={product.description}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Açıklama yok"
          aria-label="Ürün açıklaması"
          className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-ink-soft outline-none placeholder:text-ink-soft/50 hover:border-line focus:border-paprika"
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={product.price ?? ""}
          placeholder="Fiyat"
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = raw === "" ? null : Number(raw);
            const price = parsed === null || Number.isNaN(parsed) || parsed < 0 ? null : parsed;
            onChange({ price, uncertain: price === null ? product.uncertain : product.uncertain.filter((field) => field !== "price") });
          }}
          aria-label="Fiyat"
          className={cn(
            "w-20 rounded-md border bg-paper px-2 py-1 text-right font-mono text-sm outline-none focus:border-paprika",
            missingPrice ? "border-paprika/50" : "border-line"
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          aria-label={`${product.name} ürününü çıkar`}
          title="Ürünü çıkar"
          className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika disabled:opacity-50"
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  );
}

/** Taslağın düzenlenebilir önizlemesi (pencerede). */
export function MenuPreviewModal({ open, onClose, session, disabled }: { open: boolean; onClose: () => void; session: MenuSession; disabled: boolean }) {
  const { draft, setDraft, images } = session;
  const [confirm, confirmDialog] = useConfirm();
  const stats = draftStats(draft);
  const locked = disabled || images !== null;

  const updateCategory = (categoryId: string, update: (category: DraftCategory) => DraftCategory | null) =>
    setDraft((current) => ({
      ...current,
      categories: current.categories.flatMap((category) => {
        if (category.id !== categoryId) return [category];
        const next = update(category);
        return next && next.products.length > 0 ? [next] : [];
      }),
    }));

  const updateProduct = (categoryId: string, productId: string, patch: Partial<DraftProduct>) =>
    updateCategory(categoryId, (category) => ({
      ...category,
      products: category.products.map((product) => (product.id === productId ? { ...product, ...patch } : product)),
    }));

  async function clearAll() {
    const ok = await confirm({
      title: "Taslağı temizle",
      description: "Taslaktaki bütün kategori ve ürünler silinir. Kayda henüz bir şey yazılmadı.",
      confirmLabel: "Temizle",
      tone: "danger",
    });
    if (ok) setDraft(emptyDraft());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Menü önizlemesi"
      description={statsLine(stats)}
      footer={
        <>
          {images ? (
            <>
              <div className="min-w-0 flex-1">
                <ImageProgressBar progress={images} />
              </div>
              <Button size="sm" variant="outline" onClick={session.stopImages}>
                Durdur
              </Button>
            </>
          ) : (
            stats.products > 0 && (
              <>
                <Button size="sm" variant="ghost" onClick={() => void clearAll()} disabled={locked} className="mr-auto">
                  Temizle
                </Button>
                <AiActionButton type="button" onClick={() => void session.findImages()} disabled={disabled}>
                  Tüm ürünlere görsel ara
                </AiActionButton>
              </>
            )
          )}
          <Button size="sm" onClick={onClose}>
            Tamam
          </Button>
        </>
      }
    >
      {draft.categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-ink-soft">
          <SparklesIcon size={20} />
          <p>Asistana bir menü verdiğinizde kategoriler ve ürünler burada görünür.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {draft.categories.map((category) => (
            <section key={category.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={category.name}
                  disabled={locked}
                  onChange={(event) => updateCategory(category.id, (current) => ({ ...current, name: event.target.value }))}
                  aria-label="Kategori adı"
                  className="min-h-9 flex-1 font-semibold"
                />
                <span className="shrink-0 font-mono text-xs text-ink-soft">{category.products.length}</span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => updateCategory(category.id, () => null)}
                  aria-label={`${category.name} kategorisini çıkar`}
                  title="Kategoriyi çıkar"
                  className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika disabled:opacity-50"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
              <div className="grid gap-1.5 lg:grid-cols-2">
                {category.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    disabled={locked}
                    onChange={(patch) => updateProduct(category.id, product.id, patch)}
                    onDelete={() => updateCategory(category.id, (current) => ({ ...current, products: current.products.filter((p) => p.id !== product.id) }))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {confirmDialog}
    </Modal>
  );
}
