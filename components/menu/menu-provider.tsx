"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { brandStyle as businessBrandStyle } from "@/lib/brand-style";
import { cartCount, lineKey, loadCart, saveCart, unitPriceFor, type CartLine, type CartSelection } from "@/lib/cart";
import {
  activeLocales,
  getStoredLocale,
  hasStoredLocale,
  isRTLLocale,
  localeCodes,
  localeLabels,
  mainLocale,
  storeLocale,
  tField,
  t as translate,
  type Locale,
  type Translatable,
  type TranslatableField,
  type UIKey,
} from "@/lib/i18n";
import type { TrackPayload } from "@/lib/analytics/events";
import { trackEvent, trackOnce } from "@/lib/analytics/track-client";
import type { Business, Category, Popup, Product, ProductOption } from "@/lib/types";
import { OptionPicker } from "@/components/menu/option-picker";
import { CartBar } from "@/components/menu/cart";
import { PopupModal } from "@/components/menu/popup-modal";
import { LanguageModal } from "@/components/menu/language-modal";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { ImageCreditsLink } from "@/components/menu/image-credit";
import { UpsellSheet } from "@/components/menu/upsell-sheet";
import { MenuSplash } from "@/components/menu/menu-splash";
import { FadeImg } from "@/components/menu/fade-img";
import { upsellSuggestions } from "@/lib/upsell";
import { BusinessInfoSheet, hasBusinessInfo } from "@/components/menu/business-info";
import { PoweredBy } from "@/components/powered-by";
import { PLATFORM_BRANDING, showsPlatformSignature } from "@/lib/branding";
import { ArrowLeftIcon, InfoIcon, MenuIcon, SearchIcon, ShoppingBagIcon, StarIcon } from "@/components/icons";

/** Sepete eklemenin nereden geldiği: menüdeki ürün kartı ya da "yanına içecek" önerisi. */
type AddSource = "menu" | "upsell";

interface MenuContextValue {
  business: Business;
  /** Link tabanı: subdomain'de "" (vezirhan.buyur.in), path erişiminde "/vezirhan". */
  base: string;
  cartLines: CartLine[];
  addProduct: (product: Product) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  /** Analitik event gönderir; oturum/kaynak/cihaz sunucuda eklenir. */
  track: (payload: TrackPayload) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** İşletmenin aktif dilleri (Türkçe dahil). Dil seçici yalnızca bunları gösterir. */
  locales: Locale[];
  t: (key: UIKey, vars?: Record<string, string | number>) => string;
  tf: (entity: Translatable, field: TranslatableField) => string;
  categories: Category[];
  products: Product[];
  categoriesLoading: boolean;
  imageByCategory: Map<string, string>;
  productCountByCategory: Map<string, number>;
  /** İşletme bilgileri yaprağını açar (adres, saatler, WiFi, iletişim…). */
  openInfo: () => void;
  /** İşletmenin web sitesi yayındaysa vitrinin adresi (menü → site geçişi); yoksa null. */
  websiteHref: string | null;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu, MenuProvider içinde kullanılmalı");
  return ctx;
}

/** Hem menüde hem vitrinde (site/karşılama) kullanılan parçalar için: menü dışında null. */
export function useOptionalMenu() {
  return useContext(MenuContext);
}

const PAGE_LABELS: Record<string, string> = {
  welcome: "Karşılama",
  menu: "Menü (kategoriler)",
  category: "Kategori sayfası",
  product: "Ürün sayfası",
  search: "Arama",
  cart: "Sepet",
  degerlendir: "Değerlendirme",
};

