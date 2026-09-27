import { msg } from "@/lib/ui-i18n";
import { isFeatureAvailable } from "@/lib/entitlements";
import { hasActiveWebsite } from "@/lib/storefront";
import { readActivation } from "@/lib/activation";
import type { Business, BusinessGuide } from "@/lib/types";

// Panel kılavuzu: yeni işletmeyi paneli adım adım gezdiren tanıtım.
//
// Her adım bir panel sayfasına gider ve o sayfadaki ilgili alanı vurgular
// (öğede `data-guide="<hedef>"`). Adımın "tamam" olup olmadığı işletmenin kendi
// verisinden okunur: kullanıcı zaten girdiği bilgiyi tekrar girmeye zorlanmaz,
// kılavuz eksik olan ilk adımdan başlar.
//
// Durum işletme kaydında (`guide`, bkz. lib/types.ts BusinessGuide) tutulur:
// kılavuz kapatılabilir (Ayarlar → Panel), kapalıyken kendiliğinden açılmaz;
// tekrar açılınca kullanıcı isterse yeniden başlatır.

/** Kılavuzun kendiliğinden açıldığı "yeni işletme" penceresi. Yayındaki eski
 *  işletmelerin paneline yeni sürümle birlikte istenmeyen bir tur açılmasın. */
const AUTO_START_WINDOW_DAYS = 14;

export type GuideStepId = "info" | "images" | "categories" | "products" | "customize" | "website" | "share";

export interface GuideCounts {
  categories: number;
  products: number;
}

export interface GuideStep {
  id: GuideStepId;
  /** Adımın gösterildiği panel sayfası (sekme gerekiyorsa ?tab= ile). */
  route: string;
  /** Vurgulanacak öğenin `data-guide` değeri. */
  target: string;
  title: string;
  body: string;
  /** Adımın kısa eylem çağrısı (vurgulanan alanın ne işe yaradığı). */
  hint: string;
  done: (business: Business, counts: GuideCounts) => boolean;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "info",
    route: "/panel/settings?tab=general",
    target: "settings-info",
    title: msg("İşletme bilgilerinizi tamamlayın"),
    body: msg("Kısa bir açıklama ve telefon ya da adres girin. Bu bilgiler vitrininizde ve menünüzün bilgi bölümünde görünür."),
    hint: msg("Buradan işletme adınızı, açıklamanızı ve iletişim bilgilerinizi düzenleyebilirsiniz."),
    done: (business) => Boolean(business.description?.trim()) && Boolean(business.phone?.trim() || business.address?.trim()),
  },
  {
    id: "images",
    route: "/panel/settings?tab=general",
    target: "settings-images",
    title: msg("Logonuzu ve kapak görselinizi ekleyin"),
    body: msg("Logo menünün başında ve QR kartlarında, kapak görseli vitrin sayfanızın en üstünde görünür."),
    hint: msg("Görselin üzerine dokunup yükleyin; kaydetmeyi unutmayın."),
    done: (business) => Boolean(business.logo_url) && Boolean(business.cover_url),
  },
  {
    id: "categories",
    route: "/panel/categories",
    target: "categories",
    title: msg("Kategorilerinizi oluşturun"),
    body: msg("Kahvaltı, Ana Yemekler, İçecekler… Menünüzün bölümleri. Sırasını sürükleyerek değiştirebilirsiniz."),
    hint: msg("Buradan kategorilerinizi yönetebilirsiniz."),
    done: (_business, counts) => counts.categories > 0,
  },
  {
    id: "products",
    route: "/panel/products",
    target: "products",
    title: msg("Ürünlerinizi ekleyin"),
    body: msg("Ad ve fiyat yeterli; görsel, alerjen ve hazırlanma süresini sonra da girebilirsiniz. Basılı menünüzü yapay zekâyla da aktarabilirsiniz."),
    hint: msg("Yeni ürünü buradan ekleyin."),
    done: (_business, counts) => counts.products > 0,
  },
  {
    id: "customize",
    route: "/panel/settings?tab=theme",
    target: "settings-theme",
    title: msg("Menünüzü özelleştirin"),
    body: msg("Marka renginizi, menü zeminini ve yazı tipini seçin. “Kayan yazı” sekmesinden duyuru şeridi de ekleyebilirsiniz."),
    hint: msg("Seçtiğiniz renk menüde, vitrinde ve web sitenizde kullanılır."),
    done: (business) =>
      Boolean(business.theme_color) ||
      (Boolean(business.theme) && business.theme !== "paprika") ||
      Boolean(business.menu_bg) ||
      Boolean(business.font) ||
      Boolean(business.marquee_enabled),
  },
  {
    id: "website",
    route: "/panel/website",
    target: "website",
    title: msg("Web sitenizi oluşturun"),
    body: msg("isletmeniz.buyur.in adresi vitrininizdir. Web siteniz yayındaysa ziyaretçi doğrudan siteye girer; değilse bilgilerinizden otomatik bir karşılama sayfası gösterilir."),
    hint: msg("Vitrininizin durumu ve adresi burada."),
    // Web sitesi planınızda yoksa karşılama sayfası zaten hazırdır: adım tamam sayılır.
    done: (business) => !isFeatureAvailable(business, "website") || hasActiveWebsite(business),
  },
  {
    id: "share",
    route: "/panel",
    target: "share",
    title: msg("Menü linkinizi paylaşın"),
    body: msg("QR kodunuzu indirip masalara koyun, linki Instagram biyografinize ve WhatsApp'a ekleyin."),
    hint: msg("QR kodunuz ve paylaşım linkiniz burada."),
    done: (business) => Boolean(readActivation(business).qr_downloaded_at) || (business.menu_views ?? 0) > 0,
  },
];

export function guideState(business: Pick<Business, "guide">): BusinessGuide {
  return business.guide ?? {};
}

/** Kılavuz açık mı (Ayarlar → Panel → Kılavuz). Boşsa açık. */
export function isGuideEnabled(business: Pick<Business, "guide">): boolean {
  return guideState(business).enabled !== false;
}

/** Kılavuz kendiliğinden açılsın mı: açık, hiç başlatılmamış/bitirilmemiş/
 *  kapatılmamış ve işletme yeni. Diğer durumlarda kullanıcı "Kılavuzu başlat"
 *  ile açar. */
export function shouldAutoStartGuide(business: Pick<Business, "guide" | "created">, now: Date = new Date()): boolean {
  const state = guideState(business);
  if (!isGuideEnabled(business) || state.started_at || state.completed_at || state.dismissed_at) return false;
  const created = Date.parse(business.created?.replace(" ", "T") ?? "");
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created <= AUTO_START_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Tamamlanmamış ilk adımın sırası; hepsi tamamsa 0. */
export function firstOpenStep(business: Business, counts: GuideCounts): number {
  const index = GUIDE_STEPS.findIndex((step) => !step.done(business, counts));
  return index === -1 ? 0 : index;
}

/** Kılavuz durumuna eklenecek alanlar (kayda yazılır). */
export function guidePatch(business: Pick<Business, "guide">, patch: Partial<BusinessGuide>): BusinessGuide {
  return { ...guideState(business), ...patch };
}
