"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ClientResponseError } from "pocketbase";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { uploadFile, type UploadKind } from "@/lib/upload";
import { isReservedSlug, slugify } from "@/lib/slug";
import { themes } from "@/lib/themes";
import { surfaces, DEFAULT_SURFACE } from "@/lib/surfaces";
import { isValidHex } from "@/lib/color";
import { fonts, DEFAULT_FONT, getFontStack } from "@/lib/fonts";
import { ROOT_DOMAIN } from "@/lib/site";
import { checkBusinessPhone } from "@/lib/phone";
import { BUSINESS_COLLECTION, contactEmailPatch, publicContactEmail } from "@/lib/business-account";
import { highlightLabels } from "@/lib/labels";
import { brandStyle } from "@/lib/brand-style";
import { MARQUEE_MAX_ITEMS, MARQUEE_MAX_ITEM_LENGTH, parseMarqueeText } from "@/lib/marquee";
import { guidePatch, isGuideEnabled } from "@/lib/guide";
import { msg, UI_LOCALES, uiLocaleLabels } from "@/lib/ui-i18n";
import {
  HighlightIcon,
  InfoIcon,
  LanguagesIcon,
  MapPinIcon,
  MarqueeIcon,
  MonitorIcon,
  PaletteIcon,
  ShareIcon,
  StarIcon,
} from "@/components/icons";
import {
  Button,
  Card,
  FORM_STACK,
  FormActions,
  Input,
  Label,
  PageHeader,
  SECTION_LAYOUT,
  SectionNav,
  Select,
  Spinner,
  Switch,
  Textarea,
} from "@/components/panel/ui";
import { MultiLangFields } from "@/components/panel/multi-lang-fields";
import { useToast } from "@/components/panel/toast";
import { GuideButton } from "@/components/panel/guide";
import { Marquee } from "@/components/marquee";
import { useUiLocale } from "@/components/ui-locale-provider";
import {
  activeNonMainLocales,
  isSupportedLocale,
  localeCodes,
  localeLabels,
  mainLocale,
  MAX_MENU_LOCALES,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from "@/lib/i18n";
import {
  applyRebasePatches,
  buildRebasePatches,
  BUSINESS_REBASE_FIELDS,
  rebaseEntity,
  type RebasePatch,
} from "@/lib/language-rebase";
import type { Business, Highlight, Template } from "@/lib/types";

const ALL_HIGHLIGHTS = Object.keys(highlightLabels.tr) as Highlight[];

type SettingsTab = "genel" | "diller" | "tema" | "yazi" | "ozellik" | "iletisim" | "sosyal" | "panel";
const ICON = { size: 17 } as const;
const SETTINGS_TABS: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: "genel", label: msg("Genel bilgiler"), icon: <InfoIcon {...ICON} /> },
  { key: "diller", label: msg("Menü dilleri"), icon: <LanguagesIcon {...ICON} /> },
  { key: "tema", label: msg("Tema"), icon: <PaletteIcon {...ICON} /> },
  { key: "yazi", label: msg("Kayan yazı"), icon: <MarqueeIcon {...ICON} /> },
  { key: "ozellik", label: msg("Mekân özellikleri"), icon: <StarIcon {...ICON} /> },
  { key: "iletisim", label: msg("Adres & iletişim"), icon: <MapPinIcon {...ICON} /> },
  { key: "sosyal", label: msg("Sosyal medya"), icon: <ShareIcon {...ICON} /> },
  { key: "panel", label: msg("Panel"), icon: <MonitorIcon {...ICON} /> },
];

const isSettingsTab = (value: string | null): value is SettingsTab =>
  SETTINGS_TABS.some((tab) => tab.key === value);

/** Adres çubuğundaki ?tab= bölümü açar (kılavuz ve bağlantılar bu yolla bir
 *  bölüme götürür). useSearchParams Suspense içinde olmalı. */
function TabFromUrl({ onTab }: { onTab: (tab: SettingsTab) => void }) {
  const params = useSearchParams();
  const requested = params.get("tab");
  useEffect(() => {
    if (isSettingsTab(requested)) onTab(requested);
  }, [requested, onTab]);
  return null;
}

