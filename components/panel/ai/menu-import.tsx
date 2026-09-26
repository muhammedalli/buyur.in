"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { useToast } from "@/components/panel/toast";
import { AiButton, Button, Card, Modal, Spinner, Switch } from "@/components/panel/ui";
import { ImagePicker } from "@/components/panel/ai/image-picker";
import { autoFindProductImage } from "@/lib/ai/find-image";
import { fingerprintPages } from "@/lib/ai/fingerprint";
import { buildImportPlan, isPlanEmpty, type ImportPlan } from "@/lib/ai/import-plan";
import type { ProductImageSource } from "@/lib/ai/image-source";
import { isRetryableError, withRetry } from "@/lib/pb-retry";
import { findCategoryByName, findProductByName } from "@/lib/unique-name";
import { CheckCircleIcon, ImageIcon, TrashIcon } from "@/components/icons";
import { aiUsage } from "@/lib/entitlements";
import type { ScannedCategory, ScannedProduct } from "@/lib/ai/menu-scan";
import type { Business } from "@/lib/types";

// Fiziksel menü aktarımı: yükle → tara → önizle/düzelt → onayla → aktar.
//
// Dört kural arayüzü belirliyor:
//  1) Okunamayan fiyat tahmin edilmez; kullanıcı doldurana kadar içe aktarma
//     kilitli kalır (yanlış fiyat, eksik fiyattan çok daha pahalıdır).
//  2) İçerik varsayılan olarak TASLAK aktarılır; yayına almak ayrı bir karardır.
//  3) Bir işlem sürerken ikincisi başlamaz ve aynı menü sayfaları ikinci kez
//     taranmadan önce kullanıcıya sorulur — her tarama kotadan hak yer.
//  4) Aktarım idempotenttir: yarıda kalan bir aktarım tekrar denendiğinde
//     yazılmış kategori ve ürünler ikinci kez oluşturulmaz
//     (bkz. lib/ai/import-plan.ts).

type DraftProduct = ScannedProduct & { image_url: string; image_source: ProductImageSource | null };
type DraftCategory = Omit<ScannedCategory, "products"> & { products: DraftProduct[] };

type MenuImportPlan = ImportPlan<DraftCategory, DraftProduct>;