// Her rota değişiminde bir page_view kaydeder (aynı path'e art arda tekrar yazmaz).
function TrackPageViews({ business, base, locale }: { business: Business; base: string; locale: Locale }) {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    // Kök ("/"), yalnızca masadaki QR taramasında menü kabuğuna düşer (vitrin
    // ayrı rotada); bu yüzden kök de menü sayılır.
    let kind = "menu";
    if (pathname.startsWith(`${base}/categories/`)) kind = "category";
    else if (pathname.startsWith(`${base}/products/`)) kind = "product";
    else if (pathname.startsWith(`${base}/search`)) kind = "search";
    else if (pathname.startsWith(`${base}/cart`)) kind = "cart";
    else if (pathname.startsWith(`${base}/review`)) kind = "degerlendir";
    else if (pathname.startsWith(`${base}/welcome`)) kind = "welcome";

    trackEvent(business.slug, { type: "page_view", target: kind, label: PAGE_LABELS[kind] ?? kind, locale });
    // Sepet sayfası funnel'ın son adımı — ayrıca kendi event'iyle sayılır.
    if (kind === "cart") {
      trackEvent(business.slug, { type: "cart_view", target: "cart", label: PAGE_LABELS.cart, locale });
    }
  }, [pathname, business.slug, base, locale]);

  return null;
}

/** Rota değişince içerik yeniden girer (kategori → kategori geçişi dahil). */
function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}

function isPopupInWindow(popup: Popup) {
  const now = Date.now();
  if (popup.starts_at && new Date(popup.starts_at).getTime() > now) return false;
  if (popup.ends_at && new Date(popup.ends_at).getTime() < now) return false;
  return true;
}