function ProfileImages({
  businessId,
  logoUrl,
  coverUrl,
  onLogo,
  onCover,
}: {
  businessId: string;
  logoUrl: string;
  coverUrl: string;
  onLogo: (url: string) => void;
  onCover: (url: string) => void;
}) {
  const { t } = useUiLocale();
  const { toast } = useToast();
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  async function upload(
    files: FileList | null,
    kind: UploadKind,
    setBusy: (b: boolean) => void,
    onChange: (url: string) => void
  ) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadFile(file, businessId, kind));
    } catch (err) {
      toast(err instanceof Error ? t(err.message) : t("Görsel yüklenemedi, tekrar dene."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-2">
      {/* Kapak */}
      <div className="relative h-36 w-full overflow-hidden rounded-md border border-line bg-crema/40 sm:h-44">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={t("Kapak")} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-soft">{t("Kapak görseli yok")}</div>
        )}
        {coverBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <Spinner className="h-7 w-7 text-paper" />
          </div>
        )}
        {!coverBusy && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/0 text-transparent transition-colors hover:bg-ink/40 hover:text-paper">
            <span className="text-xs font-medium">
              {coverUrl ? t("Kapağı değiştir") : t("Kapak yükle")}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(e) => upload(e.target.files, "cover", setCoverBusy, onCover)}
            />
          </label>
        )}
      </div>

      {/* Logo — kapağın sol altına biner */}
      <div className="relative z-10 -mt-12 ml-5 h-24 w-24">
        <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-paper bg-crema shadow-md">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={t("Logo")} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-[10px] leading-tight text-ink-soft">
              {t("Logo yok")}
            </div>
          )}
          {logoBusy && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
              <Spinner className="h-6 w-6 text-paper" />
            </div>
          )}
          {!logoBusy && (
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/0 text-transparent transition-colors hover:bg-ink/50 hover:text-paper">
              <span className="text-[11px] font-medium">{t("Değiştir")}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(e) => upload(e.target.files, "logo", setLogoBusy, onLogo)}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/** Formun kayıttan türetilen değerleri. Hem ilk değer hem "kaydedilmemiş
 *  değişiklik" karşılaştırmasının tabanı buradan gelir; kayıttan sonra form
 *  da bununla tazelenir ki kayıtlı hâl ile form birebir aynı olsun. */
function settingsValues(business: Business) {
  return {
    name: business.name,
    slug: business.slug,
    description: business.description,
    // Menüde görünen e-posta: ayrı bir iletişim adresi ya da (görünürlüğü
    // açıksa) giriş e-postası. Tek kaynak kuralı lib/business-account.ts'te.
    email: publicContactEmail(business),
    phone: business.phone,
    address: business.address,
    workingHours: business.working_hours,
    highlights: business.highlights ?? [],
    whatsapp: business.whatsapp,
    instagram: business.instagram,
    tiktok: business.tiktok,
    youtube: business.youtube,
    facebook: business.facebook,
    googleMapsUrl: business.google_maps_url,
    googleReviewUrl: business.google_review_url,
    wifiPassword: business.wifi_password,
    theme: business.theme || "paprika",
    themeColor: business.theme_color || "",
    menuBg: business.menu_bg || DEFAULT_SURFACE,
    font: business.font || DEFAULT_FONT,
    logoUrl: business.logo_url,
    coverUrl: business.cover_url,
    marqueeEnabled: Boolean(business.marquee_enabled),
    marqueeText: business.marquee_text ?? "",
    mainLang: mainLocale(business),
    // Ana dil dışındaki aktif ek diller.
    languages: activeNonMainLocales(business),
    translations: business.translations ?? {},
  };
}

type SettingsValues = ReturnType<typeof settingsValues>;

/** Karşılaştırma için sıradan bağımsız dil listesi: aynı diller farklı
 *  sırayla açılıp kapandıysa değişiklik sayılmaz. */
function comparable(values: SettingsValues): string {
  const order = (l: Locale) => SUPPORTED_LOCALES.indexOf(l);
  return JSON.stringify({ ...values, languages: [...values.languages].sort((a, b) => order(a) - order(b)) });
}

export default function SettingsPage() {
  const { business, isLoading, setBusiness } = useBusiness();
  const { t } = useUiLocale();

  if (isLoading || !business) {
    return <p className="text-ink-soft">{t("Yükleniyor…")}</p>;
  }

  return <SettingsForm business={business} onSaved={setBusiness} />;
}

/** Panel tercihleri: arayüz dili ve kılavuz. Menüyü değil paneli etkiledikleri
 *  için formun kaydet akışına girmez, seçildiği an uygulanır ve kaydedilir. */
function PanelPreferences({ business, onSaved }: { business: Business; onSaved: (b: Business) => void }) {
  const { t, locale, setLocale } = useUiLocale();
  const { toast } = useToast();
  const [guideBusy, setGuideBusy] = useState(false);
  const guideOn = isGuideEnabled(business);

  async function changeLocale(next: (typeof UI_LOCALES)[number]) {
    if (next === locale) return;
    setLocale(next);
    try {
      onSaved(await pb.collection(BUSINESS_COLLECTION).update<Business>(business.id, { ui_locale: next }));
    } catch {
      /* dil bu cihazda değişti; hesaba yazılamadıysa sonraki seçimde tekrar denenir */
    }
  }

  async function toggleGuide(enabled: boolean) {
    setGuideBusy(true);
    try {
      const updated = await pb
        .collection(BUSINESS_COLLECTION)
        .update<Business>(business.id, { guide: guidePatch(business, { enabled }) });
      onSaved(updated);
      toast(enabled ? t("Kılavuz açıldı") : t("Kılavuz kapatıldı"));
    } catch {
      toast(t("Kaydedilemedi, tekrar dene."), "error");
    } finally {
      setGuideBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <p className="text-xs font-medium text-ink-soft">{t("Panel dili")}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {t("Panelin arayüz dili. Menünüzün dilleri “Menü dilleri” bölümünden ayrı yönetilir.")}
          </p>
        </div>
        <Select
          aria-label={t("Panel dili")}
          value={locale}
          onChange={(e) => {
            const next = UI_LOCALES.find((option) => option === e.target.value);
            if (next) void changeLocale(next);
          }}
          className="sm:max-w-xs"
        >
          {UI_LOCALES.map((option) => (
            <option key={option} value={option} lang={option}>
              {uiLocaleLabels[option]}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="space-y-4">
        <Switch
          checked={guideOn}
          onChange={toggleGuide}
          label={t("Kılavuz")}
          description={
            guideOn
              ? t("Açık: yeni işletmelerde panel ilk açıldığında adım adım tanıtım başlar; istediğiniz an yeniden başlatabilirsiniz.")
              : t("Kapalı: kılavuz kendiliğinden gösterilmez. Açtığınızda isterseniz yeniden başlatabilirsiniz.")
          }
        />
        {guideBusy && <Spinner className="h-4 w-4 text-ink-soft" />}
        {guideOn && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">
              {business.guide?.completed_at
                ? t("Kılavuzu tamamladınız. Tekrar gezmek isterseniz baştan başlatabilirsiniz.")
                : t("Paneli adım adım gezin: bilgiler, görseller, kategoriler, ürünler, tema, web sitesi ve paylaşım.")}
            </p>
            <GuideButton variant="button" />
          </div>
        )}
      </Card>
      <p className="text-xs text-ink-soft">{t("Bu bölümdeki ayarlar seçildiği an kaydedilir.")}</p>
    </div>
  );
}

function SettingsForm({ business, onSaved }: { business: Business; onSaved: (b: Business) => void }) {
  const { t, locale: uiLocale, tag } = useUiLocale();
  const initial = settingsValues(business);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [description, setDescription] = useState(initial.description);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [workingHours, setWorkingHours] = useState(initial.workingHours);
  const [highlights, setHighlights] = useState<Highlight[]>(initial.highlights);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [tiktok, setTiktok] = useState(initial.tiktok);
  const [youtube, setYoutube] = useState(initial.youtube);
  const [facebook, setFacebook] = useState(initial.facebook);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initial.googleMapsUrl);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(initial.googleReviewUrl);
  const [wifiPassword, setWifiPassword] = useState(initial.wifiPassword);
  const [theme, setTheme] = useState(initial.theme);
  const [themeColor, setThemeColor] = useState(initial.themeColor);
  const [menuBg, setMenuBg] = useState(initial.menuBg);
  const [font, setFont] = useState(initial.font);
  const template: Template = "liste";
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [marqueeEnabled, setMarqueeEnabled] = useState(initial.marqueeEnabled);
  const [marqueeText, setMarqueeText] = useState(initial.marqueeText);
  const [mainLang, setMainLang] = useState<Locale>(initial.mainLang);
  const [languages, setLanguages] = useState<Locale[]>(initial.languages);
  const [translations, setTranslations] = useState<Translations>(initial.translations);
  const [tab, setTab] = useState<SettingsTab>("genel");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { toast } = useToast();

  const current: SettingsValues = {
    name,
    slug,
    description,
    email,
    phone,
    address,
    workingHours,
    highlights,
    whatsapp,
    instagram,
    tiktok,
    youtube,
    facebook,
    googleMapsUrl,
    googleReviewUrl,
    wifiPassword,
    theme,
    themeColor,
    menuBg,
    font,
    logoUrl,
    coverUrl,
    marqueeEnabled,
    marqueeText,
    mainLang,
    languages,
    translations,
  };
  const currentJson = comparable(current);
  const baselineJson = useMemo(() => comparable(settingsValues(business)), [business]);
  const dirty = currentJson !== baselineJson;

  // Kullanıcı formu düzelttikçe eski hata çubukta asılı kalmasın.
  useEffect(() => {
    setError("");
  }, [currentJson]);

  /** Kayıttan sonra form kayıtlı hâle eşitlenir (ör. adres slug'a çevrildi). */
  function applyValues(values: SettingsValues) {
    setName(values.name);
    setSlug(values.slug);
    setDescription(values.description);
    setEmail(values.email);
    setPhone(values.phone);
    setAddress(values.address);
    setWorkingHours(values.workingHours);
    setHighlights(values.highlights);
    setWhatsapp(values.whatsapp);
    setInstagram(values.instagram);
    setTiktok(values.tiktok);
    setYoutube(values.youtube);
    setFacebook(values.facebook);
    setGoogleMapsUrl(values.googleMapsUrl);
    setGoogleReviewUrl(values.googleReviewUrl);
    setWifiPassword(values.wifiPassword);
    setTheme(values.theme);
    setThemeColor(values.themeColor);
    setMenuBg(values.menuBg);
    setFont(values.font);
    setLogoUrl(values.logoUrl);
    setCoverUrl(values.coverUrl);
    setMarqueeEnabled(values.marqueeEnabled);
    setMarqueeText(values.marqueeText);
    setMainLang(values.mainLang);
    setLanguages(values.languages);
    setTranslations(values.translations);
  }

  // Kaydedilmiş (veritabanındaki) ana dil — içerik taşımasının kaynağı budur.
  const savedMainLang = mainLocale(business);
  const mainLangChanged = mainLang !== savedMainLang;

  // Yarıda kalan bir taşımadan artan güncellemeler. Yeniden hesaplamak yerine
  // bunları tekrar denemek gerekir; aksi hâlde taşınmış kayıtlar ikinci kez taşınır.
  const pendingRebase = useRef<{ from: Locale; to: Locale; patches: RebasePatch[] } | null>(null);

  // Ana dili değiştirince o dil ek diller listesinden çıkar, eski ana dil ise
  // ek dil olarak açık kalır (metinleri oraya taşınacağı için erişilebilir olmalı).
  function changeMainLang(next: Locale) {
    if (next === mainLang) return;
    const previous = mainLang;
    setMainLang(next);
    setLanguages((prev) => {
      const kept = prev.filter((l) => l !== next);
      return kept.includes(previous) ? kept : [...kept, previous];
    });
  }

  // Ana dil dahil en fazla MAX_MENU_LOCALES dil açık olabilir.
  const localeSlotsFull = languages.length + 1 >= MAX_MENU_LOCALES;

  function addLanguage(l: Locale) {
    setLanguages((prev) => (prev.includes(l) || l === mainLang || prev.length + 1 >= MAX_MENU_LOCALES ? prev : [...prev, l]));
  }

  function removeLanguage(l: Locale) {
    setLanguages((prev) => prev.filter((x) => x !== l));
  }

  /** Ana dil yapılabilir mi? Açık bir dil her zaman olur (yer değiştirir);
   *  kapalı bir dil ise eski ana dil ek dil olarak kalacağı için bir yer ister. */
  function canBecomeMain(l: Locale) {
    return l === mainLang || languages.includes(l) || !localeSlotsFull;
  }

  function toggleHighlight(h: Highlight) {
    setHighlights((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }

  function selectTab(next: SettingsTab) {
    setTab(next);
    // Bölüm adres çubuğunda dursun (paylaşılabilir, yenilenince aynı bölüm
    // açılır). history.replaceState sayfayı yeniden yüklemez; açık form korunur.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (isReservedSlug(slugify(slug))) {
      setError(t("Bu menü adresi sisteme ayrılmış, başka bir tane seç."));
      return;
    }
    // Numaralar tek biçimde saklanır ki menüdeki arama/WhatsApp bağlantıları kırılmasın.
    const phoneCheck = checkBusinessPhone(phone);
    const whatsappCheck = checkBusinessPhone(whatsapp);
    if (!phoneCheck.ok || !whatsappCheck.ok) {
      const message = !phoneCheck.ok
        ? t("Telefon: {error}", { error: t(phoneCheck.error) })
        : t("WhatsApp: {error}", { error: !whatsappCheck.ok ? t(whatsappCheck.error) : "" });
      selectTab(!phoneCheck.ok ? "genel" : "sosyal");
      setError(message);
      toast(message, "error");
      return;
    }
    if (languages.length + 1 > MAX_MENU_LOCALES) {
      const message = t("Menüde en fazla {max} dil açık olabilir.", { max: MAX_MENU_LOCALES });
      selectTab("diller");
      setError(message);
      toast(message, "error");
      return;
    }
    setSaving(true);
    try {
      // Ana dil değiştiyse önce menü içeriği (kategori/ürün/seçenek/popup) yeni
      // baz dile taşınır; ancak hepsi başarılı olursa main_language yazılır.
      // Böylece taşıma yarıda kalırsa kayıtlar eski ana dille tutarlı kalır.
      let baseDescription = description;
      let baseMarquee = marqueeText;
      let baseTranslations = translations;

      if (mainLangChanged) {
        const cached = pendingRebase.current;
        const patches =
          cached && cached.from === savedMainLang && cached.to === mainLang
            ? cached.patches
            : await buildRebasePatches(pb, business.id, savedMainLang, mainLang);

        const failed = await applyRebasePatches(pb, patches);
        if (failed.length > 0) {
          pendingRebase.current = { from: savedMainLang, to: mainLang, patches: failed };
          const message = t("{count} kayıt yeni ana dile taşınamadı. Ana dil değişmedi; tekrar kaydet.", {
            count: failed.length,
          });
          setError(message);
          toast(message, "error");
          return;
        }
        pendingRebase.current = null;

        const rebased = rebaseEntity(
          { description, marquee_text: marqueeText, translations },
          BUSINESS_REBASE_FIELDS,
          savedMainLang,
          mainLang
        );
        baseDescription = rebased.base.description ?? "";
        baseMarquee = rebased.base.marquee_text ?? "";
        baseTranslations = rebased.translations;
      }

      const updated = await pb.collection(BUSINESS_COLLECTION).update<Business>(business.id, {
        name,
        slug: slugify(slug),
        description: baseDescription,
        ...contactEmailPatch(email, business.email),
        phone: phoneCheck.value,
        address,
        working_hours: workingHours,
        highlights,
        whatsapp: whatsappCheck.value,
        instagram,
        tiktok,
        youtube,
        facebook,
        google_maps_url: googleMapsUrl,
        google_review_url: googleReviewUrl,
        wifi_password: wifiPassword,
        theme,
        theme_color: isValidHex(themeColor) ? themeColor : "",
        menu_bg: menuBg,
        font,
        template,
        logo_url: logoUrl,
        cover_url: coverUrl,
        marquee_enabled: marqueeEnabled,
        marquee_text: baseMarquee,
        main_language: mainLang,
        languages,
        translations: baseTranslations,
      });
      // Form kayıtlı hâle eşitlenir: taşınan metinler, düzenlenen telefon ve
      // slug'a çevrilen adres dahil. "Kaydedilmemiş değişiklik" kalmaz.
      applyValues(settingsValues(updated));
      onSaved(updated);
      setSavedAt(Date.now());
      toast(mainLangChanged ? t("Ayarlar kaydedildi, içerik yeni ana dile taşındı") : t("Ayarlar kaydedildi"));
    } catch (err) {
      if (err instanceof ClientResponseError && err.response?.data?.slug) {
        setError(t("Bu adres başka bir işletme tarafından kullanılıyor."));
        toast(t("Bu adres başka bir işletme tarafından kullanılıyor."), "error");
      } else {
        setError(t("Kaydedilemedi, tekrar dene."));
        toast(t("Kaydedilemedi, tekrar dene."), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  // Tema önizlemesi için etkin değerler
  const brandIsCustom = isValidHex(themeColor);
  const brandPreview = brandIsCustom ? themeColor : themes[theme as keyof typeof themes]?.color ?? themes.paprika.color;
  const surfacePreview = surfaces[menuBg as keyof typeof surfaces] ?? surfaces[DEFAULT_SURFACE];

  const registeredAt = new Date(business.created).toLocaleDateString(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Çeviri girilen diller: kayıtlı ana dil ilk sırada (bkz. MultiLangFields notu).
  const editLocales = [
    savedMainLang,
    ...SUPPORTED_LOCALES.filter((l) => l !== savedMainLang && (l === mainLang || languages.includes(l))),
  ];

  // Kayan yazı önizlemesi: ana dildeki metinden, işletmenin marka rengiyle.
  const marqueeItems = parseMarqueeText(marqueeText);
  const marqueeLines = marqueeText.split(/\r?\n/).filter((line) => line.trim()).length;

  return (
    <div>
      <Suspense fallback={null}>
        <TabFromUrl onTab={setTab} />
      </Suspense>
      <PageHeader title={t("İşletme ayarları")} description={t("Menünün görünümünü ve bilgilerini düzenle.")} />
      <div className={SECTION_LAYOUT}>
      <SectionNav
        items={SETTINGS_TABS.map((item) => ({ key: item.key, label: t(item.label), icon: item.icon }))}
        active={tab}
        onChange={selectTab}
        label={t("Ayar bölümleri")}
      />
      <div className="min-w-0">
      <form onSubmit={handleSubmit} className={FORM_STACK}>
        {tab !== "panel" && (
          <FormActions saving={saving} dirty={dirty} savedAt={savedAt ?? business.updated ?? null} error={error || undefined} />
        )}

        {tab === "genel" && (
          <div className="space-y-8">
            {/* Kapak + logo başlığı */}
            <Card className="space-y-4" data-guide="settings-images">
              <ProfileImages
                businessId={business.id}
                logoUrl={logoUrl}
                coverUrl={coverUrl}
                onLogo={setLogoUrl}
                onCover={setCoverUrl}
              />
            </Card>

            {/* Genel bilgiler */}
            <Card className="space-y-4" data-guide="settings-info">
              <p className="text-xs font-medium text-ink-soft">
                {t("Kayıt tarihi: {date}", { date: registeredAt })}
              </p>
              <div>
                <Label htmlFor="b-name">{t("İşletme adı")}</Label>
                <Input id="b-name" required value={name} onChange={(e) => setName(e.target.value)} />
                <p className="mt-1.5 text-xs text-ink-soft">{t("İşletme adı tekildir, tüm dillerde aynı görünür.")}</p>
              </div>
              <div>
                <Label htmlFor="b-slug">{t("Menü adresi")}</Label>
                <div className="flex items-center gap-1 rounded-md border border-line bg-crema/40 px-4 py-2.5 text-sm">
                  <input
                    id="b-slug"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-right text-ink outline-none"
                  />
                  <span className="shrink-0 text-ink-soft">.{ROOT_DOMAIN}</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {t("Adresi değiştirirsen eski QR kodların çalışmaz, yeniden bastırman gerekir.")}
                </p>
              </div>
              {/* Ana dil değişikliği kaydedilene kadar metinler KAYITLI ana dile
                  göre düzenlenir: baz alan hâlâ o dilin metnidir. Yeni ana dili
                  "Ana" diye göstermek, oraya yazılan metni kayıttaki taşımada
                  eski dilin kutusuna gönderirdi (diller birbirini ezerdi). */}
              <MultiLangFields
                locales={editLocales}
                mainLocale={savedMainLang}
                base={{ description }}
                onBaseChange={(_, v) => setDescription(v)}
                translations={translations}
                onTranslationsChange={setTranslations}
                title={t("İşletme açıklaması")}
                translate={{ business, kind: "business", fields: { description } }}
                fields={[{ key: "description", label: t("Açıklama"), multiline: true }]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="b-email">{t("Menüde görünen e-posta")}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merhaba@isletme.com"
                  />
                </div>
                <div>
                  <Label htmlFor="b-phone">{t("Telefon")}</Label>
                  <Input
                    id="b-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0532 123 45 67"
                  />
                </div>
              </div>
              <p className="text-xs text-ink-soft">
                {t(
                  "Bu bilgiler vitrininizde ve menüdeki “İşletme bilgileri” bölümünde müşterilere görünür. E-posta boşsa gösterilmez; giriş e-postanı yazarsan onu gösteririz."
                )}
                {business.email ? ` (${business.email})` : ""}
              </p>
            </Card>
          </div>
        )}

        {tab === "diller" && (
          <Card className="space-y-6">
            <div>
              <p className="text-xs font-medium text-ink-soft">{t("Menü dilleri")}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {t(
                  "Ana dil, metinleri girdiğiniz dildir ve her zaman açıktır. Misafirleriniz için ana dil dahil en fazla {max} dil açabilirsiniz.",
                  { max: MAX_MENU_LOCALES }
                )}
              </p>
            </div>

            <div>
              <Label htmlFor="b-main-lang">{t("Ana dil")}</Label>
              <Select
                id="b-main-lang"
                value={mainLang}
                onChange={(e) => isSupportedLocale(e.target.value) && changeMainLang(e.target.value)}
                className="sm:max-w-xs"
              >
                {SUPPORTED_LOCALES.map((l) => (
                  <option key={l} value={l} lang={l} disabled={!canBecomeMain(l)}>
                    {localeLabels[l]} ({localeCodes[l]})
                  </option>
                ))}
              </Select>
              {localeSlotsFull && (
                <p className="mt-1.5 text-xs text-ink-soft">
                  {t("Kapalı bir dili ana dil yapmak için önce bir ek dili kaldırın.")}
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-ink-soft">{t("Açık diller")}</p>
                <p className="font-mono text-[11px] text-ink-soft">
                  {t("{count}/{max} dil", { count: languages.length + 1, max: MAX_MENU_LOCALES })}
                </p>
              </div>
              <ul className="divide-y divide-line rounded-md border border-line">
                {[mainLang, ...languages].map((l) => {
                  const isMain = l === mainLang;
                  return (
                    <li key={l} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="w-7 shrink-0 text-xs font-bold text-ink-soft">
                        {localeCodes[l]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" lang={l}>
                        {localeLabels[l]}
                      </span>
                      {isMain ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-paprika">
                          <StarIcon filled size={13} /> {t("Ana dil")}
                        </span>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLanguage(l)} aria-label={t("{language} dilini kapat", { language: localeLabels[l] })}>
                          {t("Kaldır")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <Label htmlFor="b-add-lang">{t("Dil ekle")}</Label>
              <Select
                id="b-add-lang"
                value=""
                disabled={localeSlotsFull}
                onChange={(e) => isSupportedLocale(e.target.value) && addLanguage(e.target.value)}
                className="sm:max-w-xs"
              >
                <option value="">{localeSlotsFull ? t("Dil sınırına ulaşıldı") : t("Dil seçin…")}</option>
                {SUPPORTED_LOCALES.filter((l) => l !== mainLang && !languages.includes(l)).map((l) => (
                  <option key={l} value={l} lang={l}>
                    {localeLabels[l]} ({localeCodes[l]})
                  </option>
                ))}
              </Select>
            </div>

            {mainLangChanged && (
              <div className="rounded-md border border-paprika/40 bg-paprika/5 p-4 text-xs text-ink">
                <p className="font-semibold">
                  {t("Ana dil {from} → {to} olarak değişecek.", { from: localeLabels[savedMainLang], to: localeLabels[mainLang] })}
                </p>
                <p className="mt-1 text-ink-soft">
                  {t(
                    "Kaydedince menüdeki tüm metinler taşınır: şu anki {from} metinleri {from} çevirisi olarak saklanır, girdiğin {to} çevirileri ana metin olur. {to} çevirisi olmayan alanlarda mevcut metin olduğu gibi kalır — hiçbir içerik silinmez.",
                    { from: localeLabels[savedMainLang], to: localeLabels[mainLang] }
                  )}
                </p>
              </div>
            )}
            <p className="text-xs text-ink-soft">
              {t("Kapattığınız dilin çevirileri silinmez; dili yeniden açtığınızda geri gelir.")}{" "}
              {t("Açıklama ve kayan yazı çevirilerini ilgili bölümlerdeki dil seçiciden girebilirsin.")}
            </p>
          </Card>
        )}

        {tab === "tema" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]" data-guide="settings-theme">
            <div className="space-y-6">
              {/* Marka rengi */}
              <Card className="space-y-3">
                <p className="text-xs font-medium text-ink-soft">{t("Marka rengi")}</p>
                <div className="flex flex-wrap gap-2.5">
                  {Object.entries(themes).map(([key, { name: themeName, color }]) => {
                    const active = !brandIsCustom && theme === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        title={t(themeName)}
                        aria-label={t(themeName)}
                        onClick={() => {
                          setTheme(key);
                          setThemeColor("");
                        }}
                        className={`h-9 w-9 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${active ? "border-ink ring-2 ring-ink/20" : "border-white"
                          }`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
                  <label
                    className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 shadow-sm ${brandIsCustom ? "border-ink ring-2 ring-ink/20" : "border-white"
                      }`}
                    style={{ backgroundColor: brandIsCustom ? themeColor : "#ffffff" }}
                    title={t("Özel renk seç")}
                  >
                    <input
                      type="color"
                      value={brandIsCustom ? themeColor : brandPreview}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    {!brandIsCustom && <span className="absolute inset-0 flex items-center justify-center text-lg text-ink-soft">+</span>}
                  </label>
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="b-theme-hex" className="mb-1">
                      {t("Özel renk (hex)")}
                    </Label>
                    <Input
                      id="b-theme-hex"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      placeholder="#e8491f"
                      className="font-mono"
                    />
                  </div>
                  {brandIsCustom && (
                    <button
                      type="button"
                      onClick={() => setThemeColor("")}
                      className="text-xs font-medium text-ink-soft transition-colors hover:text-paprika"
                    >
                      {t("Sıfırla")}
                    </button>
                  )}
                </div>
              </Card>

              {/* Arka plan */}
              <Card className="space-y-3">
                <p className="text-xs font-medium text-ink-soft">{t("Menü arka planı")}</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {Object.entries(surfaces).map(([key, s]) => {
                    const active = menuBg === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setMenuBg(key)}
                        className={`flex items-center gap-2.5 rounded-md border-2 p-2.5 text-left transition-colors ${active ? "border-paprika" : "border-line hover:border-paprika/50"
                          }`}
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/10"
                          style={{ background: s.swatch[0] }}
                        >
                          <span className="h-3.5 w-3.5 rounded-full" style={{ background: s.swatch[2] }} />
                        </span>
                        <span className="text-sm font-medium">{t(s.name)}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Yazı tipi */}
              <Card className="space-y-3">
                <p className="text-xs font-medium text-ink-soft">{t("Yazı tipi")}</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {Object.entries(fonts).map(([key, f]) => {
                    const active = font === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setFont(key)}
                        style={{ fontFamily: f.stack }}
                        className={`rounded-md border-2 p-3 text-left transition-colors ${active ? "border-paprika" : "border-line hover:border-paprika/50"
                          }`}
                      >
                        <span className="block text-lg font-bold leading-tight">Ag</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Canlı önizleme */}
            <div className="lg:sticky lg:top-[calc(var(--app-header-h,69px)+5rem)] lg:self-start">
              <p className="mb-2 text-xs font-medium text-ink-soft">{t("Önizleme")}</p>
              <div
                className="overflow-hidden rounded-md border shadow-lg"
                style={{
                  background: surfacePreview.vars.paper,
                  color: surfacePreview.vars.ink,
                  borderColor: surfacePreview.vars.line,
                  fontFamily: getFontStack(font),
                }}
              >
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${surfacePreview.vars.line}` }}>
                  <span className="text-sm font-bold">{name || t("İşletmen")}</span>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                    style={{ background: brandPreview, color: "#fff" }}
                  >
                    {localeCodes[savedMainLang]}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{t("Izgara Köfte")}</span>
                      <span className="font-mono text-sm font-bold" style={{ color: brandPreview }}>285₺</span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: surfacePreview.vars.inkSoft }}>
                      {t("El yapımı, közlenmiş biber ve pilav ile")}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{t("Sezar Salata")}</span>
                    <span className="font-mono text-sm font-bold" style={{ color: brandPreview }}>190₺</span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-md py-2.5 text-center text-[13px] font-medium"
                    style={{ background: brandPreview, color: "#fff" }}
                  >
                    {t("+ Sepete ekle")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "yazi" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]" data-guide="settings-marquee">
            <Card className="space-y-5">
              <Switch
                checked={marqueeEnabled}
                onChange={setMarqueeEnabled}
                label={t("Kayan yazıyı göster")}
                description={t("Menünüzün üstünde, vitrin sayfanızda ve web sitenizde sürekli akan kısa duyuru şeridi.")}
              />
              <MultiLangFields
                locales={editLocales}
                mainLocale={savedMainLang}
                base={{ marquee_text: marqueeText }}
                onBaseChange={(_, value) => setMarqueeText(value)}
                translations={translations}
                onTranslationsChange={setTranslations}
                title={t("Mesajlar")}
                translate={{ business, kind: "business", fields: { marquee_text: marqueeText } }}
                fields={[
                  {
                    key: "marquee_text",
                    label: t("Her satıra bir mesaj"),
                    multiline: true,
                    rows: 5,
                    placeholder: t("Taze ürünler\nGünün favorileri\nÖzel kampanyalar\nHoş geldiniz"),
                  },
                ]}
              />
              <p className={`text-xs ${marqueeLines > MARQUEE_MAX_ITEMS ? "text-paprika-deep" : "text-ink-soft"}`}>
                {t("En fazla {max} mesaj, her biri {length} karaktere kadar. Mesajların arasına ✦ kendiliğinden eklenir.", {
                  max: MARQUEE_MAX_ITEMS,
                  length: MARQUEE_MAX_ITEM_LENGTH,
                })}
              </p>
            </Card>

            <div className="lg:sticky lg:top-[calc(var(--app-header-h,69px)+5rem)] lg:self-start">
              <p className="mb-2 text-xs font-medium text-ink-soft">{t("Önizleme")}</p>
              <div
                className="overflow-hidden rounded-md border border-line bg-paper shadow-lg"
                style={brandStyle({ theme, theme_color: themeColor, menu_bg: menuBg, font }, { surface: true }) as CSSProperties}
              >
                <div className="flex items-center justify-center border-b border-line/60 bg-paper px-4 py-3">
                  <span className="text-sm font-bold text-ink">{name || t("İşletmen")}</span>
                </div>
                {marqueeEnabled && marqueeItems.length > 0 ? (
                  <Marquee items={marqueeItems} tone="brand" label={t("Kayan yazı önizlemesi")} className="py-2" />
                ) : (
                  <p className="px-4 py-3 text-center text-xs text-ink-soft">
                    {marqueeEnabled ? t("Mesaj yazınca burada akar.") : t("Kayan yazı kapalı.")}
                  </p>
                )}
                <div className="space-y-2 bg-paper p-4">
                  <div className="h-2.5 w-2/3 rounded-full bg-crema" />
                  <div className="h-2.5 w-1/2 rounded-full bg-crema" />
                </div>
              </div>
              {uiLocale !== savedMainLang && (
                <p className="mt-2 text-xs text-ink-soft">{t("Önizleme ana dildeki mesajları gösterir.")}</p>
              )}
            </div>
          </div>
        )}

        {tab === "ozellik" && (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-soft">{t("Mekân özellikleri")}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {t("İstediğiniz kadar seçin — menünüzde, vitrininizde ve web sitenizde ikonlarıyla görünür.")}
                </p>
              </div>
              <p className="shrink-0 font-mono text-[11px] text-ink-soft">
                {t("{count} seçili", { count: highlights.length })}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {ALL_HIGHLIGHTS.map((h) => {
                const selected = highlights.includes(h);
                return (
                  <button
                    type="button"
                    key={h}
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleHighlight(h)}
                    className={`flex min-w-0 items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected ? "border-paprika bg-paprika/10 font-semibold text-paprika" : "border-line text-ink hover:border-paprika/60"
                    }`}
                  >
                    <HighlightIcon highlight={h} size={17} strokeWidth={selected ? 2.1 : 1.8} className="shrink-0" />
                    <span className="min-w-0 truncate">{highlightLabels[uiLocale][h]}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {tab === "iletisim" && (
          <Card className="space-y-4">
            <p className="text-xs font-medium text-ink-soft">{t("Adres & iletişim")}</p>
            <div>
              <Label htmlFor="b-address">{t("Adres")}</Label>
              <Input id="b-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="b-hours">{t("Çalışma saatleri")}</Label>
              <Textarea
                id="b-hours"
                rows={3}
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder={t("Pazartesi - Cuma: 09:00 - 22:00\nHafta sonu: 10:00 - 23:00")}
              />
            </div>
            <div>
              <Label htmlFor="b-maps">{t("Google Maps linki")}</Label>
              <Input
                id="b-maps"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div>
              <Label htmlFor="b-greview">{t("Google yorum linki")}</Label>
              <Input
                id="b-greview"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder="https://g.page/r/..."
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                {t("Doluysa değerlendirme gönderen müşteriye “Google'da da değerlendir” butonu gösterilir.")}
              </p>
            </div>
            <div>
              <Label htmlFor="b-wifi">{t("WiFi şifresi")}</Label>
              <Input id="b-wifi" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="kafe-wifi-2026" />
              <p className="mt-1.5 text-xs text-ink-soft">
                {t("Doluysa vitrin sayfanızda ve menünün bilgi bölümünde müşteriye gösterilir.")}
              </p>
            </div>
          </Card>
        )}

        {tab === "sosyal" && (
          <Card className="space-y-4">
            <p className="text-xs font-medium text-ink-soft">{t("Sosyal medya")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="b-whatsapp">WhatsApp</Label>
                <Input
                  id="b-whatsapp"
                  type="tel"
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="0532 123 45 67"
                />
              </div>
              <div>
                <Label htmlFor="b-instagram">Instagram</Label>
                <Input
                  id="b-instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder={t("kullaniciadi")}
                />
              </div>
              <div>
                <Label htmlFor="b-tiktok">TikTok</Label>
                <Input id="b-tiktok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder={t("kullaniciadi")} />
              </div>
              <div>
                <Label htmlFor="b-youtube">YouTube</Label>
                <Input id="b-youtube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder={t("@kanaladi")} />
              </div>
              <div>
                <Label htmlFor="b-facebook">Facebook</Label>
                <Input
                  id="b-facebook"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder={t("kullaniciadi")}
                />
              </div>
            </div>
          </Card>
        )}
      </form>

      {tab === "panel" && <PanelPreferences business={business} onSaved={onSaved} />}
      </div>
      </div>
    </div>
  );
}
