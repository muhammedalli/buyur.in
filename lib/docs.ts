// Yardım merkezinin (/docs) içeriği. Yasal metinlerde olduğu gibi içerik veri
// olarak durur; bir adımı değiştirmek için JSX'e dokunmak gerekmez.
//
// Plan sınırları, fiyat ve kota burada RAKAMLA yazılmaz: kaynak `buyur_plans`
// kaydıdır ve admin panelinden değişir (CLAUDE.md §4). Metin "planınıza göre"
// der, rakam için Plan ekranına yönlendirir.
//
// İngilizcesi lib/docs-en.ts'te (/en/docs); Türkçe rehber değişince o da
// aynı değişiklikte güncellenir.
//
// Bir özellik davranışı değişince ilgili rehber aynı değişiklikte güncellenir
// ve `updated` ilerletilir; sürüm notuna da yazılır (lib/release-notes.ts).

import { DOC_GUIDES_EN } from "@/lib/docs-en";
import { siteLocalePath, uiLocaleTags, type UiLocale } from "@/lib/ui-i18n";

export interface DocSection {
  heading: string;
  paragraphs?: string[];
  /** Sıralı adımlar (numaralı liste). */
  steps?: string[];
  /** Sırasız liste. */
  list?: string[];
  /** Vurgulu ipucu kutusu. */
  tip?: string;
}

export interface DocGuide {
  slug: string;
  title: string;
  /** Liste sayfasında ve meta description'da. */
  summary: string;
  /** Rehberin ait olduğu grup (liste sayfası buna göre bölünür). */
  group: DocGroup;
  /** Son güncelleme (ISO tarih). İçerik değişince ilerletin. */
  updated: string;
  sections: DocSection[];
}

export type DocGroup = "Başlarken" | "Menü" | "Yapay zekâ" | "Büyüme" | "Hesap";

export const DOC_GROUPS: DocGroup[] = ["Başlarken", "Menü", "Yapay zekâ", "Büyüme", "Hesap"];

export const RELEASE_NOTES_SLUG = "surum-notlari";

const D = "2026-09-27";

