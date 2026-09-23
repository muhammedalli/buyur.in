// Menü içeriği (işletme/kategori/ürün adı & açıklaması) çoklu dil desteği.
// Varsayılan dil Türkçe'dir ve her zaman ana `name`/`description` alanından okunur;
// diğer diller `translations` alanındaki opsiyonel çeviriden okunur, boşsa Türkçe'ye düşer.
export const DEFAULT_LOCALE = "tr";

export const SUPPORTED_LOCALES = ["tr", "en", "ar", "ru"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE) as Locale[];

export const localeLabels: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  ar: "العربية",
  ru: "Русский",
};

export const localeCodes: Record<Locale, string> = {
  tr: "TR",
  en: "EN",
  ar: "AR",
  ru: "RU",
};

export function isRTLLocale(locale: Locale): boolean {
  return locale === "ar";
}

// Çevrilebilir metin alanları. name/description varlıkların baz alanları;
// campaign_label ürünlere, group_name ürün seçeneklerine (varyant), title/message
// ise açılış popup'larına özeldir.
export type TranslatableField = "name" | "description" | "campaign_label" | "group_name" | "title" | "message";

export type Translations = Partial<Record<Locale, Partial<Record<TranslatableField, string>>>>;

export interface Translatable {
  name?: string;
  description?: string;
  campaign_label?: string;
  group_name?: string;
  title?: string;
  message?: string;
  translations?: Translations;
}

// Verilen alanı istenen dilde döndürür. Ana metin (name/description) işletmenin
// ana dilinde tutulur; istenen dil ana dilse doğrudan onu, değilse çeviriyi döner,
// çeviri yoksa/boşsa ana dile düşer.
export function tField(
  entity: Translatable,
  field: TranslatableField,
  locale: Locale,
  baseLocale: Locale = DEFAULT_LOCALE
): string {
  const base = entity[field] ?? "";
  if (locale === baseLocale) return base;
  const translated = entity.translations?.[locale]?.[field];
  return translated && translated.trim() !== "" ? translated : base;
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Bir işletmenin dil ayarını temsil eden minimal şekil.
export interface LangConfig {
  main_language?: Locale | null;
  languages?: Locale[] | null;
}

// İşletmenin ana (baz) dili. Ana metinler bu dilde tutulur. Seçilmemişse Türkçe.
export function mainLocale(config: LangConfig): Locale {
  return isSupportedLocale(config.main_language) ? config.main_language : DEFAULT_LOCALE;
}

// İşletmenin aktif dilleri; ana dil her zaman ilk sıradadır ve kapatılamaz,
// ek diller `languages` seçiminden gelir. Ne ana dil ne de `languages` alanı
// tanımlı değilse (eski kayıt / PB şemasına alanlar eklenmeden önce) tüm diller
// aktif sayılır ki mevcut davranış bozulmasın.
export function activeLocales(config: LangConfig): Locale[] {
  const main = mainLocale(config);
  if (config.main_language == null && config.languages == null) {
    return [main, ...SUPPORTED_LOCALES.filter((l) => l !== main)];
  }
  const extras = new Set((config.languages ?? []).filter(isSupportedLocale));
  return [main, ...SUPPORTED_LOCALES.filter((l) => l !== main && extras.has(l))];
}

// Çeviri girişinde kullanılan, ana dil dışındaki aktif diller.
export function activeNonMainLocales(config: LangConfig): Locale[] {
  const main = mainLocale(config);
  return activeLocales(config).filter((l) => l !== main);
}

const LOCALE_STORAGE_KEY = "buyur-locale";

// Ziyaretçinin seçtiği dili tarayıcıda hatırlar; SSR'da her zaman varsayılana düşer.
export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
}