function MenuHeader({
  business,
  base,
}: {
  business: Business;
  base: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t, tf, openInfo } = useMenu();
  const isSubPage = pathname.startsWith(`${base}/products/`) || pathname.startsWith(`${base}/categories/`);
  const showInfo = hasBusinessInfo(business);
  const menuHome = `${base}/menu`;
  const isMenuHome = pathname === menuHome || pathname === `${menuHome}/`;

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(`${base}/menu`);
  }

  // Sayfa kaydırılınca başlık gölge kazanır: içeriğin başlığın altından aktığı hissedilir.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line/40 bg-paper/90 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? "menu-header-scrolled" : ""
      }`}
    >
      <div className="relative mx-auto flex h-[var(--header-h)] max-w-3xl items-center justify-between px-4">
        {/* Sol alan: alt sayfalarda geri, diğerlerinde işletme bilgileri */}
        <div className="flex w-9 shrink-0 items-center justify-start">
          {isSubPage ? (
            <button
              onClick={goBack}
              aria-label={t("back")}
              className="flex h-9 w-9 items-center justify-center rounded-full shadow-xs transition-transform active:scale-95"
              style={{ background: "var(--brand)", color: "var(--brand-on)" }}
            >
              <ArrowLeftIcon size={18} className={isRTLLocale(locale) ? "rotate-180" : undefined} />
            </button>
          ) : showInfo ? (
            <button
              type="button"
              onClick={openInfo}
              aria-label={t("businessInfo")}
              title={t("businessInfo")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line/50 bg-paper/90 text-ink shadow-xs transition-colors hover:bg-crema active:scale-95"
            >
              <InfoIcon size={18} />
            </button>
          ) : null}
        </div>

        {/* Merkez: logo ve isim. Misafiri menünün dışına (platform sitesine)
            çıkarmaz; işletmenin kendi menüsünün başına döndürür. Zaten menü
            başındaysa yeniden yönlendirmez, sayfayı yukarı kaydırır. */}
        <Link
          href={menuHome}
          onClick={(event) => {
            if (!isMenuHome) return;
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={`${tf(business, "name")} — ${t("menuHomeAria")}`}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 max-w-[60%] flex-col items-center gap-1 text-center transition-opacity hover:opacity-85"
        >
          {business.logo_url ? (
            <span className="relative block h-8 w-8 overflow-hidden rounded-xl border border-line/50 bg-paper shadow-xs">
              <picture>
                <FadeImg src={business.logo_url} alt="" loading="eager" className="absolute inset-0 h-full w-full object-cover" />
              </picture>
            </span>
          ) : null}
          <span className="max-w-full truncate font-display text-[15px] font-bold leading-tight text-ink">
            {tf(business, "name")}
          </span>
        </Link>

        {/* Sağ Alan: Dil Seçici */}
        <div className="flex w-9 shrink-0 items-center justify-end">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

/** Menü altbilgisi: alt sayfalarda değerlendirme bağlantısı, görsel künye
 *  bağlantısı ve (markasız plan değilse) platform imzası. */
function MenuFooter({ base, products, locale }: { base: string; products: Product[]; locale: Locale }) {
  const pathname = usePathname();
  const { business, t } = useMenu();
  // Ana menü sayfasında zaten zengin değerlendirme banner'ı bulunur; alt sayfalarda hafif bir hap buton sunulur.
  const isMenuHome = pathname.endsWith("/menu") || pathname.endsWith("/menu/") || pathname === base || pathname === `${base}/`;
  const isReviewPage = pathname.includes("/review");

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-2.5 px-5 pb-6 pt-6">
      {!isMenuHome && !isReviewPage && (
        <Link
          href={`${base}/review`}
          className="flex items-center gap-2 rounded-full border border-line/60 bg-paper/90 px-4 py-2 font-display text-xs font-semibold text-ink-soft shadow-xs backdrop-blur-sm transition-all hover:border-[var(--brand)]/60 hover:text-ink active:scale-95"
        >
          <StarIcon size={14} filled className="text-amber-400" />
          <span>{t("reviewUsCta")}</span>
        </Link>
      )}
      <ImageCreditsLink products={products} base={base} locale={locale} />
      {showsPlatformSignature(business) && (
        <PoweredBy label={t("poweredByBuyur", { brand: PLATFORM_BRANDING.name })} />
      )}
    </div>
  );
}

function BottomNav({ base }: { base: string }) {
  const pathname = usePathname();
  const { t, cartLines } = useMenu();
  const count = cartCount(cartLines);

  const items = [
    {
      href: `${base}/menu`,
      Icon: MenuIcon,
      label: t("navMenu"),
      active:
        pathname.startsWith(`${base}/menu`) ||
        pathname.startsWith(`${base}/categories`) ||
        pathname.startsWith(`${base}/products`),
    },
    { href: `${base}/search`, Icon: SearchIcon, label: t("navSearch"), active: pathname.startsWith(`${base}/search`), badge: 0 },
    { href: `${base}/cart`, Icon: ShoppingBagIcon, label: t("cartTitle"), active: pathname.startsWith(`${base}/cart`), badge: count },
  ];

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 sm:bottom-6">
      <div className="pointer-events-auto mx-auto flex max-w-[340px] items-center justify-between gap-1 rounded-full border border-line/60 bg-paper/90 p-1.5 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-all">
        {items.map((item) => {
          const active = item.active;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 px-3 font-display text-xs font-semibold transition-all duration-300 active:scale-95 ${
                active
                  ? "shadow-xs"
                  : "text-ink-soft hover:bg-crema/60 hover:text-ink"
              }`}
              style={
                active
                  ? { background: "var(--brand)", color: "var(--brand-on)" }
                  : undefined
              }
            >
              <span className="relative flex items-center justify-center">
                <item.Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                {"badge" in item && item.badge ? (
                  <span
                    className={`absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none shadow-xs ${
                      active ? "bg-white text-ink" : "bg-[var(--brand)] text-[var(--brand-on)]"
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale, locales, t } = useMenu();
  const [open, setOpen] = useState(false);

  // Tek dil (yalnızca Türkçe) aktifse seçiciyi gösterme.
  if (locales.length <= 1) return null;

  return (
    <div className="relative z-50 shrink-0">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("chooseLanguage")}
        className="relative z-50 flex h-9 w-9 items-center justify-center rounded-full border border-line/50 bg-paper/90 font-display text-xs font-bold text-ink shadow-xs transition-colors hover:bg-crema active:scale-95"
      >
        {localeCodes[locale]}
      </button>
      {open && (
        <div className="pop-in absolute end-0 top-11 z-50 min-w-[10rem] origin-top-right overflow-hidden rtl:origin-top-left rounded-2xl border border-line/60 bg-paper shadow-xl backdrop-blur-md">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 whitespace-nowrap px-4 py-2.5 font-display text-sm hover:bg-crema/60"
              style={l === locale ? { color: "var(--brand-text)", fontWeight: 700 } : undefined}
            >
              <span className="font-mono text-xs font-bold uppercase tracking-wider">{localeCodes[l]}</span>
              <span>{localeLabels[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MenuProvider({
  business,
  popup,
  basePath,
  initialCategories,
  initialProducts,
  hasWebsite = false,
  children,
}: {
  business: Business;
  popup: Popup | null;
  basePath: string;
  /** Web sitesi yayında mı (sunucuda lib/storefront.ts ile hesaplanır). */
  hasWebsite?: boolean;
  /** Sunucuda çekilen menü verisi — ilk boyamada hazır (bkz. app/[slug]/layout.tsx). */
  initialCategories: Category[];
  initialProducts: Product[];
  children: ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pickerOptions, setPickerOptions] = useState<ProductOption[]>([]);
  const [popupDismissed, setPopupDismissed] = useState(true);
  // İlk ziyarette (henüz dil seçilmemişken, birden çok dil varsa) dil modalı gösterilir.
  const [needsLangChoice, setNeedsLangChoice] = useState(false);
  const [locale, setLocaleState] = useState<Locale>(() => mainLocale(business));
  const [categories] = useState<Category[]>(initialCategories);
  const [products] = useState<Product[]>(initialProducts);
  const categoriesLoading = false;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const openInfo = useCallback(() => setInfoOpen(true), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  // Sepete ekleme sonrası "yanına içecek" önerisi — oturum başına bir kez.
  const [upsell, setUpsell] = useState<{ addedName: string; items: Product[] } | null>(null);
  // Seçenekli bir ürün öneriden eklenirse, seçim penceresi onaylanınca kaynak korunur.
  const [pickerSource, setPickerSource] = useState<AddSource>("menu");
  const closeUpsell = useCallback(() => setUpsell(null), []);

  useEffect(() => {
    setCart(loadCart(business.slug));
  }, [business.slug]);

  const imageByCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (!map.has(p.category) && p.images?.[0]) map.set(p.category, p.images[0]);
    }
    return map;
  }, [products]);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.category, (map.get(p.category) ?? 0) + 1);
    }
    return map;
  }, [products]);

  // Ürünü olmayan (ya da tüm ürünleri satış dışı) kategoriler müşteriye
  // gösterilmez: sektör şablonuyla açılıp henüz doldurulmamış kategoriler
  // menüyü yarım gibi göstermesin.
  const visibleCategories = useMemo(
    () => categories.filter((category) => (productCountByCategory.get(category.id) ?? 0) > 0),
    [categories, productCountByCategory]
  );

  const baseLocale = mainLocale(business);
  const locales = useMemo(() => activeLocales(business), [business]);

  // Ziyaretçinin kayıtlı dili bu menüde yoksa (başka bir işletmede seçilmiş ya
  // da işletme dili kapatmış olabilir) ana dile düşülür ve — birden çok dil
  // varsa — dil seçim modalı yeniden açılır: Almanca seçmiş misafir Almancası
  // olmayan menüde sessizce Türkçeye düşmesin, kendi seçsin.
  useEffect(() => {
    const stored = getStoredLocale();
    const available = hasStoredLocale() && locales.includes(stored);
    setLocaleState(available ? stored : baseLocale);
    if (locales.length > 1 && !available) setNeedsLangChoice(true);
  }, [locales, baseLocale]);

  function setLocale(next: Locale) {
    if (next !== locale) {
      trackEvent(business.slug, {
        type: "language_change",
        target: next,
        label: `${locale} → ${next}`,
        locale: next,
        meta: { from: locale, to: next },
      });
    }
    setLocaleState(next);
    storeLocale(next);
  }

  function chooseLanguage(next: Locale) {
    setLocale(next);
    setNeedsLangChoice(false);
  }

  function t(key: UIKey, vars?: Record<string, string | number>) {
    return translate(locale, key, vars);
  }

  function tf(entity: Translatable, field: TranslatableField) {
    return tField(entity, field, locale, baseLocale);
  }

  useEffect(() => {
    if (!popup) return;
    const key = `buyur-popup-${business.slug}-${popup.id}`;
    if (!sessionStorage.getItem(key) && isPopupInWindow(popup)) {
      setPopupDismissed(false);
    }
  }, [popup, business.slug]);

  function dismissPopup() {
    if (popup) {
      sessionStorage.setItem(`buyur-popup-${business.slug}-${popup.id}`, "1");
      // Kampanya modalındaki tek aksiyon "menüyü gör" — kapatma bu yüzden
      // tıklama sayılıyor (gösterim campaign_view ile ayrı kaydediliyor).
      trackEvent(business.slug, {
        type: "campaign_click",
        target: popup.id,
        label: popup.title,
        popupId: popup.id,
        locale,
      });
    }
    setPopupDismissed(true);
  }

  // Kampanya gösterimi: modal gerçekten ekrana geldiğinde, oturum başına bir kez.
  const popupVisible = Boolean(popup) && !popupDismissed && !needsLangChoice;
  useEffect(() => {
    if (!popup || !popupVisible) return;
    trackOnce(`campaign_view:${popup.id}`, () => {
      trackEvent(business.slug, {
        type: "campaign_view",
        target: popup.id,
        label: popup.title,
        popupId: popup.id,
        locale,
      });
    });
  }, [popup, popupVisible, business.slug, locale]);

  function persistCart(next: CartLine[]) {
    setCart(next);
    saveCart(business.slug, next);
  }

  function addToCart(product: Product, selections: CartSelection[], quantity: number, source: AddSource = "menu") {
    const key = lineKey(product.id, selections);
    const unitPrice = unitPriceFor(product, selections);
    const existing = cart.find((l) => l.key === key);
    const next = existing
      ? cart.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
      : [...cart, { key, productId: product.id, name: tf(product, "name"), unitPrice, quantity, selections }];
    persistCart(next);
    trackEvent(business.slug, {
      type: "add_to_cart",
      target: product.id,
      label: product.name,
      productId: product.id,
      locale,
      // Öneriden gelen eklemeler ayrışsın: upsell'in işe yarayıp yaramadığı ölçülür.
      meta: source === "upsell" ? { quantity, source } : { quantity },
    });
    if (source === "menu") offerUpsell(product, next);
  }

  /** "Yanına içecek" önerisi: oturum başına en fazla bir kez, yalnızca menüde
   *  içecek kategorisi varsa ve sepette henüz içecek yoksa. */
  function offerUpsell(product: Product, lines: CartLine[]) {
    const storageKey = `buyur-upsell-${business.slug}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
    } catch {
      /* sessionStorage kapalı: yine de bir kez göstermeyi deneriz */
    }
    const items = upsellSuggestions({
      added: product,
      categories,
      products,
      cartProductIds: lines.map((line) => line.productId),
    });
    if (items.length === 0) return;
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      /* yoksay */
    }
    setUpsell({ addedName: tf(product, "name"), items });
  }

  function track(payload: TrackPayload) {
    trackEvent(business.slug, { locale, ...payload });
  }

  async function addProduct(product: Product, source: AddSource = "menu") {
    const options = await pb.collection("buyur_product_options").getFullList<ProductOption>({
      filter: pb.filter("product = {:id}", { id: product.id }),
      requestKey: null,
      sort: "order,created",
    });
    if (options.length === 0) {
      addToCart(product, [], 1, source);
    } else {
      setPickerOptions(options);
      setPickerSource(source);
      setPickerProduct(product);
    }
  }

  function trackRemoval(key: string) {
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    trackEvent(business.slug, {
      type: "remove_from_cart",
      target: line.productId,
      label: line.name,
      productId: line.productId,
      locale,
    });
  }

  function updateQuantity(key: string, quantity: number) {
    if (quantity <= 0) trackRemoval(key);
    const next =
      quantity <= 0 ? cart.filter((l) => l.key !== key) : cart.map((l) => (l.key === key ? { ...l, quantity } : l));
    persistCart(next);
  }

  function removeLine(key: string) {
    trackRemoval(key);
    persistCart(cart.filter((l) => l.key !== key));
  }

  // Marka rengi, yazı tipi ve menü zemini (lib/brand-style.ts): vitrinle aynı
  // kimlik. Zemin tonu Tailwind renk token'larını menü kapsamında ezer.
  const brandStyle = {
    ...businessBrandStyle(business, { surface: true }),
    "--header-h": "4.75rem",
  } as CSSProperties;

  return (
    <MenuContext.Provider
      value={{
        business,
        base: basePath,
        cartLines: cart,
        addProduct,
        updateQuantity,
        removeLine,
        track,
        locale,
        setLocale,
        locales,
        t,
        tf,
        categories: visibleCategories,
        products,
        categoriesLoading,
        imageByCategory,
        productCountByCategory,
        openInfo,
        // Vitrin kökü: alt alan adında "/", kök alan yolunda /site/{slug}.
        websiteHref: hasWebsite ? (basePath ? `/site/${business.slug}` : "/") : null,
      }}
    >
      <div
        lang={locale}
        dir={isRTLLocale(locale) ? "rtl" : "ltr"}
        style={brandStyle}
        // text-ink şart: renk token'ları bu kökte ezildiği halde body'nin rengi
        // global (açık tema) mürekkepten hesaplanıp miras kalıyordu — koyu
        // yüzeylerde renk sınıfı olmayan her metin (kategori başlıkları, dil
        // listesi…) zemine gömülüyordu.
        className="min-h-dvh bg-paper pb-28 sm:pb-32 text-ink"
      >
        <MenuSplash />
        <TrackPageViews business={business} base={basePath} locale={locale} />
        {/* İlk açılışta önce dil seçimi; dil modalı kapanınca kampanya popup'ı gösterilir. */}
        {needsLangChoice && <LanguageModal onPick={chooseLanguage} />}
        {popup && popupVisible && <PopupModal popup={popup} onClose={dismissPopup} />}
        {pickerProduct && (
          <OptionPicker
            product={pickerProduct}
            options={pickerOptions}
            onClose={() => setPickerProduct(null)}
            onConfirm={(selections, quantity) => {
              addToCart(pickerProduct, selections, quantity, pickerSource);
              setPickerProduct(null);
              setPickerSource("menu");
            }}
          />
        )}

        <MenuHeader business={business} base={basePath} />
        {drawerOpen && <CategoryDrawer onClose={() => setDrawerOpen(false)} />}
        {infoOpen && <BusinessInfoSheet business={business} onClose={closeInfo} />}
        <main className="mx-auto max-w-3xl">
          <PageTransition>{children}</PageTransition>
        </main>
        <MenuFooter base={basePath} products={products} locale={locale} />

        <CartBar lines={cart} base={basePath} />
        {upsell && (
          <UpsellSheet
            addedName={upsell.addedName}
            items={upsell.items}
            onAdd={(product) => {
              setUpsell(null);
              addProduct(product, "upsell");
            }}
            onClose={closeUpsell}
          />
        )}
        <BottomNav base={basePath} />
      </div>
    </MenuContext.Provider>
  );
}