export const DOC_GUIDES: DocGuide[] = [
  {
    slug: "hizli-baslangic",
    title: "Hızlı başlangıç",
    summary: "Hesap açmaktan masadaki ilk QR okutmaya kadar on dakikalık kurulum.",
    group: "Başlarken",
    updated: D,
    sections: [
      {
        heading: "1. Hesabınızı açın",
        steps: [
          "buyur.in adresinde \"Ücretsiz başla\"ya tıklayın.",
          "E-posta adresinizi ve bir şifre yazın; e-postanıza gelen 6 haneli kodu girin.",
          "Kurulum ekranında işletme adınızı ve menü adresinizi (ör. kahvedurağı) belirleyin. Menünüz ad ve adres dolana kadar yayına girmez.",
        ],
      },
      {
        heading: "2. Menünüzü oluşturun",
        paragraphs: [
          "Önce kategorileri (Kahvaltı, Ana yemek, İçecek…), sonra ürünleri ekleyin. Elinizde basılı menü varsa fotoğrafını yükleyip yapay zekâya aktarttırabilirsiniz; bkz. \"Menüyü yapay zekâ ile aktarma\".",
        ],
      },
      {
        heading: "3. Görünümü ayarlayın",
        list: [
          "Ayarlar → marka rengi ve logo: menü bu renkle açılır.",
          "Ayarlar → menü dilleri: ana dili ve misafirlere sunulacak ek dilleri seçin (ana dil dahil en fazla 4).",
          "Ayarlar → mekân özellikleri: Wi-Fi, otopark, teras gibi özellikleri istediğiniz kadar seçin; menüde ve web sitenizde ikonlarıyla görünür.",
          "Çalışma saatleri, adres ve iletişim bilgileri menünün karşılama ekranında görünür.",
        ],
      },
      {
        heading: "4. QR kodu basın",
        paragraphs: ["QR kodlar ekranından tek bir kod ya da masa masa toplu kod üretin, yazdırıp masalara koyun."],
        tip: "Genel bakış ekranındaki yayın kontrol listesi, eksik kalan adımları tek tek gösterir.",
      },
    ],
  },
  {
    slug: "menu-yonetimi",
    title: "Kategori ve ürün yönetimi",
    summary: "Kategoriler, ürünler, seçenekler, görseller, alerjenler ve stok durumu.",
    group: "Menü",
    updated: "2026-10-02",
    sections: [
      {
        heading: "Kategoriler",
        paragraphs: [
          "Kategoriler menüdeki ana başlıklardır. Sıralamayı sürükleyerek değiştirebilir, geçici olarak gizlemek için \"Aktif\" anahtarını kapatabilirsiniz.",
          "Aynı ada sahip iki kategori açılamaz; büyük/küçük harf ve boşluk farkı aynı ad sayılır.",
        ],
      },
      {
        heading: "Ürün eklemek",
        steps: [
          "Ürünler → Yeni ürün.",
          "Adı ve açıklamayı ana dilde yazın; fiyatı ve kategoriyi seçin.",
          "Görsel: yeni üründe ad yazıldıkça uygun bir görsel otomatik aranır. Beğenmezseniz kendi fotoğrafınızı yükleyin; büyük fotoğraf menüye uygun boyuta otomatik küçültülür. Seçtiğiniz görsel kaydettiğinizde yüklenir; kaldırdığınız ya da değiştirdiğiniz görsel depodan da silinir.",
          "İsterseniz hazırlık süresi, kalori, alerjen ve rozet ekleyin.",
          "Kaydet'e basın. Kaydetmeden çıkarsanız yazdıklarınız taslak olarak saklanır; yarım bilgi canlı menüye yazılmaz.",
        ],
      },
      {
        heading: "Seçenekler (boy, ekstra, pişirme)",
        paragraphs: [
          "Ürün düzenleme ekranının altındaki Seçenekler bölümünden grup (ör. Boy) ve seçenek (ör. Büyük) ekleyin. Fiyat farkı seçenek başına girilir; eksi değer indirimdir.",
        ],
      },
      {
        heading: "Satıştan kaldırma ve kampanya",
        list: [
          "\"Satışta\" anahtarını kapatmak ürünü silmeden menüden kaldırır; bilgileri durur, anahtarı açınca geri gelir.",
          "İndirim yüzdesi ve kampanya etiketi (ör. Haftanın kampanyası) ürün kartında öne çıkar.",
        ],
      },
    ],
  },
  {
    slug: "coklu-dil",
    title: "Çoklu dil ve yapay zekâ çevirisi",
    summary: "Menüyü sekiz dilden dördüne kadar sunmak; \"AI ile tamamla\" nasıl çalışır.",
    group: "Yapay zekâ",
    updated: D,
    sections: [
      {
        heading: "Diller nasıl çalışır",
        paragraphs: [
          "Desteklenen diller: Türkçe, English, Deutsch, العربية, Français, Español, Italiano ve Русский.",
          "Her metnin bir ana dili vardır. Ayarlar → Menü dilleri'nde ana dili açılır menüden seçin, \"Dil ekle\" ile ek dilleri açın. Menünüzde ana dil dahil en fazla 4 dil açık olabilir; kapattığınız dilin çevirileri silinmez.",
          "Ek diller açıldığında ürün, kategori, seçenek ve kampanya formlarında dil sekmeleri görünür.",
          "Bir dilde çeviri boş bırakılırsa misafir o dilde ana dildeki metni görür; menü hiçbir zaman boş kalmaz. Arapça sağdan sola gösterilir.",
        ],
      },
      {
        heading: "Sekmelerdeki noktalar",
        list: [
          "Yeşil nokta: bu dilde bütün alanlar dolu.",
          "Turuncu nokta: bazı alanlar eksik.",
          "Boş halka: bu dilde hiç çeviri yok.",
        ],
      },
      {
        heading: "\"AI ile tamamla\"",
        steps: [
          "Ana dil sekmesinde metni yazın.",
          "Alan grubunun sağ üstündeki \"AI ile tamamla\"ya basın.",
          "Yapay zekâ yalnızca BOŞ olan çevirileri doldurur; elle yazdığınız ya da önceden onayladığınız çeviriye dokunmaz. İlk dolan dilin sekmesi kendiliğinden açılır.",
          "Çeviriyi kontrol edin, gerekirse düzeltin ve Kaydet'e basın. Kaydetmeden hiçbir çeviri menüde yayınlanmaz.",
        ],
        tip: "Bir çeviriyi yeniden ürettirmek için o alanı boşaltıp tekrar \"AI ile tamamla\"ya basın.",
      },
      {
        heading: "Neler çevrilir, neler çevrilmez",
        list: [
          "Çevrilir: ürün/kategori adı ve açıklaması, seçenek ve grup adı, kampanya başlığı, mesajı ve etiketi, işletme açıklaması.",
          "Asla gönderilmez ve değişmez: fiyat, indirim, kalori, hazırlık süresi, alerjen bilgisi.",
          "Ana dilde boş olan bir alan için çeviri üretilmez; yapay zekâ metin uydurmaz.",
          "Özel yemek adları (ör. Adana Kebap) korunur, gerekiyorsa kısa açıklama eklenir.",
        ],
      },
      {
        heading: "Sorun giderme",
        list: [
          "Buton görünmüyor: ana dil dışında en az bir menü dili açık olmalı ve planınız yapay zekâ çevirisini içermeli.",
          "\"Henüz kaydedilmedi\" uyarısı: Ayarlar'da yeni eklediğiniz dil önce kaydedilmelidir; çeviri yalnızca kayıtlı dillere yapılır.",
          "\"Bütün diller zaten dolu\": doldurulacak boş alan yok. Yeniden üretmek için alanı boşaltın.",
          "\"Çok uzun sürdü\" ya da \"servis yanıt vermiyor\": birkaç saniye sonra tekrar deneyin; geçici hatalarda bir kez kendiliğinden yeniden denenir.",
          "\"Şu dil üretilemedi\": diğer diller dolduruldu; eksik kalan dil için tekrar basmanız yeterli.",
        ],
      },
    ],
  },
  {
    slug: "yapay-zeka-menu-aktarimi",
    title: "Menüyü yapay zekâ ile aktarma",
    summary: "Basılı menünün fotoğrafından kategori ve ürünleri otomatik oluşturma.",
    group: "Yapay zekâ",
    updated: D,
    sections: [
      {
        heading: "Nasıl kullanılır",
        steps: [
          "Panelde Yapay Zeka ekranını açın.",
          "Menünüzün net, düz çekilmiş fotoğraflarını yükleyin.",
          "Önizleme ekranında bulunan kategori ve ürünleri kontrol edin; fiyatları mutlaka gözden geçirin.",
          "Onayladığınız kayıtlar menünüze eklenir. Aynı adlı ürün ya da kategori varsa yeniden oluşturulmaz.",
        ],
      },
      {
        heading: "Bilmeniz gerekenler",
        list: [
          "Okunamayan ya da belirsiz bilgi tahmin edilmez; önizlemede işaretlenir, siz tamamlarsınız.",
          "Yapay zekâ ile üretilen içerik siz onaylayana kadar taslaktır.",
          "Aylık tarama hakkı planınıza göre değişir; kalan hakkınızı Plan ekranında görürsünüz.",
          "Bağlantı sorunu olursa aktarım durmaz; sonunda kaç kaydın eklendiği, kaçının eklenemediği söylenir.",
        ],
      },
    ],
  },
  {
    slug: "qr-kodlar",
    title: "QR kodlar",
    summary: "Tek QR, masa masa toplu QR, yazdırma ve menü adresiniz.",
    group: "Menü",
    updated: D,
    sections: [
      {
        heading: "Menü adresiniz",
        paragraphs: [
          "Menünüz hem buyur.in/adresiniz hem de adresiniz.buyur.in üzerinden açılır. Adresi Ayarlar'dan değiştirirseniz eski QR kodlar çalışmaz; yenilerini basmanız gerekir.",
        ],
      },
      {
        heading: "QR üretmek",
        list: [
          "Tek QR oluştur: kapı, vitrin ya da kasa için tek kod.",
          "Masa QR'larını toplu oluştur: masa sayısını girin, her masa için ayrı kod üretilir; hangi masadan kaç okutma geldiğini analizde görürsünüz.",
          "Yazdırma sayfası A4'e sığacak şekilde hazırlanır.",
        ],
        tip: "QR'ı masaya koymadan önce telefonunuzla okutup menünün açıldığını kontrol edin.",
      },
    ],
  },
  {
    slug: "kampanyalar",
    title: "Kampanyalar (açılır duyurular)",
    summary: "Menü açılınca misafire gösterilen kampanya ve duyuru pencereleri.",
    group: "Büyüme",
    updated: D,
    sections: [
      {
        heading: "Kampanya eklemek",
        steps: [
          "Kampanyalar → Yeni kampanya.",
          "Başlık ve mesajı ana dilde yazın; isterseniz görsel ekleyin.",
          "Ek dillerde \"AI ile tamamla\" ile başlık ve mesajı çevirin.",
          "\"Aktif\" anahtarını açıp kaydedin.",
        ],
      },
      { heading: "İpucu", paragraphs: ["Kısa tutun: bir başlık, bir cümle. Misafir menüye bakmak için geldi."] },
    ],
  },
  {
    slug: "analiz-ve-raporlar",
    title: "Analiz ve raporlar",
    summary: "Menü görüntülenmeleri, QR okutmaları, en çok bakılan ürünler ve dönemsel raporlar.",
    group: "Büyüme",
    updated: D,
    sections: [
      {
        heading: "Analiz ekranı",
        list: [
          "Zaman içinde menü performansı: ziyaret ve oturum sayıları.",
          "Müşteri yolculuğu: QR okutmadan sepete kadar hangi adımda kaç kişi kaldı.",
          "Trafik kaynağı, cihaz dağılımı, en çok görüntülenen ürün ve kategoriler.",
        ],
      },
      {
        heading: "Gizlilik",
        paragraphs: [
          "Misafirlerinizden kişisel veri toplanmaz; analiz yalnızca anonim oturumlarla çalışır. Verilerin ne kadar süre saklandığı planınıza göre değişir.",
        ],
      },
      {
        heading: "Raporlar",
        paragraphs: ["Raporlar ekranı dönemsel özetleri ve öneri kartlarını gösterir. Gelişmiş raporlar ve dışa aktarma planınıza bağlıdır."],
      },
    ],
  },
  {
    slug: "web-sitesi-ve-degerlendirmeler",
    title: "Web sitesi ve değerlendirmeler",
    summary: "Menünüzden otomatik üretilen tanıtım sitesi ve misafir değerlendirmeleri.",
    group: "Büyüme",
    updated: D,
    sections: [
      {
        heading: "Otomatik web sitesi",
        paragraphs: [
          "Web sitesi ekranından menü bilgilerinizle hazırlanan tanıtım sitesini açabilirsiniz (adresiniz.buyur.in/site). Menüyü güncelledikçe site de güncellenir. Bu özellik planınıza bağlıdır.",
          "Ayarlar → Mekân özellikleri'nde seçtiğiniz özellikler sitenin \"Hakkımızda\" bölümünde ikonlarıyla listelenir.",
          "Site ilk açıldığında kapak görseli sade görünür; ziyaretçi aşağı kaydırınca üstte işletme adınız, dil seçici ve \"Menü\" düğmesi olan bir çubuk belirir. Dil seçici, menünüzde açık olan dilleri listeler.",
        ],
      },
      {
        heading: "Değerlendirmeler",
        paragraphs: ["Misafirler menüden değerlendirme bırakabilir; hepsini Değerlendirmeler ekranında görürsünüz."],
      },
    ],
  },
  {
    slug: "plan-ve-hesap",
    title: "Plan, hesap ve güvenlik",
    summary: "Planlar, deneme süresi, şifre, oturum ve hesabın kapatılması.",
    group: "Hesap",
    updated: D,
    sections: [
      {
        heading: "Planlar",
        paragraphs: [
          "Freemium, Premium ve Elite planları vardır. Hangi özelliğin hangi planda olduğu, kotalar ve güncel fiyatlar Plan ekranında ve buyur.in/#pricing sayfasında her zaman günceldir.",
          "Kilitli bir özelliğe tıkladığınızda neyin açılacağını gösteren bir yükseltme notu görürsünüz.",
        ],
      },
      {
        heading: "Giriş ve şifre",
        list: [
          "\"Beni hatırla\" işaretli değilse tarayıcıyı kapatınca oturum kapanır.",
          "Şifrenizi unuttuysanız giriş ekranındaki \"Şifremi unuttum?\" bağlantısıyla e-postanıza gelen sıfırlama bağlantısını kullanın.",
        ],
      },
      {
        heading: "Panel dili",
        paragraphs: [
          "Panel Türkçe ve İngilizce kullanılabilir. Üst çubuktaki dil düğmesinden ya da Ayarlar → Panel'den değiştirin; tercihiniz hesabınızda saklanır. Menünüzün misafirlere sunulan dilleri bundan ayrıdır (Ayarlar → Menü dilleri).",
          "Analizlerdeki otomatik içgörü cümleleri ve rapor özetleri şimdilik Türkçe üretilir.",
        ],
      },
      {
        heading: "Yardım",
        paragraphs: ["Cevabını bulamadığınız her soru için merhaba@buyur.in adresine ya da WhatsApp destek hattına yazın."],
      },
    ],
  },
];

