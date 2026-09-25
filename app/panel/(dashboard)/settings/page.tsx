"use client";

import { useRef, useState, type FormEvent } from "react";
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
import { HighlightIcon } from "@/components/icons";
import { Card, ErrorText, FormActions, FormStatusFooter, Input, Label, PageHeader, SaveStatus, Select, Spinner, Tabs, Textarea } from "@/components/panel/ui";
import { MultiLangFields } from "@/components/panel/multi-lang-fields";
import { useToast } from "@/components/panel/toast";
import { StarIcon } from "@/components/icons";
import {
  activeNonMainLocales,
  localeCodes,
  localeLabels,
  mainLocale,
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
const MAX_HIGHLIGHTS = 3;

type SettingsTab = "genel" | "diller" | "tema" | "ozellik" | "iletisim" | "sosyal";
const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "genel", label: "Genel bilgiler" },
  { key: "diller", label: "Menü dilleri" },
  { key: "tema", label: "Tema" },
  { key: "ozellik", label: "Öne çıkan özellikler" },
  { key: "iletisim", label: "Adres & iletişim" },
  { key: "sosyal", label: "Sosyal medya" },
];

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-2">
      {/* Kapak */}
      <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-line bg-crema/40 sm:h-44">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Kapak" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-soft">Kapak görseli yok</div>
        )}
        {coverBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <Spinner className="h-7 w-7 text-paper" />
          </div>
        )}
        {!coverBusy && (
          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/0 text-transparent transition-colors hover:bg-ink/40 hover:text-paper">
            <span className="font-mono text-[11px] uppercase tracking-wider">{coverUrl ? "Kapağı değiştir" : "Kapak yükle"}</span>
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
            <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-[10px] leading-tight text-ink-soft">Logo yok</div>
          )}
          {logoBusy && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
              <Spinner className="h-6 w-6 text-paper" />
            </div>
          )}
          {!logoBusy && (
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/0 text-transparent transition-colors hover:bg-ink/50 hover:text-paper">
              <span className="font-mono text-[9px] uppercase tracking-wider">Değiştir</span>
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

export default function SettingsPage() {
  const { business, isLoading, setBusiness } = useBusiness();

  if (isLoading || !business) {
    return <p className="text-ink-soft">Yükleniyor…</p>;
  }

  return <SettingsForm business={business} onSaved={setBusiness} />;
}

function SettingsForm({ business, onSaved }: { business: Business; onSaved: (b: Business) => void }) {
  const [name, setName] = useState(business.name);
  const [slug, setSlug] = useState(business.slug);
  const [description, setDescription] = useState(business.description);
  // Menüde görünen e-posta: ayrı bir iletişim adresi ya da (görünürlüğü
  // açıksa) giriş e-postası. Tek kaynak kuralı lib/business-account.ts'te.
  const [email, setEmail] = useState(publicContactEmail(business));
  const [phone, setPhone] = useState(business.phone);
  const [address, setAddress] = useState(business.address);
  const [workingHours, setWorkingHours] = useState(business.working_hours);
  const [highlights, setHighlights] = useState<Highlight[]>(business.highlights ?? []);
  const [whatsapp, setWhatsapp] = useState(business.whatsapp);
  const [instagram, setInstagram] = useState(business.instagram);
  const [tiktok, setTiktok] = useState(business.tiktok);
  const [youtube, setYoutube] = useState(business.youtube);
  const [facebook, setFacebook] = useState(business.facebook);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(business.google_maps_url);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(business.google_review_url);
  const [wifiPassword, setWifiPassword] = useState(business.wifi_password);
  const [theme, setTheme] = useState(business.theme || "paprika");
  const [themeColor, setThemeColor] = useState(business.theme_color || "");
  const [menuBg, setMenuBg] = useState(business.menu_bg || DEFAULT_SURFACE);
  const [font, setFont] = useState(business.font || DEFAULT_FONT);
  const template: Template = "liste";
  const [logoUrl, setLogoUrl] = useState(business.logo_url);
  const [coverUrl, setCoverUrl] = useState(business.cover_url);
  const [mainLang, setMainLang] = useState<Locale>(mainLocale(business));
  // Ana dil dışındaki aktif ek diller.
  const [languages, setLanguages] = useState<Locale[]>(activeNonMainLocales(business));
  const [translations, setTranslations] = useState<Translations>(business.translations ?? {});
  const [tab, setTab] = useState<SettingsTab>("genel");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { toast } = useToast();

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

  function toggleLanguage(l: Locale) {
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  function toggleHighlight(h: Highlight) {
    setHighlights((prev) => {
      if (prev.includes(h)) return prev.filter((x) => x !== h);
      if (prev.length >= MAX_HIGHLIGHTS) return prev;
      return [...prev, h];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (isReservedSlug(slugify(slug))) {
      setError("Bu menü adresi sisteme ayrılmış, başka bir tane seç.");
      return;
    }
    // Numaralar tek biçimde saklanır ki menüdeki arama/WhatsApp bağlantıları kırılmasın.
    const phoneCheck = checkBusinessPhone(phone);
    const whatsappCheck = checkBusinessPhone(whatsapp);
    if (!phoneCheck.ok || !whatsappCheck.ok) {
      const message = !phoneCheck.ok
        ? `Telefon: ${phoneCheck.error}`
        : `WhatsApp: ${!whatsappCheck.ok ? whatsappCheck.error : ""}`;
      setTab(!phoneCheck.ok ? "genel" : "sosyal");
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
          const message = `${failed.length} kayıt yeni ana dile taşınamadı. Ana dil değişmedi; tekrar kaydet.`;
          setError(message);
          toast(message, "error");
          return;
        }
        pendingRebase.current = null;

        const rebased = rebaseEntity({ description, translations }, BUSINESS_REBASE_FIELDS, savedMainLang, mainLang);
        baseDescription = rebased.base.description ?? "";
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
        main_language: mainLang,
        languages,
        translations: baseTranslations,
      });
      // Taşıma sonrası form da yeni baz dile göre görünmeli.
      setDescription(baseDescription);
      setPhone(phoneCheck.value);
      setWhatsapp(whatsappCheck.value);
      setTranslations(baseTranslations);
      onSaved(updated);
      setSavedAt(Date.now());
      toast(mainLangChanged ? "Ayarlar kaydedildi, içerik yeni ana dile taşındı" : "Ayarlar kaydedildi");
    } catch (err) {
      if (err instanceof ClientResponseError && err.response?.data?.slug) {
        setError("Bu adres başka bir işletme tarafından kullanılıyor.");
        toast("Bu adres başka bir işletme tarafından kullanılıyor.", "error");
      } else {
        setError("Kaydedilemedi, tekrar dene.");
        toast("Kaydedilemedi, tekrar dene.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  // Tema önizlemesi için etkin değerler
  const brandIsCustom = isValidHex(themeColor);
  const brandPreview = brandIsCustom ? themeColor : themes[theme as keyof typeof themes]?.color ?? themes.paprika.color;
  const surfacePreview = surfaces[menuBg as keyof typeof surfaces] ?? surfaces[DEFAULT_SURFACE];

  const registeredAt = new Date(business.created).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader title="İşletme ayarları" description="Menünün görünümünü ve bilgilerini düzenle." />
      <form onSubmit={handleSubmit} className="space-y-8">
        <FormActions saving={saving} saved={!!savedAt} />
        <ErrorText>{error}</ErrorText>

        <Tabs tabs={SETTINGS_TABS} active={tab} onChange={setTab} />

        {tab === "genel" && (
          <div className="space-y-8">
            {/* Kapak + logo başlığı */}
            <Card className="space-y-4">
              <ProfileImages
                businessId={business.id}
                logoUrl={logoUrl}
                coverUrl={coverUrl}
                onLogo={setLogoUrl}
                onCover={setCoverUrl}
              />
            </Card>

            {/* Genel bilgiler */}
            <Card className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Kayıt tarihi: {registeredAt}</p>
              <div>
                <Label htmlFor="b-name">İşletme adı</Label>
                <Input id="b-name" required value={name} onChange={(e) => setName(e.target.value)} />
                <p className="mt-1.5 text-xs text-ink-soft">İşletme adı tekildir, tüm dillerde aynı görünür.</p>
              </div>
              <div>
                <Label htmlFor="b-slug">Menü adresi</Label>
                <div className="flex items-center gap-1 rounded-2xl border border-line bg-crema/40 px-4 py-2.5 text-sm">
                  <input
                    id="b-slug"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-right text-ink outline-none"
                  />
                  <span className="shrink-0 text-ink-soft">.{ROOT_DOMAIN}</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">Adresi değiştirirsen eski QR kodların çalışmaz, yeniden bastırman gerekir.</p>
              </div>
              <MultiLangFields
                locales={[mainLang, ...languages]}
                mainLocale={mainLang}
                base={{ description }}
                onBaseChange={(_, v) => setDescription(v)}
                translations={translations}
                onTranslationsChange={setTranslations}
                fields={[{ key: "description", label: "Açıklama", multiline: true }]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="b-email">Menüde görünen e-posta</Label>
                  <Input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="merhaba@isletme.com" />
                </div>
                <div>
                  <Label htmlFor="b-phone">Telefon</Label>
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
                Bu bilgiler menüdeki &ldquo;İşletme bilgileri&rdquo; bölümünde müşterilere görünür. E-posta boşsa
                gösterilmez; giriş e-postanı yazarsan onu gösteririz{business.email ? ` (${business.email})` : ""}.
              </p>
            </Card>
          </div>
        )}

        {tab === "diller" && (
          <Card className="space-y-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Menü dilleri</p>
              <p className="mt-1 text-xs text-ink-soft">
                Yıldız o dili ana dil yapar (metinlerin girildiği baz dildir); switch dili menüde aktif/pasif eder.
                Ana dil her zaman aktiftir.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SUPPORTED_LOCALES.map((l) => {
                const isMain = l === mainLang;
                const isActive = isMain || languages.includes(l);
                return (
                  <div
                    key={l}
                    className={`rounded-2xl border p-4 transition-colors ${isMain ? "border-paprika bg-paprika/5" : "border-line"}`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => changeMainLang(l)}
                        disabled={isMain || !isActive}
                        title="Ana dil yap"
                        aria-label={`${localeLabels[l]} dilini ana dil yap`}
                        className={`transition-colors ${isMain
                            ? "text-paprika"
                            : isActive
                              ? "text-ink-soft/50 hover:text-paprika"
                              : "cursor-not-allowed text-ink-soft/20"
                          }`}
                      >
                        <StarIcon filled={isMain} size={16} />
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={`${localeLabels[l]} aktif`}
                        disabled={isMain}
                        onClick={() => toggleLanguage(l)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isActive ? "bg-herb" : "bg-ink/20"
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-paper shadow transition-transform ${isActive ? "translate-x-[1.125rem]" : "translate-x-0.5"
                            }`}
                        />
                      </button>
                    </div>
                    <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-soft">{localeCodes[l]}</p>
                    <p className="text-sm font-semibold text-ink">{localeLabels[l]}</p>
                  </div>
                );
              })}
            </div>
            {mainLangChanged && (
              <div className="rounded-2xl border border-paprika/40 bg-paprika/5 p-4 text-xs text-ink">
                <p className="font-semibold">Ana dil {localeLabels[savedMainLang]} → {localeLabels[mainLang]} olarak değişecek.</p>
                <p className="mt-1 text-ink-soft">
                  Kaydedince menüdeki tüm metinler taşınır: şu anki {localeLabels[savedMainLang]} metinleri{" "}
                  {localeLabels[savedMainLang]} çevirisi olarak saklanır, girdiğin {localeLabels[mainLang]} çevirileri ana
                  metin olur. {localeLabels[mainLang]} çevirisi olmayan alanlarda mevcut metin olduğu gibi kalır —
                  hiçbir içerik silinmez.
                </p>
              </div>
            )}
            <p className="text-xs text-ink-soft">
              Açıklama çevirilerini &ldquo;Genel bilgiler&rdquo; sekmesindeki dil sekmelerinden girebilirsin.
            </p>
          </Card>
        )}

        {tab === "tema" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-6">
              {/* Marka rengi */}
              <Card className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Marka rengi</p>
                <div className="flex flex-wrap gap-2.5">
                  {Object.entries(themes).map(([key, { name, color }]) => {
                    const active = !brandIsCustom && theme === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        title={name}
                        aria-label={name}
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
                <div className="mt-1 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
                  <label
                    className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 shadow-sm ${brandIsCustom ? "border-ink ring-2 ring-ink/20" : "border-white"
                      }`}
                    style={{ backgroundColor: brandIsCustom ? themeColor : "#ffffff" }}
                    title="Özel renk seç"
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
                    <Label htmlFor="b-theme-hex" className="mb-1">Özel renk (hex)</Label>
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
                      className="font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:text-paprika"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>
              </Card>

              {/* Arka plan */}
              <Card className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Menü arka planı</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {Object.entries(surfaces).map(([key, s]) => {
                    const active = menuBg === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setMenuBg(key)}
                        className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors ${active ? "border-paprika" : "border-line hover:border-paprika/50"
                          }`}
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10"
                          style={{ background: s.swatch[0] }}
                        >
                          <span className="h-3.5 w-3.5 rounded-full" style={{ background: s.swatch[2] }} />
                        </span>
                        <span className="text-sm font-medium">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Yazı tipi */}
              <Card className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Yazı tipi</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {Object.entries(fonts).map(([key, f]) => {
                    const active = font === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setFont(key)}
                        style={{ fontFamily: f.stack }}
                        className={`rounded-xl border-2 p-3 text-left transition-colors ${active ? "border-paprika" : "border-line hover:border-paprika/50"
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
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Önizleme</p>
              <div
                className="overflow-hidden rounded-3xl border shadow-lg"
                style={{
                  background: surfacePreview.vars.paper,
                  color: surfacePreview.vars.ink,
                  borderColor: surfacePreview.vars.line,
                  fontFamily: getFontStack(font),
                }}
              >
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${surfacePreview.vars.line}` }}>
                  <span className="text-sm font-bold">{name || "İşletmen"}</span>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                    style={{ background: brandPreview, color: "#fff" }}
                  >
                    TR
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">Izgara Köfte</span>
                      <span className="font-mono text-sm font-bold" style={{ color: brandPreview }}>285₺</span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: surfacePreview.vars.inkSoft }}>
                      El yapımı, közlenmiş biber ve pilav ile
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">Sezar Salata</span>
                    <span className="font-mono text-sm font-bold" style={{ color: brandPreview }}>190₺</span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-md py-2.5 text-center font-mono text-[12px] uppercase tracking-wider"
                    style={{ background: brandPreview, color: "#fff" }}
                  >
                    + Sepete ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "ozellik" && (
          <Card className="space-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Öne çıkan özellikler</p>
              <p className="mt-1 text-xs text-ink-soft">En fazla {MAX_HIGHLIGHTS} tane seç — menünde rozet olarak görünür.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_HIGHLIGHTS.map((h) => {
                const selected = highlights.includes(h);
                const disabled = !selected && highlights.length >= MAX_HIGHLIGHTS;
                return (
                  <button
                    type="button"
                    key={h}
                    disabled={disabled}
                    onClick={() => toggleHighlight(h)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${selected
                        ? "border-paprika bg-paprika text-paper"
                        : "border-line text-ink-soft hover:border-paprika hover:text-paprika disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-soft"
                      }`}
                  >
                    <HighlightIcon highlight={h} size={15} strokeWidth={2} />
                    {highlightLabels.tr[h]}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {tab === "iletisim" && (
          <Card className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Adres & iletişim</p>
            <div>
              <Label htmlFor="b-address">Adres</Label>
              <Input id="b-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="b-hours">Çalışma saatleri</Label>
              <Textarea
                id="b-hours"
                rows={3}
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder={"Pazartesi - Cuma: 09:00 - 22:00\nHafta sonu: 10:00 - 23:00"}
              />
            </div>
            <div>
              <Label htmlFor="b-maps">Google Maps linki</Label>
              <Input
                id="b-maps"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div>
              <Label htmlFor="b-greview">Google yorum linki</Label>
              <Input
                id="b-greview"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder="https://g.page/r/... veya https://search.google.com/local/writereview?placeid=..."
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                Doluysa değerlendirme gönderen müşteriye &ldquo;Google&apos;da da değerlendir&rdquo; butonu gösterilir.
              </p>
            </div>
            <div>
              <Label htmlFor="b-wifi">WiFi şifresi</Label>
              <Input id="b-wifi" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="kafe-wifi-2026" />
              <p className="mt-1.5 text-xs text-ink-soft">Doluysa menünün karşılama sayfasında müşteriye gösterilir.</p>
            </div>
          </Card>
        )}

        {tab === "sosyal" && (
          <Card className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Sosyal medya</p>
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
                <Input id="b-instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="kullaniciadi" />
              </div>
              <div>
                <Label htmlFor="b-tiktok">TikTok</Label>
                <Input id="b-tiktok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="kullaniciadi" />
              </div>
              <div>
                <Label htmlFor="b-youtube">YouTube</Label>
                <Input id="b-youtube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="@kanaladi" />
              </div>
              <div>
                <Label htmlFor="b-facebook">Facebook</Label>
                <Input id="b-facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="kullaniciadi" />
              </div>
            </div>
          </Card>
        )}

        <ErrorText>{error}</ErrorText>
        <FormStatusFooter status={<SaveStatus saving={saving} savedAt={savedAt ?? business.updated ?? null} />} />
      </form>
    </div>
  );
}