// Ziyaretçi daha önce bir dil seçmiş mi? İlk açılışta dil seçim modalını
// göstermek için kullanılır (seçildikten sonra tekrar gösterilmez).
export function hasStoredLocale(): boolean {
  if (typeof window === "undefined") return true;
  return isSupportedLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

// Müşteri menüsündeki sabit arayüz metinleri (ürün/kategori adları değil — bunlar için tField kullanılır).
const UI_STRINGS = {
  back: { tr: "Geri", en: "Back", ar: "رجوع", ru: "Назад" },
  navMenu: { tr: "Menü", en: "Menu", ar: "القائمة", ru: "Меню" },
  navSearch: { tr: "Ara", en: "Search", ar: "بحث", ru: "Поиск" },
  navReview: { tr: "Değerlendir", en: "Review", ar: "تقييم", ru: "Отзыв" },
  loading: { tr: "Yükleniyor…", en: "Loading…", ar: "جارٍ التحميل…", ru: "Загрузка…" },
  menuPreparing: {
    tr: "Menü hazırlanıyor, birazdan burada olacak.",
    en: "The menu is being prepared, it'll be here shortly.",
    ar: "القائمة قيد التحضير، ستكون هنا قريبًا.",
    ru: "Меню готовится, скоро оно появится здесь.",
  },
  noProductsInCategory: {
    tr: "Bu kategoride henüz ürün yok.",
    en: "There are no products in this category yet.",
    ar: "لا توجد منتجات في هذه الفئة بعد.",
    ru: "В этой категории пока нет товаров.",
  },
  allergensLabel: { tr: "Alerjenler", en: "Allergens", ar: "مسببات الحساسية", ru: "Аллергены" },
  allergenPrefix: { tr: "Alerjen", en: "Allergens", ar: "مسببات الحساسية", ru: "Аллергены" },
  minUnit: { tr: "dk", en: "min", ar: "د", ru: "мин" },
  addToCart: { tr: "Sepete ekle", en: "Add to cart", ar: "أضف إلى السلة", ru: "В корзину" },
  searchPlaceholder: {
    tr: "Ürün ara… (ör. burger, latte)",
    en: "Search products… (e.g. burger, latte)",
    ar: "ابحث عن منتج… (مثل برجر، لاتيه)",
    ru: "Поиск блюд… (например, бургер, латте)",
  },
  searchHint: {
    tr: "Menüdeki tüm ürünlerde arama yap.",
    en: "Search across all products in the menu.",
    ar: "ابحث في جميع منتجات القائمة.",
    ru: "Поиск по всем блюдам меню.",
  },
  noSearchResults: {
    tr: "“{query}” için sonuç bulunamadı.",
    en: "No results found for “{query}”.",
    ar: "لا توجد نتائج لـ «{query}».",
    ru: "По запросу «{query}» ничего не найдено.",
  },
  reviewUsCta: { tr: "Bizi değerlendir!", en: "Rate us!", ar: "قيّمنا!", ru: "Оцените нас!" },
  reviewBannerTitle: {
    tr: "Deneyiminizi Değerlendirin",
    en: "Rate Your Experience",
    ar: "قيّم تجربتك",
    ru: "Оцените ваш опыт",
  },
  reviewBannerSubtitle: {
    tr: "Görüşleriniz bizim için çok değerli. Birkaç saniyede puanlayın.",
    en: "Your feedback matters to us. Share your thoughts in seconds.",
    ar: "رأيك يهمنا كثيرًا. شاركنا تقييمك في ثوانٍ معدودة.",
    ru: "Ваше мнение очень важно для нас. Оцените за пару секунд.",
  },
  reviewBannerButton: {
    tr: "Puan Verin",
    en: "Rate Now",
    ar: "قيّم الآن",
    ru: "Оценить",
  },
  menuButton: { tr: "Menü", en: "Menu", ar: "القائمة", ru: "Меню" },
  wifiPasswordLabel: { tr: "Wifi Şifresi", en: "Wifi Password", ar: "كلمة مرور الواي فاي", ru: "Пароль Wi-Fi" },
  addressLabel: { tr: "Adres", en: "Address", ar: "العنوان", ru: "Адрес" },
  phoneLabel: { tr: "Telefon", en: "Phone", ar: "الهاتف", ru: "Телефон" },
  locationLabel: { tr: "Konum", en: "Location", ar: "الموقع", ru: "Локация" },
  workingHoursLabel: { tr: "Çalışma Saatleri", en: "Working Hours", ar: "ساعات العمل", ru: "Часы работы" },
  showOnMap: { tr: "Haritada göster", en: "Show on map", ar: "أظهر على الخريطة", ru: "Показать на карте" },
  reviewTitle: { tr: "Bizi değerlendir", en: "Rate us", ar: "قيّمنا", ru: "Оцените нас" },
  firstVisitQuestion: {
    tr: "İlk defa mı ziyaret ediyorsunuz?",
    en: "Is this your first visit?",
    ar: "هل هذه زيارتك الأولى؟",
    ru: "Вы посещаете нас впервые?",
  },
  yes: { tr: "Evet", en: "Yes", ar: "نعم", ru: "Да" },
  no: { tr: "Hayır", en: "No", ar: "لا", ru: "Нет" },
  hygieneQuestion: {
    tr: "Hijyeni nasıl değerlendiriyorsunuz?",
    en: "How would you rate our hygiene?",
    ar: "كيف تقيّم مستوى النظافة؟",
    ru: "Как вы оцениваете гигиену?",
  },
  satisfactionQuestion: {
    tr: "Genel memnuniyetiniz nasıldır?",
    en: "How satisfied are you overall?",
    ar: "ما مدى رضاك العام؟",
    ru: "Насколько вы в целом довольны?",
  },
  revisitQuestion: {
    tr: "Tekrar ziyaret etmeyi düşünür müsünüz?",
    en: "Would you consider visiting again?",
    ar: "هل تفكر في زيارتنا مرة أخرى؟",
    ru: "Рассмотрите ли вы повторный визит?",
  },
  otherCommentsQuestion: {
    tr: "Bizimle paylaşmak istediğiniz başka bir konu var mı?",
    en: "Anything else you'd like to share with us?",
    ar: "هل هناك أي شيء آخر تود مشاركته معنا؟",
    ru: "Хотите поделиться чем-то ещё?",
  },
  commentPlaceholder: { tr: "Görüşlerini yaz…", en: "Write your thoughts…", ar: "اكتب رأيك…", ru: "Напишите ваш отзыв…" },
  send: { tr: "Gönder", en: "Send", ar: "إرسال", ru: "Отправить" },
  sending: { tr: "Gönderiliyor…", en: "Sending…", ar: "جارٍ الإرسال…", ru: "Отправка…" },
  reviewMinOneError: {
    tr: "Göndermeden önce en az bir soruyu yanıtla.",
    en: "Answer at least one question before sending.",
    ar: "أجب عن سؤال واحد على الأقل قبل الإرسال.",
    ru: "Ответьте хотя бы на один вопрос перед отправкой.",
  },
  reviewSendError: {
    tr: "Gönderilemedi, tekrar dene.",
    en: "Couldn't be sent, please try again.",
    ar: "تعذر الإرسال، حاول مرة أخرى.",
    ru: "Не удалось отправить, попробуйте снова.",
  },
  thankYouTitle: { tr: "Teşekkürler!", en: "Thank you!", ar: "شكرًا لك!", ru: "Спасибо!" },
  thankYouBody: {
    tr: "Değerlendirmen bize ulaştı. Görüşlerin {name} için çok değerli.",
    en: "Your review has reached us. Your feedback means a lot to {name}.",
    ar: "وصلنا تقييمك. رأيك يعني الكثير لـ {name}.",
    ru: "Ваш отзыв получен. Ваше мнение очень важно для {name}.",
  },
  googleReviewCta: {
    tr: "Google'da da değerlendir",
    en: "Also review us on Google",
    ar: "قيّمنا أيضًا على جوجل",
    ru: "Оцените нас также в Google",
  },
  orGoogleReview: {
    tr: "veya doğrudan Google'da değerlendir",
    en: "or review directly on Google",
    ar: "أو قيّم مباشرة على جوجل",
    ru: "или оцените напрямую в Google",
  },
  backToMenu: { tr: "Menüye dön", en: "Back to menu", ar: "العودة إلى القائمة", ru: "Вернуться в меню" },
  starAria: { tr: "{n} yıldız", en: "{n} stars", ar: "{n} نجوم", ru: "{n} звёзд" },
  cartBarLabel: { tr: "Sepet · {count} ürün", en: "Cart · {count} items", ar: "السلة · {count} عناصر", ru: "Корзина · {count} тов." },
  cartTitle: { tr: "Sepetin", en: "Your cart", ar: "سلتك", ru: "Ваша корзина" },
  close: { tr: "Kapat", en: "Close", ar: "إغلاق", ru: "Закрыть" },
  cartEmpty: { tr: "Sepetin boş.", en: "Your cart is empty.", ar: "سلتك فارغة.", ru: "Ваша корзина пуста." },
  decrease: { tr: "Azalt", en: "Decrease", ar: "إنقاص", ru: "Уменьшить" },
  increase: { tr: "Artır", en: "Increase", ar: "زيادة", ru: "Увеличить" },
  remove: { tr: "Kaldır", en: "Remove", ar: "إزالة", ru: "Удалить" },
  total: { tr: "Toplam", en: "Total", ar: "الإجمالي", ru: "Итого" },
  showToWaiter: {
    tr: "Siparişini vermek için bu ekranı garsona göster.",
    en: "Show this screen to your server to place the order.",
    ar: "أظهر هذه الشاشة للنادل لتقديم طلبك.",
    ru: "Покажите этот экран официанту, чтобы сделать заказ.",
  },
  viewMenu: { tr: "Menüye göz at", en: "View menu", ar: "تصفح القائمة", ru: "Смотреть меню" },
  // Sepete ekleme sonrası küçük öneri (components/menu/upsell-sheet.tsx).
  upsellTitle: {
    tr: "Yanına içecek ister misin?",
    en: "Something to drink with it?",
    ar: "هل تريد مشروبًا معه؟",
    ru: "Добавить напиток?",
  },
  upsellAdded: {
    tr: "{name} sepete eklendi",
    en: "{name} added to your cart",
    ar: "تمت إضافة {name} إلى السلة",
    ru: "{name} в корзине",
  },
  noThanks: { tr: "Hayır, teşekkürler", en: "No, thanks", ar: "لا، شكرًا", ru: "Нет, спасибо" },
  chooseLanguage: { tr: "Dil seçin", en: "Choose language", ar: "اختر اللغة", ru: "Выберите язык" },
  categoriesLabel: { tr: "Kategoriler", en: "Categories", ar: "الفئات", ru: "Категории" },
  productCount: {
    tr: "{count} ürün",
    en: "{count} items",
    ar: "{count} منتج",
    ru: "{count} товаров",
  },
  menuFeatured: { tr: "Öne çıkanlar", en: "Featured", ar: "الأطباق المميزة", ru: "Рекомендуем" },
  menuAllCategories: { tr: "Tüm kategoriler", en: "All categories", ar: "كل الفئات", ru: "Все категории" },
  menuSearchCta: { tr: "Menüde ara", en: "Search the menu", ar: "ابحث في القائمة", ru: "Поиск по меню" },
  splashMessage: {
    tr: "Sizin için hazırlıyoruz…",
    en: "Getting everything ready for you…",
    ar: "نجهّز كل شيء من أجلك…",
    ru: "Готовим всё для вас…",
  },

  // Otomatik web sitesi (app/site/[slug]) — sabit bölüm başlıkları ve etiketler.
  siteAbout: { tr: "Hakkımızda", en: "About us", ar: "من نحن", ru: "О нас" },
  siteFeatured: { tr: "Öne çıkanlar", en: "Featured", ar: "الأطباق المميزة", ru: "Рекомендуем" },
  siteFeaturedSubtitle: {
    tr: "Menümüzden seçmeler",
    en: "Picks from our menu",
    ar: "مختارات من قائمتنا",
    ru: "Подборка из меню",
  },
  siteMenuTitle: { tr: "Menü", en: "Menu", ar: "القائمة", ru: "Меню" },
  siteMenuSubtitle: {
    tr: "Kategorilere göz atın",
    en: "Browse categories",
    ar: "تصفح الفئات",
    ru: "Обзор категорий",
  },
  siteGallery: { tr: "Galeri", en: "Gallery", ar: "معرض الصور", ru: "Галерея" },
  siteHighlights: { tr: "Mekân özellikleri", en: "Venue features", ar: "مزايا المكان", ru: "Особенности заведения" },
  siteContact: { tr: "İletişim", en: "Contact", ar: "تواصل معنا", ru: "Контакты" },
  siteReservationTitle: {
    tr: "Masanızı ayırtın",
    en: "Reserve your table",
    ar: "احجز طاولتك",
    ru: "Забронировать столик",
  },
  siteReservationSubtitle: {
    tr: "{name} için yer ayırtmak birkaç saniye sürüyor.",
    en: "Reserving a table at {name} takes just a few seconds.",
    ar: "حجز طاولة في {name} يستغرق ثوانٍ فقط.",
    ru: "Бронирование столика в {name} займёт всего пару секунд.",
  },
  reservationViaWhatsapp: {
    tr: "WhatsApp'tan rezervasyon",
    en: "Reserve via WhatsApp",
    ar: "احجز عبر واتساب",
    ru: "Бронь через WhatsApp",
  },
  reservationViaPhone: {
    tr: "Telefonla rezervasyon",
    en: "Reserve by phone",
    ar: "احجز عبر الهاتف",
    ru: "Бронь по телефону",
  },
  reservationViaUrl: { tr: "Rezervasyon yap", en: "Book a table", ar: "احجز طاولة", ru: "Забронировать" },
  emailLabel: { tr: "E-posta", en: "Email", ar: "البريد الإلكتروني", ru: "Эл. почта" },
  googleReviewLinkLabel: {
    tr: "Google'da değerlendirin",
    en: "Review us on Google",
    ar: "قيّمنا على جوجل",
    ru: "Оцените нас в Google",
  },
  directionsLabel: { tr: "Yol tarifi al", en: "Get directions", ar: "احصل على الاتجاهات", ru: "Проложить маршрут" },
  openDigitalMenu: {
    tr: "Dijital menüyü aç",
    en: "Open digital menu",
    ar: "افتح القائمة الرقمية",
    ru: "Открыть цифровое меню",
  },
  imageCreditsTitle: {
    tr: "Görsel kaynakları",
    en: "Image credits",
    ar: "مصادر الصور",
    ru: "Источники изображений",
  },
  imageCreditsIntro: {
    tr: "Bu menüdeki bazı ürün görselleri açık lisanslı kaynaklardan alınmıştır.",
    en: "Some product photos in this menu come from openly licensed sources.",
    ar: "بعض صور المنتجات في هذه القائمة مأخوذة من مصادر ذات ترخيص مفتوح.",
    ru: "Некоторые фотографии блюд в этом меню взяты из источников со свободной лицензией.",
  },
  imageCreditsEmpty: {
    tr: "Bu menüde künye gerektiren görsel bulunmuyor.",
    en: "No photos in this menu require credit.",
    ar: "لا توجد صور في هذه القائمة تتطلب نسب المصدر.",
    ru: "В этом меню нет изображений, требующих указания авторства.",
  },
  photoBy: { tr: "Fotoğraf: {author}", en: "Photo: {author}", ar: "تصوير: {author}", ru: "Фото: {author}" },
  poweredByBuyur: {
    tr: "buyur ile hazırlandı",
    en: "made with buyur",
    ar: "صُنع بواسطة buyur",
    ru: "сделано с buyur",
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type UIKey = keyof typeof UI_STRINGS;

// Statik arayüz metinlerini seçili dile çevirir; {token} biçimindeki yer tutucuları vars ile değiştirir.
export function t(locale: Locale, key: UIKey, vars?: Record<string, string | number>): string {
  const template: string = UI_STRINGS[key][locale] ?? UI_STRINGS[key][DEFAULT_LOCALE];
  if (!vars) return template;
  return Object.entries(vars).reduce((acc: string, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);
}