/** Rehber grubunun görünen adı. */
export const DOC_GROUP_LABELS: Record<DocGroup, Record<UiLocale, string>> = {
  Başlarken: { tr: "Başlarken", en: "Getting started" },
  Menü: { tr: "Menü", en: "Menu" },
  "Yapay zekâ": { tr: "Yapay zekâ", en: "AI" },
  Büyüme: { tr: "Büyüme", en: "Growth" },
  Hesap: { tr: "Hesap", en: "Account" },
};

const RELEASE_NOTES_SLUGS: Record<UiLocale, string> = { tr: RELEASE_NOTES_SLUG, en: "release-notes" };

/** Yardım merkezinin kökü: /docs, /en/docs. */
export function docsHome(locale: UiLocale = "tr"): string {
  return siteLocalePath(locale, "/docs");
}

/** Rehberin ya da sürüm notlarının adresi. `slug` her zaman TÜRKÇE kimliktir;
 *  İngilizce adres kendi slug'ını kullanır (/en/docs/quick-start). */
export function docPath(slug: string, locale: UiLocale = "tr"): string {
  return `${docsHome(locale)}/${localizedDocSlug(slug, locale)}`;
}

export function localizedDocSlug(slug: string, locale: UiLocale): string {
  if (slug === RELEASE_NOTES_SLUG) return RELEASE_NOTES_SLUGS[locale];
  return locale === "tr" ? slug : (DOC_GUIDES_EN[slug]?.slug ?? slug);
}