const UNCERTAIN_LABELS: Record<string, string> = {
  name: "Ad okunamadı",
  description: "Açıklama belirsiz",
  price: "Fiyat okunamadı",
  currency: "Para birimi belirsiz",
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

function UncertainBadge({ field }: { field: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-paprika/40 bg-paprika/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paprika-deep">
      {UNCERTAIN_LABELS[field] ?? field}
    </span>
  );
}

/** Onay modalındaki sayı kutusu. */
function PlanStat({ value, label, tone = "default" }: { value: number; label: string; tone?: "default" | "muted" | "warn" }) {
  const toneClass =
    tone === "warn"
      ? "border-paprika/40 bg-paprika/5 text-paprika-deep"
      : tone === "muted"
        ? "border-line bg-crema/50 text-ink-soft"
        : "border-line bg-crema/50 text-ink";
  return (
    <div className={`rounded-md border px-3 py-2.5 text-center ${toneClass}`}>
      <div className="font-display text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] leading-tight">{label}</div>
    </div>
  );
}

function ProductRow({
  product,
  businessId,
  categoryName,
  disabled,
  onChange,
  onDelete,
}: {
  product: DraftProduct;
  businessId: string;
  categoryName: string;
  disabled: boolean;
  onChange: (next: DraftProduct) => void;
  onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const missingPrice = product.price === null;

  return (
    <div className={`rounded-md border p-3 ${missingPrice ? "border-paprika/40 bg-paprika/5" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPicking(true)}
          title="Görsel seç"
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-crema text-ink-soft transition-colors hover:border-paprika disabled:opacity-50"
        >
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={18} />
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={product.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...product, name: e.target.value })}
            placeholder="Ürün adı"
            className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-semibold outline-none focus:border-paprika"
          />
          <textarea
            value={product.description}
            disabled={disabled}
            onChange={(e) => onChange({ ...product, description: e.target.value })}
            placeholder="Açıklama (opsiyonel)"
            rows={2}
            className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-paprika"
          />
          {product.uncertain.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.uncertain.map((field) => (
                <UncertainBadge key={field} field={field} />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={disabled}
              value={product.price ?? ""}
              placeholder="—"
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw === "" ? null : Number(raw);
                onChange({
                  ...product,
                  price: parsed === null || Number.isNaN(parsed) ? null : parsed,
                  // Kullanıcı fiyatı girdiyse işaret kalkar.
                  uncertain: raw === "" ? product.uncertain : product.uncertain.filter((f) => f !== "price"),
                });
              }}
              className="w-24 rounded-md border border-line bg-paper px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-paprika"
            />
            <span className="font-mono text-xs text-ink-soft">₺</span>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            title="Ürünü çıkar"
            className="rounded p-1.5 text-ink-soft transition-colors hover:bg-crema hover:text-paprika disabled:opacity-50"
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </div>

      {picking && (
        <ImagePicker
          businessId={businessId}
          productName={product.name}
          categoryName={categoryName}
          value={product.image_url}
          onChange={(url, source) => onChange({ ...product, image_url: url, image_source: source })}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/** Toplu görsel aramasının canlı sonucu. */
interface BulkImageState {
  total: number;
  done: number;
  current: string;
  results: { name: string; found: boolean }[];
  finished: boolean;
}

export function MenuImport({ business }: { business: Business }) {
  const { toast } = useToast();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<{ name: string; dataUrl: string; isPdf: boolean }[]>([]);
  const [fingerprint, setFingerprint] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [categories, setCategories] = useState<DraftCategory[] | null>(null);
  const [publishNow, setPublishNow] = useState(false);
  const [currency, setCurrency] = useState("");

  // Bu oturumda tamamlanmış taramalar ve aktarımlar — aynısını tekrarlamadan
  // önce kullanıcıya sorulur.
  const [scannedPrints, setScannedPrints] = useState<string[]>([]);
  const [importedPrints, setImportedPrints] = useState<string[]>([]);
  const [repeatAsk, setRepeatAsk] = useState<null | "scan" | "import">(null);

  // Önizleme modalı: tarama biter bitmez açılır. Dışarı tıklamayla veya ESC ile
  // kapanmaz — kullanıcı yanlışlıkla bir tıkla tüm düzeltmelerini gözden
  // kaybetmesin. Kapatmak açık bir karar: "Kapat" → onay.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);

  const [bulkImages, setBulkImages] = useState<BulkImageState | null>(null);
  const [plan, setPlan] = useState<MenuImportPlan | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importError, setImportError] = useState("");

  // Tek bir kapı: tarama, görsel arama ve aktarım aynı anda çalışamaz.
  // State güncellemesi asenkron olduğu için ref ile kilitleniyor — arka arkaya
  // iki tık aynı render'da iki istek başlatmasın.
  const busyRef = useRef(false);
  const busy = scanning || saving || preparing || (bulkImages !== null && !bulkImages.finished);

  // Sayfa sınırı plandan gelir — elle plan karşılaştırması yapılmaz.
  const pagesPerScan = aiUsage(business).pagesPerScan;

  const totalProducts = categories?.reduce((sum, c) => sum + c.products.length, 0) ?? 0;
  const missingPriceCount =
    categories?.reduce((sum, c) => sum + c.products.filter((p) => p.price === null).length, 0) ?? 0;
  const uncertainCount =
    categories?.reduce(
      (sum, c) => sum + c.products.reduce((inner, p) => inner + p.uncertain.length, 0),
      0
    ) ?? 0;

  // Yarım kalmış bir tarama/aktarım sekme kapatılınca sessizce kaybolmasın.
  useEffect(() => {
    if (!busy) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const lock = useCallback(() => {
    if (busyRef.current) return false;
    busyRef.current = true;
    return true;
  }, []);

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0 || busyRef.current) return;
    try {
      const parsed = await Promise.all(
        Array.from(selected).map(async (file) => ({
          name: file.name,
          dataUrl: await readAsDataUrl(file),
          isPdf: file.type === "application/pdf",
        }))
      );
      setFiles(parsed);
      setFingerprint(await fingerprintPages(parsed.map((f) => f.dataUrl)));
    } catch {
      toast("Dosyalar okunamadı. Tekrar deneyin.", "error");
    }
  }

  /** Tarama isteği. `force`, kullanıcı "yine de tara" dediğinde gönderilir. */
  async function runScan(force: boolean) {
    if (!lock()) return;
    setScanning(true);
    setPlan(null);
    setImportError("");
    // Mevcut taslak burada SİLİNMEZ: tarama başarısız olursa kullanıcının
    // üzerinde çalıştığı liste kaybolmasın. Başarılı sonuç onun yerine geçer.

    try {
      const res = await fetch("/api/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
        body: JSON.stringify({
          businessId: business.id,
          images: files.map((f) => f.dataUrl),
          fingerprint,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Sunucu da aynı dosyaları tanıdıysa onay penceresini aç.
        if (res.status === 409 && data.duplicate) {
          setRepeatAsk("scan");
          return;
        }
        throw new Error(data.error ?? "Tarama başarısız oldu.");
      }

      setCategories(
        (data.categories as ScannedCategory[]).map((category) => ({
          ...category,
          products: category.products.map((product) => ({ ...product, image_url: "", image_source: null })),
        }))
      );
      setCurrency(typeof data.currency === "string" ? data.currency : "");
      if (fingerprint) setScannedPrints((current) => [...new Set([...current, fingerprint])]);
      setReviewOpen(true);
      toast("Menü tarandı. Kontrol edip düzenleyebilirsiniz.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Tarama başarısız oldu.", "error");
    } finally {
      busyRef.current = false;
      setScanning(false);
    }
  }

  function handleScanClick() {
    if (files.length === 0 || busy) return;
    // Aynı dosyalar bu oturumda zaten tarandıysa önce sor — her tarama
    // kotadan bir hak yer ve ikinci sonuç seti tekrar aktarımına yol açar.
    if (fingerprint && scannedPrints.includes(fingerprint)) {
      setRepeatAsk("scan");
      return;
    }
    runScan(false);
  }

  /** Görseli olmayan ürünler için sırayla arama yapar. Bir ürün için görsel
   *  bulunamazsa atlanır — akış hiçbir koşulda durmaz. */
  async function handleFindImages() {
    if (!categories || !lock()) return;

    const pending = categories.flatMap((category) =>
      category.products.filter((p) => !p.image_url).map((product) => ({ category, product }))
    );

    if (pending.length === 0) {
      busyRef.current = false;
      toast("Tüm ürünlerin görseli zaten var.");
      return;
    }

    setBulkImages({ total: pending.length, done: 0, current: pending[0].product.name, results: [], finished: false });

    const found = new Map<string, { url: string; source: ProductImageSource }>();
    const results: { name: string; found: boolean }[] = [];

    for (const { category, product } of pending) {
      setBulkImages((current) => (current ? { ...current, current: product.name } : current));
      const stored = await autoFindProductImage(business.id, product.name, category.name);
      if (stored) found.set(product.id, stored);
      results.push({ name: product.name, found: Boolean(stored) });
      setBulkImages((current) =>
        current ? { ...current, done: current.done + 1, results: [...results] } : current
      );
    }

    setCategories((current) =>
      current?.map((category) => ({
        ...category,
        products: category.products.map((product) => {
          const stored = found.get(product.id);
          return stored ? { ...product, image_url: stored.url, image_source: stored.source } : product;
        }),
      })) ?? null
    );

    setBulkImages((current) => (current ? { ...current, current: "", finished: true } : current));
    busyRef.current = false;
  }

  function updateProduct(categoryId: string, next: DraftProduct) {
    setCategories(
      (current) =>
        current?.map((category) =>
          category.id === categoryId
            ? { ...category, products: category.products.map((p) => (p.id === next.id ? next : p)) }
            : category
        ) ?? null
    );
  }

  function deleteProduct(categoryId: string, productId: string) {
    setCategories(
      (current) =>
        current
          ?.map((category) =>
            category.id === categoryId
              ? { ...category, products: category.products.filter((p) => p.id !== productId) }
              : category
          )
          .filter((category) => category.products.length > 0) ?? null
    );
  }

  function dropMissingPrices() {
    setCategories(
      (current) =>
        current
          ?.map((category) => ({
            ...category,
            products: category.products.filter((p) => p.price !== null),
          }))
          .filter((category) => category.products.length > 0) ?? null
    );
  }

  /** Aktarım planını menünün GÜNCEL hâline göre hesaplar ve onay modalını açar.
   *  Her denemede yeniden okunur; yarıda kalmış bir aktarımın yazdıkları
   *  ikinci denemede "zaten var" sayılır. */
  async function prepareImport() {
    if (!categories || missingPriceCount > 0 || !lock()) return;
    setPreparing(true);
    setImportError("");
    setImportProgress({ done: 0, total: 0 });

    try {
      const [existingCategories, existingProducts] = await Promise.all([
        pb.collection("buyur_categories").getFullList<{ id: string; name: string; order: number }>({
          filter: pb.filter("business = {:id}", { id: business.id }),
          fields: "id,name,order",
        }),
        pb.collection("buyur_products").getFullList<{ category: string; name: string; order: number }>({
          filter: pb.filter("business = {:id}", { id: business.id }),
          fields: "category,name,order",
        }),
      ]);

      setPlan(buildImportPlan<DraftProduct, DraftCategory>(categories, existingCategories, existingProducts));
    } catch {
      toast("Menünüz okunamadı. Bağlantınızı kontrol edip tekrar deneyin.", "error");
    } finally {
      busyRef.current = false;
      setPreparing(false);
    }
  }

  function handleImportClick() {
    // Aynı tarama sonucu bu oturumda zaten aktarıldıysa önce sor.
    if (fingerprint && importedPrints.includes(fingerprint)) {
      setRepeatAsk("import");
      return;
    }
    prepareImport();
  }

  /** Planı uygular. Hata hâlinde yazılanlar korunur; tekrar denendiğinde plan
   *  yeniden hesaplandığı için aynı kayıtlar bir daha oluşturulmaz. */
  async function runImport() {
    if (!plan || !lock()) return;
    setSaving(true);
    setImportError("");

    const total = plan.newProductCount;
    setImportProgress({ done: 0, total });
    let done = 0;
    let failed = 0;
    let firstError: unknown;

    try {
      for (const planned of plan.categories) {
        let categoryId = planned.existingId;
        if (!categoryId) {
          const created = await withRetry(
            () =>
              pb.collection("buyur_categories").create<{ id: string }>({
                business: business.id,
                name: planned.draft.name,
                description: "",
                order: planned.order,
                // Taslak: kullanıcı ayrıca "yayınla" demedikçe menüde görünmez.
                is_active: publishNow,
              }),
            { verify: () => findCategoryByName(business.id, planned.draft.name) }
          );
          categoryId = created.id;
        }

        // Ürünler TEK TEK ve SIRAYLA yazılır. Aynı anda 25 istek göndermek
        // sunucudan 503 döndürüyordu; sıralı akış hem yükü yayar hem de bir
        // ürünün sonucu bilinmeden diğerine geçilmemesini sağlar.
        for (const [index, product] of planned.newProducts.entries()) {
          try {
            await withRetry(
              () =>
                pb.collection("buyur_products").create<{ id: string }>({
                  business: business.id,
                  category: categoryId,
                  name: product.name,
                  description: product.description,
                  price: product.price ?? 0,
                  images: product.image_url ? [product.image_url] : [],
                  image_source: product.image_url ? product.image_source : null,
                  is_available: publishNow,
                  order: planned.productOrderStart + index,
                }),
              // ÇİFT KAYIT KORUMASI: 503 "yazılmadı" demek değil. Tekrar denemeden
              // önce ürünün menüde belirip belirmediğine bakılır.
              { verify: () => findProductByName(business.id, product.name) }
            );
            done += 1;
          } catch (error) {
            failed += 1;
            firstError ??= error;
          }
          setImportProgress({ done, total });
        }
      }

      // Kısmi başarı artık sessiz kalmıyor: kaçının yazılamadığı açıkça söylenir
      // ve kullanıcı aynı ekranda tekrar deneyebilir (plan yeniden hesaplandığı
      // için yalnızca eksikler yazılır, kayıtlar ikiye katlanmaz).
      if (failed > 0) {
        setPlan(null);
        setImportError(
          `${done} ürün eklendi, ${failed} ürün eklenemedi${
            isRetryableError(firstError) ? " (sunucu yanıt vermedi)" : ""
          }. Tekrar denediğinizde eklenenler tekrarlanmaz, yalnızca eksikler yazılır.`
        );
        toast(`${failed} ürün eklenemedi.`, "error");
        return;
      }

      if (fingerprint) setImportedPrints((current) => [...new Set([...current, fingerprint])]);
      setPlan(null);
      setReviewOpen(false);
      toast(
        publishNow
          ? `${done} ürün menünüze eklendi ve yayınlandı.`
          : `${done} ürün taslak olarak eklendi. Ürünler sayfasından yayınlayabilirsiniz.`
      );
      router.push("/panel/products");
    } catch {
      // Kategori yazılamadı: yazılanlar menüde kaldı, kalanı yazılamadı.
      // Plan sıfırlanır ki "tekrar dene" menüyü baştan okuyup yalnızca
      // eksikleri yazsın — kayıtlar ikiye katlanmaz.
      setPlan(null);
      setImportError(
        done > 0
          ? `${done} ürün eklendikten sonra bağlantı koptu. Tekrar denediğinizde eklenenler tekrarlanmaz, yalnızca eksikler yazılır.`
          : "Kaydedilirken bir hata oluştu. Hiçbir ürün eklenmedi, tekrar deneyebilirsiniz."
      );
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  const planEmpty = plan !== null && isPlanEmpty(plan);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* ── 1. Yükleme ────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <h3 className="mb-1 font-display text-lg font-bold">1 · Menünüzü yükleyin</h3>
          <p className="mb-4 text-sm text-ink-soft">
            Fiziksel menünüzün net çekilmiş fotoğraflarını veya PDF dosyasını seçin. Tek seferde en fazla{" "}
            {pagesPerScan} sayfa.
          </p>

          <input
            ref={fileInput}
            type="file"
            multiple
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="block w-full cursor-pointer text-sm text-ink-soft transition file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-crema file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-line disabled:opacity-50"
          />

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-crema"
                >
                  {file.isPdf ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                      <span className="font-mono text-[11px] font-bold text-paprika">PDF</span>
                      <span className="line-clamp-2 text-[10px] text-ink-soft">{file.name}</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.dataUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}

          {fingerprint !== "" && scannedPrints.includes(fingerprint) && (
            <p className="mt-4 rounded-md border border-line bg-crema/50 px-3 py-2 text-xs leading-relaxed text-ink-soft">
              Bu sayfalar bu oturumda tarandı. Yeniden taramak kotanızdan bir hak daha harcar.
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <AiButton onClick={handleScanClick} disabled={files.length === 0 || busy}>
              {scanning ? "Taranıyor…" : "Menüyü Tara"}
            </AiButton>
          </div>
        </Card>

        <Card className="bg-crema/30">
          <p className="text-xs leading-relaxed text-ink-soft">
            <strong className="text-ink">Yapay zekâ tahmin etmez.</strong> Okunamayan fiyat veya metin boş
            bırakılır ve işaretlenir. İçe aktarmadan önce bu alanları kontrol edin.
          </p>
        </Card>
      </div>

      {/* ── 2. Önizleme ve onay ───────────────────────────────── */}
      <div>
        {scanning && (
          <Card className="flex flex-col items-center justify-center gap-3 py-20 text-ink-soft">
            <Spinner className="h-8 w-8 text-paprika" />
            <p>Yapay zekâ menüyü inceliyor…</p>
            <p className="text-xs">Sayfa sayısına göre 5-20 saniye sürebilir.</p>
          </Card>
        )}

        {!scanning && !categories && (
          <Card className="flex items-center justify-center border-dashed py-20 text-center text-sm text-ink-soft">
            Tarama bitince kategoriler ve ürünler burada görünür.
          </Card>
        )}

        {/* Tarama sonucu modalda düzenlenir. Modal kapatıldığında sonuç
            kaybolmaz; buradan yeniden açılır. */}
        {!scanning && categories && (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <h3 className="font-display text-lg font-bold">Tarama hazır</h3>
            <p className="text-sm text-ink-soft">
              {categories.length} kategori · {totalProducts} ürün
              {currency && ` · ${currency}`}
              {uncertainCount > 0 && ` · ${uncertainCount} alan kontrol bekliyor`}
            </p>
            {missingPriceCount > 0 && (
              <p className="text-sm text-paprika-deep">{missingPriceCount} ürünün fiyatı okunamadı.</p>
            )}
            <Button type="button" className="mt-2" onClick={() => setReviewOpen(true)} disabled={busy}>
              Kontrol et ve aktar
            </Button>
          </Card>
        )}
      </div>

      {/* ── Önizleme / düzenleme penceresi ─────────────────────── */}
      <Modal
        open={reviewOpen && categories !== null}
        // Dışarı tıklama ve ESC kapatmaz: elle yapılan düzeltmeler tek bir
        // kazara tıkla gözden kaybolmasın.
        dismissable={false}
        onClose={() => (busy ? undefined : setCloseAsk(true))}
        size="xl"
        title="2 · Kontrol edin ve onaylayın"
        description={
          categories
            ? `${categories.length} kategori · ${totalProducts} ürün${currency ? ` · ${currency}` : ""}${
                uncertainCount > 0 ? ` · ${uncertainCount} alan kontrol bekliyor` : ""
              }`
            : undefined
        }
        footer={
          <div className="flex w-full flex-col gap-4">
            <Switch
              checked={publishNow}
              onChange={setPublishNow}
              label="İçe aktardıktan sonra hemen yayınla"
              description="Kapalıyken içerik taslak olarak eklenir ve menüde görünmez. Ürünler sayfasından tek tek yayınlayabilirsiniz."
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCloseAsk(true)} disabled={busy}>
                Kapat
              </Button>
              <Button type="button" variant="outline" onClick={handleFindImages} disabled={busy}>
                <ImageIcon size={16} />
                Görselleri otomatik bul
              </Button>
              <Button
                type="button"
                onClick={handleImportClick}
                loading={preparing || saving}
                disabled={busy || missingPriceCount > 0 || totalProducts === 0}
              >
                <CheckCircleIcon size={16} />
                {importError ? "Tekrar dene" : "Menüye aktar"}
              </Button>
            </div>
          </div>
        }
      >
        {categories && (
          <div className="space-y-4">
            {importError && (
              <div className="rounded-md border border-paprika/40 bg-paprika/5 px-4 py-3 text-sm leading-relaxed">
                {importError}
              </div>
            )}

            {missingPriceCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paprika/40 bg-paprika/5 px-4 py-3">
                <p className="text-sm">
                  <strong>{missingPriceCount} ürünün fiyatı okunamadı.</strong>{" "}
                  <span className="text-ink-soft">
                    Yapay zekâ tahmin etmedi — fiyatları girin ya da bu ürünleri çıkarın.
                  </span>
                </p>
                <Button type="button" variant="ghost" onClick={dropMissingPrices} disabled={busy}>
                  Bunları çıkar
                </Button>
              </div>
            )}

            <div className="space-y-5">
              {categories.map((category) => (
                <div key={category.id} className="rounded-md border border-line p-4">
                  <input
                    value={category.name}
                    disabled={busy}
                    onChange={(e) =>
                      setCategories(
                        (current) =>
                          current?.map((c) =>
                            c.id === category.id ? { ...c, name: e.target.value } : c
                          ) ?? null
                      )
                    }
                    className="mb-3 w-full rounded-md border border-transparent bg-transparent px-1 py-1 font-display text-lg font-bold text-[var(--brand)] outline-none focus:border-line focus:bg-paper"
                  />
                  <div className="space-y-2">
                    {category.products.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        businessId={business.id}
                        categoryName={category.name}
                        disabled={busy}
                        onChange={(next) => updateProduct(category.id, next)}
                        onDelete={() => deleteProduct(category.id, product.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Pencereyi kapatma onayı ───────────────────────────── */}
      <Modal
        open={closeAsk}
        onClose={() => setCloseAsk(false)}
        size="sm"
        title="Pencereyi kapatalım mı?"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCloseAsk(false)}>
              Düzenlemeye dön
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setCloseAsk(false);
                setReviewOpen(false);
              }}
            >
              Kapat
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          Tarama sonucu silinmez — sağdaki karttan aynı listeyi yeniden açıp kaldığınız yerden devam
          edebilirsiniz. Menünüze hiçbir şey yazılmadı.
        </p>
      </Modal>
      {/* ── Aktarım onayı ─────────────────────────────────────── */}
      <Modal
        open={plan !== null}
        onClose={() => !saving && setPlan(null)}
        // Onay penceresi de dışarı tıklamayla kapanmaz; karar "Vazgeç" ile verilir.
        dismissable={false}
        size="md"
        title="Menüye aktarılacaklar"
        description={
          saving
            ? "Aktarım sürüyor, pencereyi kapatmayın."
            : "Onaylamadan önce ne yazılacağına bakın. Menüde zaten olan kategori ve ürünler yeniden oluşturulmaz."
        }
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setPlan(null)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="button" onClick={runImport} loading={saving} disabled={saving || planEmpty}>
              <CheckCircleIcon size={16} />
              {publishNow ? "Aktar ve yayınla" : "Taslak olarak aktar"}
            </Button>
          </>
        }
      >
        {plan && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PlanStat value={plan.newCategoryCount} label="yeni kategori" />
              <PlanStat value={plan.newProductCount} label="yeni ürün" />
              <PlanStat
                value={plan.reusedCategoryCount}
                label="mevcut kategoriye eklenecek"
                tone="muted"
              />
              <PlanStat
                value={plan.duplicateProductCount + plan.mergedProductCount}
                label="tekrar olduğu için atlanacak"
                tone={plan.duplicateProductCount + plan.mergedProductCount > 0 ? "warn" : "muted"}
              />
            </div>

            {planEmpty && (
              <p className="rounded-md border border-herb/40 bg-herb/10 px-4 py-3 text-sm leading-relaxed">
                Bu taramadaki her şey menünüzde zaten var. Yazılacak yeni bir kayıt yok — muhtemelen bu
                menüyü daha önce aktardınız.
              </p>
            )}

            {(plan.mergedCategoryCount > 0 || plan.mergedProductCount > 0) && (
              <p className="text-xs leading-relaxed text-ink-soft">
                Taramanın kendi içindeki tekrarlar birleştirildi:{" "}
                {plan.mergedCategoryCount > 0 && `${plan.mergedCategoryCount} kategori`}
                {plan.mergedCategoryCount > 0 && plan.mergedProductCount > 0 && ", "}
                {plan.mergedProductCount > 0 && `${plan.mergedProductCount} ürün`}. Çok sayfalı menülerde
                aynı başlık her sayfada yeniden okunabiliyor.
              </p>
            )}

            <div className="space-y-2">
              {plan.categories.map((planned) => (
                <div key={planned.draft.id} className="rounded-md border border-line px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display font-bold">{planned.draft.name}</span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider ${planned.existingId ? "text-ink-soft" : "text-herb"}`}
                    >
                      {planned.existingId ? "menüde var" : "yeni kategori"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {planned.newProducts.length} ürün eklenecek
                    {planned.skippedNames.length > 0 &&
                      ` · ${planned.skippedNames.length} ürün atlanacak (${planned.skippedNames.slice(0, 3).join(", ")}${planned.skippedNames.length > 3 ? "…" : ""})`}
                  </p>
                </div>
              ))}
            </div>

            {saving && importProgress.total > 0 && (
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-crema">
                  <div
                    className="h-full rounded-full bg-paprika transition-all"
                    style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  {importProgress.done}/{importProgress.total} ürün yazıldı
                </p>
              </div>
            )}

            <p className="text-xs leading-relaxed text-ink-soft">
              {publishNow
                ? "Aktarılan kategori ve ürünler hemen menünüzde görünür."
                : "Aktarılan içerik taslaktır; Ürünler sayfasından yayınlayana kadar menünüzde görünmez."}
            </p>
          </div>
        )}
      </Modal>

      {/* ── Görsel arama sonuçları ────────────────────────────── */}
      <Modal
        open={bulkImages !== null}
        onClose={() => bulkImages?.finished && setBulkImages(null)}
        dismissable={bulkImages?.finished === true}
        size="md"
        title="Ürün görselleri aranıyor"
        description="Açık lisanslı kaynaklarda ürün adına göre arama yapılıyor. Bulunamayan ürünler görselsiz kalır — sonra tek tek seçebilirsiniz."
        footer={
          <Button
            type="button"
            onClick={() => setBulkImages(null)}
            disabled={!bulkImages?.finished}
            variant={bulkImages?.finished ? "primary" : "ghost"}
          >
            {bulkImages?.finished ? "Tamam" : "Aranıyor…"}
          </Button>
        }
      >
        {bulkImages && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-crema">
                <div
                  className="h-full rounded-full bg-paprika transition-all"
                  style={{ width: `${Math.round((bulkImages.done / bulkImages.total) * 100)}%` }}
                />
              </div>
              <p className="text-center font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                {bulkImages.finished
                  ? `${bulkImages.results.filter((r) => r.found).length}/${bulkImages.total} ürüne görsel bulundu`
                  : `${bulkImages.done}/${bulkImages.total} · ${bulkImages.current}`}
              </p>
            </div>

            <div className="max-h-[45vh] space-y-1 overflow-y-auto">
              {bulkImages.results.map((result, index) => (
                <div
                  key={`${result.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{result.name}</span>
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${result.found ? "text-herb" : "text-ink-soft"}`}
                  >
                    {result.found ? "bulundu" : "bulunamadı"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Tekrar uyarısı ────────────────────────────────────── */}
      <Modal
        open={repeatAsk !== null}
        onClose={() => setRepeatAsk(null)}
        dismissable={false}
        size="sm"
        title={repeatAsk === "import" ? "Bu menüyü zaten aktardınız" : "Bu menüyü zaten taradınız"}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRepeatAsk(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={() => {
                const mode = repeatAsk;
                setRepeatAsk(null);
                if (mode === "scan") runScan(true);
                else prepareImport();
              }}
            >
              {repeatAsk === "import" ? "Yine de kontrol et" : "Yine de tara"}
            </Button>
          </>
        }
      >
        {repeatAsk === "import" ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Bu tarama sonucunu bu oturumda bir kez menünüze aktardınız. Devam ederseniz menünüz yeniden
            okunur ve yalnızca gerçekten eksik olan kayıtlar yazılır — mevcut ürünler tekrarlanmaz.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            Aynı dosyaları az önce taradınız. Yeniden tarama aylık tarama hakkınızdan bir hak daha harcar ve
            büyük ihtimalle aynı sonucu verir. Sonuçta bir eksiklik gördüyseniz daha net bir fotoğrafla
            deneyin.
          </p>
        )}
      </Modal>
    </div>
  );
}