/** Rehberin istenen dildeki hâli. `slug` Türkçe kimliktir; dönen kaydın
 *  `slug`'ı da Türkçe kalır (adres docPath ile kurulur). */
export function localizeGuide(guide: DocGuide, locale: UiLocale): DocGuide {
  if (locale === "tr") return guide;
  const translation = DOC_GUIDES_EN[guide.slug];
  if (!translation) return guide;
  return { ...guide, title: translation.title, summary: translation.summary, sections: translation.sections };
}

export function docGuides(locale: UiLocale = "tr"): DocGuide[] {
  return DOC_GUIDES.map((guide) => localizeGuide(guide, locale));
}

/** Adres parçasından (dilin kendi slug'ı) Türkçe kimliği bulur. */
export function docSlugFromPath(pathSlug: string, locale: UiLocale): string | undefined {
  if (pathSlug === RELEASE_NOTES_SLUGS[locale]) return RELEASE_NOTES_SLUG;
  return DOC_GUIDES.find((guide) => localizedDocSlug(guide.slug, locale) === pathSlug)?.slug;
}

export function docGuide(slug: string, locale: UiLocale = "tr"): DocGuide | undefined {
  const guide = DOC_GUIDES.find((item) => item.slug === slug);
  return guide ? localizeGuide(guide, locale) : undefined;
}

export function formatDocDate(iso: string, locale: UiLocale = "tr"): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(uiLocaleTags[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
