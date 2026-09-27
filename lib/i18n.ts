// Menü içeriğinin (işletme/kategori/ürün adı ve açıklaması) dilleri. Ana metin
// işletmenin ana dilinde `name`/`description` gibi baz alanlarda durur; diğer
// diller `translations` alanından okunur, boşsa ana dile düşer (tField).
//
// Bu dosya MÜŞTERİ MENÜSÜNÜN ve işletme sitesinin dillerini tanımlar. Pazarlama
// sitesi ile işletme panelinin arayüz dili ayrı bir sistemdir: lib/ui-i18n.ts.
//
// Yeni dil eklemek: SUPPORTED_LOCALES + aşağıdaki Record<Locale, …> tabloları
// (TypeScript eksik olanı söyler) + lib/labels.ts + PocketBase `main_language` /
// `languages` seçenekleri (scripts/storefront-schema.mjs, göçü
// scripts/migrate-storefront-i18n.mjs). Ayrıntı: docs/localization.md.
export const DEFAULT_LOCALE = "tr";

// Sıra dil seçicilerdeki sıradır.
export const SUPPORTED_LOCALES = ["tr", "en", "de", "ar", "fr", "es", "it", "ru"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Bir işletmenin menüsünde aynı anda açık olabilecek dil sayısı (ana dil
 *  dahil). Her dil, her üründe ayrı bir çeviri demektir; misafirin seçicisi de
 *  kısa kalır. PocketBase'de `languages.maxSelect` = bu − 1. */
export const MAX_MENU_LOCALES = 4;

/** Dil ayarı hiç yapılmamış eski kayıtlarda "tüm diller" bu listeydi. Sonradan
 *  eklenen diller bu işletmelerin seçicisine kendiliğinden eklenmez: içeriği
 *  olmayan bir dil misafire boşuna sunulmasın. */
const LEGACY_ALL_LOCALES: readonly Locale[] = ["tr", "en", "ar", "ru"];

export const localeLabels: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  ar: "العربية",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  ru: "Русский",
};

/** Yapay zekâ çevirisine verilen dil adı. */
export const localeAiNames: Record<Locale, string> = {
  tr: "Turkish",
  en: "English",
  de: "German",
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
};

/** Tarih/sayı biçimi ve büyük-küçük harf dönüşümü için BCP 47 etiketi. */
export const localeTags: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
  de: "de-DE",
  ar: "ar-SA",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  ru: "ru-RU",
};

/** Dillerin Türkçe adları — panelin Türkçe cümlelerinde kullanılır
 *  ("İngilizce için ad dolduruldu"). Dil seçicilerde kendi adları
 *  (localeLabels) gösterilir. */
export const localeNamesTr: Record<Locale, string> = {
  tr: "Türkçe",
  en: "İngilizce",
  de: "Almanca",
  ar: "Arapça",
  fr: "Fransızca",
  es: "İspanyolca",
  it: "İtalyanca",
  ru: "Rusça",
};

/** Dillerin İngilizce adları — panel İngilizce açıkken aynı cümlelerde kullanılır. */
export const localeNamesEn: Record<Locale, string> = {
  tr: "Turkish",
  en: "English",
  de: "German",
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
};

export const localeCodes: Record<Locale, string> = {
  tr: "TR",
  en: "EN",
  de: "DE",
  ar: "AR",
  fr: "FR",
  es: "ES",
  it: "IT",
  ru: "RU",
};

export function isRTLLocale(locale: Locale): boolean {
  return locale === "ar";
}

// Çevrilebilir metin alanları. name/description varlıkların baz alanları;
// campaign_label ürünlere, group_name ürün seçeneklerine (varyant), title/message
// açılış popup'larına, marquee_text ise işletmenin kayan yazısına özeldir.
export type TranslatableField =
  | "name"
  | "description"
  | "campaign_label"
  | "group_name"
  | "title"
  | "message"
  | "marquee_text";

export type Translations = Partial<Record<Locale, Partial<Record<TranslatableField, string>>>>;

export interface Translatable {
  name?: string;
  description?: string;
  campaign_label?: string;
  group_name?: string;
  title?: string;
  message?: string;
  marquee_text?: string;
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
// tanımlı değilse (eski kayıt / PB şemasına alanlar eklenmeden önce) eski "tüm
// diller" listesi aktif sayılır ki mevcut davranış bozulmasın. Sonuç hiçbir
// zaman MAX_MENU_LOCALES'i aşmaz: şema sınırı gevşek bir kurulumda bile menü
// ve panel aynı dilleri gösterir.
export function activeLocales(config: LangConfig): Locale[] {
  const main = mainLocale(config);
  if (config.main_language == null && config.languages == null) {
    return [main, ...LEGACY_ALL_LOCALES.filter((l) => l !== main)].slice(0, MAX_MENU_LOCALES);
  }
  const extras = new Set((config.languages ?? []).filter(isSupportedLocale));
  return [main, ...SUPPORTED_LOCALES.filter((l) => l !== main && extras.has(l))].slice(0, MAX_MENU_LOCALES);
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
export const UI_STRINGS = {
  back: { tr: "Geri", en: "Back", de: "Zurück", ar: "رجوع", fr: "Retour", es: "Volver", it: "Indietro", ru: "Назад" },
  navMenu: { tr: "Menü", en: "Menu", de: "Speisekarte", ar: "القائمة", fr: "Menu", es: "Carta", it: "Menù", ru: "Меню" },
  navSearch: { tr: "Ara", en: "Search", de: "Suchen", ar: "بحث", fr: "Rechercher", es: "Buscar", it: "Cerca", ru: "Поиск" },
  navReview: { tr: "Değerlendir", en: "Review", de: "Bewerten", ar: "تقييم", fr: "Donner un avis", es: "Valorar", it: "Valuta", ru: "Отзыв" },
  loading: {
    tr: "Yükleniyor…",
    en: "Loading…",
    de: "Wird geladen…",
    ar: "جارٍ التحميل…",
    fr: "Chargement…",
    es: "Cargando…",
    it: "Caricamento…",
    ru: "Загрузка…",
  },
  menuPreparing: {
    tr: "Menü hazırlanıyor, birazdan burada olacak.",
    en: "The menu is being prepared, it'll be here shortly.",
    de: "Die Speisekarte wird vorbereitet und ist gleich da.",
    ar: "القائمة قيد التحضير، ستكون هنا قريبًا.",
    fr: "Le menu est en préparation, il arrive dans un instant.",
    es: "La carta se está preparando, estará aquí en breve.",
    it: "Il menù è in preparazione, sarà qui a breve.",
    ru: "Меню готовится, скоро оно появится здесь.",
  },
  noProductsInCategory: {
    tr: "Bu kategoride henüz ürün yok.",
    en: "There are no products in this category yet.",
    de: "In dieser Kategorie gibt es noch keine Produkte.",
    ar: "لا توجد منتجات في هذه الفئة بعد.",
    fr: "Il n'y a pas encore de produits dans cette catégorie.",
    es: "Todavía no hay productos en esta categoría.",
    it: "Non ci sono ancora prodotti in questa categoria.",
    ru: "В этой категории пока нет товаров.",
  },
  allergensLabel: {
    tr: "Alerjenler",
    en: "Allergens",
    de: "Allergene",
    ar: "مسببات الحساسية",
    fr: "Allergènes",
    es: "Alérgenos",
    it: "Allergeni",
    ru: "Аллергены",
  },
  allergenPrefix: {
    tr: "Alerjen",
    en: "Allergens",
    de: "Allergene",
    ar: "مسببات الحساسية",
    fr: "Allergènes",
    es: "Alérgenos",
    it: "Allergeni",
    ru: "Аллергены",
  },
  minUnit: { tr: "dk", en: "min", de: "Min.", ar: "د", fr: "min", es: "min", it: "min", ru: "мин" },
  addToCart: {
    tr: "Sepete ekle",
    en: "Add to cart",
    de: "In den Warenkorb",
    ar: "أضف إلى السلة",
    fr: "Ajouter au panier",
    es: "Añadir al carrito",
    it: "Aggiungi al carrello",
    ru: "В корзину",
  },
  searchPlaceholder: {
    tr: "Ürün ara… (ör. burger, latte)",
    en: "Search products… (e.g. burger, latte)",
    de: "Produkte suchen… (z. B. Burger, Latte)",
    ar: "ابحث عن منتج… (مثل برجر، لاتيه)",
    fr: "Rechercher un produit… (ex. burger, latte)",
    es: "Buscar productos… (p. ej. hamburguesa, latte)",
    it: "Cerca prodotti… (es. burger, latte)",
    ru: "Поиск блюд… (например, бургер, латте)",
  },
  searchHint: {
    tr: "Menüdeki tüm ürünlerde arama yap.",
    en: "Search across all products in the menu.",
    de: "Durchsuche alle Produkte der Speisekarte.",
    ar: "ابحث في جميع منتجات القائمة.",
    fr: "Recherchez parmi tous les produits du menu.",
    es: "Busca entre todos los productos de la carta.",
    it: "Cerca tra tutti i prodotti del menù.",
    ru: "Поиск по всем блюдам меню.",
  },
  noSearchResults: {
    tr: "“{query}” için sonuç bulunamadı.",
    en: "No results found for “{query}”.",
    de: "Keine Ergebnisse für „{query}“.",
    ar: "لا توجد نتائج لـ «{query}».",
    fr: "Aucun résultat pour « {query} ».",
    es: "No hay resultados para «{query}».",
    it: "Nessun risultato per «{query}».",
    ru: "По запросу «{query}» ничего не найдено.",
  },
  reviewUsCta: {
    tr: "Bizi değerlendir!",
    en: "Rate us!",
    de: "Bewerte uns!",
    ar: "قيّمنا!",
    fr: "Donnez-nous votre avis !",
    es: "¡Valóranos!",
    it: "Valutaci!",
    ru: "Оцените нас!",
  },
  reviewBannerTitle: {
    tr: "Deneyiminizi Değerlendirin",
    en: "Rate Your Experience",
    de: "Bewerte deinen Besuch",
    ar: "قيّم تجربتك",
    fr: "Évaluez votre expérience",
    es: "Valora tu experiencia",
    it: "Valuta la tua esperienza",
    ru: "Оцените ваш опыт",
  },
  reviewBannerSubtitle: {
    tr: "Görüşleriniz bizim için çok değerli. Birkaç saniyede puanlayın.",
    en: "Your feedback matters to us. Share your thoughts in seconds.",
    de: "Deine Meinung ist uns wichtig. Die Bewertung dauert nur ein paar Sekunden.",
    ar: "رأيك يهمنا كثيرًا. شاركنا تقييمك في ثوانٍ معدودة.",
    fr: "Votre avis compte pour nous. Quelques secondes suffisent.",
    es: "Tu opinión nos importa. Solo te llevará unos segundos.",
    it: "La tua opinione è importante per noi. Bastano pochi secondi.",
    ru: "Ваше мнение очень важно для нас. Оцените за пару секунд.",
  },
  reviewBannerButton: {
    tr: "Puan Verin",
    en: "Rate Now",
    de: "Jetzt bewerten",
    ar: "قيّم الآن",
    fr: "Évaluer",
    es: "Valorar ahora",
    it: "Valuta ora",
    ru: "Оценить",
  },
  menuButton: { tr: "Menü", en: "Menu", de: "Speisekarte", ar: "القائمة", fr: "Menu", es: "Carta", it: "Menù", ru: "Меню" },
  wifiPasswordLabel: {
    tr: "Wifi Şifresi",
    en: "Wifi Password",
    de: "WLAN-Passwort",
    ar: "كلمة مرور الواي فاي",
    fr: "Mot de passe Wi-Fi",
    es: "Contraseña del Wi-Fi",
    it: "Password Wi-Fi",
    ru: "Пароль Wi-Fi",
  },
  addressLabel: { tr: "Adres", en: "Address", de: "Adresse", ar: "العنوان", fr: "Adresse", es: "Dirección", it: "Indirizzo", ru: "Адрес" },
  phoneLabel: { tr: "Telefon", en: "Phone", de: "Telefon", ar: "الهاتف", fr: "Téléphone", es: "Teléfono", it: "Telefono", ru: "Телефон" },
  locationLabel: { tr: "Konum", en: "Location", de: "Standort", ar: "الموقع", fr: "Emplacement", es: "Ubicación", it: "Posizione", ru: "Локация" },
  workingHoursLabel: {
    tr: "Çalışma Saatleri",
    en: "Working Hours",
    de: "Öffnungszeiten",
    ar: "ساعات العمل",
    fr: "Horaires d'ouverture",
    es: "Horario",
    it: "Orari di apertura",
    ru: "Часы работы",
  },
  showOnMap: {
    tr: "Haritada göster",
    en: "Show on map",
    de: "Auf der Karte zeigen",
    ar: "أظهر على الخريطة",
    fr: "Voir sur la carte",
    es: "Ver en el mapa",
    it: "Mostra sulla mappa",
    ru: "Показать на карте",
  },
  reviewTitle: {
    tr: "Bizi değerlendir",
    en: "Rate us",
    de: "Bewerte uns",
    ar: "قيّمنا",
    fr: "Donnez votre avis",
    es: "Valóranos",
    it: "Valutaci",
    ru: "Оцените нас",
  },
  firstVisitQuestion: {
    tr: "İlk defa mı ziyaret ediyorsunuz?",
    en: "Is this your first visit?",
    de: "Bist du zum ersten Mal hier?",
    ar: "هل هذه زيارتك الأولى؟",
    fr: "Est-ce votre première visite ?",
    es: "¿Es tu primera visita?",
    it: "È la tua prima visita?",
    ru: "Вы посещаете нас впервые?",
  },
  yes: { tr: "Evet", en: "Yes", de: "Ja", ar: "نعم", fr: "Oui", es: "Sí", it: "Sì", ru: "Да" },
  no: { tr: "Hayır", en: "No", de: "Nein", ar: "لا", fr: "Non", es: "No", it: "No", ru: "Нет" },
  hygieneQuestion: {
    tr: "Hijyeni nasıl değerlendiriyorsunuz?",
    en: "How would you rate our hygiene?",
    de: "Wie bewertest du die Hygiene?",
    ar: "كيف تقيّم مستوى النظافة؟",
    fr: "Comment évaluez-vous l'hygiène ?",
    es: "¿Cómo valoras la higiene?",
    it: "Come valuti l'igiene?",
    ru: "Как вы оцениваете гигиену?",
  },
  satisfactionQuestion: {
    tr: "Genel memnuniyetiniz nasıldır?",
    en: "How satisfied are you overall?",
    de: "Wie zufrieden bist du insgesamt?",
    ar: "ما مدى رضاك العام؟",
    fr: "Êtes-vous satisfait dans l'ensemble ?",
    es: "¿Qué tan satisfecho estás en general?",
    it: "Quanto sei soddisfatto nel complesso?",
    ru: "Насколько вы в целом довольны?",
  },
  revisitQuestion: {
    tr: "Tekrar ziyaret etmeyi düşünür müsünüz?",
    en: "Would you consider visiting again?",
    de: "Würdest du uns wieder besuchen?",
    ar: "هل تفكر في زيارتنا مرة أخرى؟",
    fr: "Envisageriez-vous de revenir ?",
    es: "¿Volverías a visitarnos?",
    it: "Torneresti a trovarci?",
    ru: "Рассмотрите ли вы повторный визит?",
  },
  otherCommentsQuestion: {
    tr: "Bizimle paylaşmak istediğiniz başka bir konu var mı?",
    en: "Anything else you'd like to share with us?",
    de: "Möchtest du uns noch etwas mitteilen?",
    ar: "هل هناك أي شيء آخر تود مشاركته معنا؟",
    fr: "Souhaitez-vous nous dire autre chose ?",
    es: "¿Hay algo más que quieras contarnos?",
    it: "C'è altro che vorresti condividere con noi?",
    ru: "Хотите поделиться чем-то ещё?",
  },
  commentPlaceholder: {
    tr: "Görüşlerini yaz…",
    en: "Write your thoughts…",
    de: "Schreib uns deine Meinung…",
    ar: "اكتب رأيك…",
    fr: "Écrivez votre avis…",
    es: "Escribe tu opinión…",
    it: "Scrivi la tua opinione…",
    ru: "Напишите ваш отзыв…",
  },
  send: { tr: "Gönder", en: "Send", de: "Senden", ar: "إرسال", fr: "Envoyer", es: "Enviar", it: "Invia", ru: "Отправить" },
  sending: {
    tr: "Gönderiliyor…",
    en: "Sending…",
    de: "Wird gesendet…",
    ar: "جارٍ الإرسال…",
    fr: "Envoi…",
    es: "Enviando…",
    it: "Invio…",
    ru: "Отправка…",
  },
  reviewMinOneError: {
    tr: "Göndermeden önce en az bir soruyu yanıtla.",
    en: "Answer at least one question before sending.",
    de: "Beantworte vor dem Senden mindestens eine Frage.",
    ar: "أجب عن سؤال واحد على الأقل قبل الإرسال.",
    fr: "Répondez à au moins une question avant d'envoyer.",
    es: "Responde al menos una pregunta antes de enviar.",
    it: "Rispondi ad almeno una domanda prima di inviare.",
    ru: "Ответьте хотя бы на один вопрос перед отправкой.",
  },
  reviewSendError: {
    tr: "Gönderilemedi, tekrar dene.",
    en: "Couldn't be sent, please try again.",
    de: "Senden fehlgeschlagen, bitte erneut versuchen.",
    ar: "تعذر الإرسال، حاول مرة أخرى.",
    fr: "L'envoi a échoué, veuillez réessayer.",
    es: "No se pudo enviar, inténtalo de nuevo.",
    it: "Invio non riuscito, riprova.",
    ru: "Не удалось отправить, попробуйте снова.",
  },
  thankYouTitle: {
    tr: "Teşekkürler!",
    en: "Thank you!",
    de: "Danke!",
    ar: "شكرًا لك!",
    fr: "Merci !",
    es: "¡Gracias!",
    it: "Grazie!",
    ru: "Спасибо!",
  },
  thankYouBody: {
    tr: "Değerlendirmen bize ulaştı. Görüşlerin {name} için çok değerli.",
    en: "Your review has reached us. Your feedback means a lot to {name}.",
    de: "Deine Bewertung ist angekommen. Deine Meinung bedeutet {name} sehr viel.",
    ar: "وصلنا تقييمك. رأيك يعني الكثير لـ {name}.",
    fr: "Votre avis nous est bien parvenu. Il compte beaucoup pour {name}.",
    es: "Hemos recibido tu valoración. Tu opinión es muy valiosa para {name}.",
    it: "La tua valutazione è arrivata. La tua opinione è preziosa per {name}.",
    ru: "Ваш отзыв получен. Ваше мнение очень важно для {name}.",
  },
  googleReviewCta: {
    tr: "Google'da da değerlendir",
    en: "Also review us on Google",
    de: "Bewerte uns auch auf Google",
    ar: "قيّمنا أيضًا على جوجل",
    fr: "Laissez aussi un avis sur Google",
    es: "Valóranos también en Google",
    it: "Valutaci anche su Google",
    ru: "Оцените нас также в Google",
  },
  orGoogleReview: {
    tr: "veya doğrudan Google'da değerlendir",
    en: "or review directly on Google",
    de: "oder direkt auf Google bewerten",
    ar: "أو قيّم مباشرة على جوجل",
    fr: "ou laissez un avis directement sur Google",
    es: "o valóranos directamente en Google",
    it: "o valutaci direttamente su Google",
    ru: "или оцените напрямую в Google",
  },
  backToMenu: {
    tr: "Menüye dön",
    en: "Back to menu",
    de: "Zurück zur Speisekarte",
    ar: "العودة إلى القائمة",
    fr: "Retour au menu",
    es: "Volver a la carta",
    it: "Torna al menù",
    ru: "Вернуться в меню",
  },
  starAria: {
    tr: "{n} yıldız",
    en: "{n} stars",
    de: "{n} Sterne",
    ar: "{n} نجوم",
    fr: "{n} étoiles",
    es: "{n} estrellas",
    it: "{n} stelle",
    ru: "{n} звёзд",
  },
  cartBarLabel: {
    tr: "Sepet · {count} ürün",
    en: "Cart · {count} items",
    de: "Warenkorb · {count} Artikel",
    ar: "السلة · {count} عناصر",
    fr: "Panier · {count} articles",
    es: "Carrito · {count} productos",
    it: "Carrello · {count} prodotti",
    ru: "Корзина · {count} тов.",
  },
  cartTitle: {
    tr: "Sepetin",
    en: "Your cart",
    de: "Dein Warenkorb",
    ar: "سلتك",
    fr: "Votre panier",
    es: "Tu carrito",
    it: "Il tuo carrello",
    ru: "Ваша корзина",
  },
  close: { tr: "Kapat", en: "Close", de: "Schließen", ar: "إغلاق", fr: "Fermer", es: "Cerrar", it: "Chiudi", ru: "Закрыть" },
  cartEmpty: {
    tr: "Sepetin boş.",
    en: "Your cart is empty.",
    de: "Dein Warenkorb ist leer.",
    ar: "سلتك فارغة.",
    fr: "Votre panier est vide.",
    es: "Tu carrito está vacío.",
    it: "Il tuo carrello è vuoto.",
    ru: "Ваша корзина пуста.",
  },
  decrease: { tr: "Azalt", en: "Decrease", de: "Weniger", ar: "إنقاص", fr: "Diminuer", es: "Reducir", it: "Diminuisci", ru: "Уменьшить" },
  increase: { tr: "Artır", en: "Increase", de: "Mehr", ar: "زيادة", fr: "Augmenter", es: "Aumentar", it: "Aumenta", ru: "Увеличить" },
  remove: { tr: "Kaldır", en: "Remove", de: "Entfernen", ar: "إزالة", fr: "Retirer", es: "Quitar", it: "Rimuovi", ru: "Удалить" },
  total: { tr: "Toplam", en: "Total", de: "Gesamt", ar: "الإجمالي", fr: "Total", es: "Total", it: "Totale", ru: "Итого" },
  showToWaiter: {
    tr: "Siparişini vermek için bu ekranı garsona göster.",
    en: "Show this screen to your server to place the order.",
    de: "Zeig diesen Bildschirm dem Service, um zu bestellen.",
    ar: "أظهر هذه الشاشة للنادل لتقديم طلبك.",
    fr: "Montrez cet écran au serveur pour passer commande.",
    es: "Muestra esta pantalla al camarero para hacer tu pedido.",
    it: "Mostra questa schermata al cameriere per ordinare.",
    ru: "Покажите этот экран официанту, чтобы сделать заказ.",
  },
  viewMenu: {
    tr: "Menüye göz at",
    en: "View menu",
    de: "Speisekarte ansehen",
    ar: "تصفح القائمة",
    fr: "Voir le menu",
    es: "Ver la carta",
    it: "Sfoglia il menù",
    ru: "Смотреть меню",
  },
  // Sepete ekleme sonrası küçük öneri (components/menu/upsell-sheet.tsx).
  upsellTitle: {
    tr: "Yanına içecek ister misin?",
    en: "Something to drink with it?",
    de: "Etwas zu trinken dazu?",
    ar: "هل تريد مشروبًا معه؟",
    fr: "Une boisson pour accompagner ?",
    es: "¿Algo de beber para acompañar?",
    it: "Qualcosa da bere in abbinamento?",
    ru: "Добавить напиток?",
  },
  upsellAdded: {
    tr: "{name} sepete eklendi",
    en: "{name} added to your cart",
    de: "{name} wurde in den Warenkorb gelegt",
    ar: "تمت إضافة {name} إلى السلة",
    fr: "{name} a été ajouté au panier",
    es: "{name} se añadió al carrito",
    it: "{name} aggiunto al carrello",
    ru: "{name} в корзине",
  },
  noThanks: {
    tr: "Hayır, teşekkürler",
    en: "No, thanks",
    de: "Nein, danke",
    ar: "لا، شكرًا",
    fr: "Non merci",
    es: "No, gracias",
    it: "No, grazie",
    ru: "Нет, спасибо",
  },
  chooseLanguage: {
    tr: "Dil seçin",
    en: "Choose language",
    de: "Sprache wählen",
    ar: "اختر اللغة",
    fr: "Choisir la langue",
    es: "Elige el idioma",
    it: "Scegli la lingua",
    ru: "Выберите язык",
  },
  categoriesLabel: {
    tr: "Kategoriler",
    en: "Categories",
    de: "Kategorien",
    ar: "الفئات",
    fr: "Catégories",
    es: "Categorías",
    it: "Categorie",
    ru: "Категории",
  },
  productCount: {
    tr: "{count} ürün",
    en: "{count} items",
    de: "{count} Artikel",
    ar: "{count} منتج",
    fr: "{count} articles",
    es: "{count} productos",
    it: "{count} prodotti",
    ru: "{count} товаров",
  },
  menuFeatured: {
    tr: "Öne çıkanlar",
    en: "Featured",
    de: "Empfehlungen",
    ar: "الأطباق المميزة",
    fr: "À la une",
    es: "Destacados",
    it: "In evidenza",
    ru: "Рекомендуем",
  },
  menuAllCategories: {
    tr: "Tüm kategoriler",
    en: "All categories",
    de: "Alle Kategorien",
    ar: "كل الفئات",
    fr: "Toutes les catégories",
    es: "Todas las categorías",
    it: "Tutte le categorie",
    ru: "Все категории",
  },
  menuSearchCta: {
    tr: "Menüde ara",
    en: "Search the menu",
    de: "Speisekarte durchsuchen",
    ar: "ابحث في القائمة",
    fr: "Rechercher dans le menu",
    es: "Buscar en la carta",
    it: "Cerca nel menù",
    ru: "Поиск по меню",
  },
  splashMessage: {
    tr: "Sizin için hazırlıyoruz…",
    en: "Getting everything ready for you…",
    de: "Wir bereiten alles für dich vor…",
    ar: "نجهّز كل شيء من أجلك…",
    fr: "Nous préparons tout pour vous…",
    es: "Lo estamos preparando todo para ti…",
    it: "Stiamo preparando tutto per te…",
    ru: "Готовим всё для вас…",
  },

  // Otomatik web sitesi (app/site/[slug]) — sabit bölüm başlıkları ve etiketler.
  siteAbout: { tr: "Hakkımızda", en: "About us", de: "Über uns", ar: "من نحن", fr: "À propos", es: "Sobre nosotros", it: "Chi siamo", ru: "О нас" },
  siteFeatured: {
    tr: "Öne çıkanlar",
    en: "Featured",
    de: "Empfehlungen",
    ar: "الأطباق المميزة",
    fr: "À la une",
    es: "Destacados",
    it: "In evidenza",
    ru: "Рекомендуем",
  },
  siteFeaturedSubtitle: {
    tr: "Menümüzden seçmeler",
    en: "Picks from our menu",
    de: "Eine Auswahl aus unserer Speisekarte",
    ar: "مختارات من قائمتنا",
    fr: "Une sélection de notre menu",
    es: "Una selección de nuestra carta",
    it: "Una selezione dal nostro menù",
    ru: "Подборка из меню",
  },
  siteMenuTitle: { tr: "Menü", en: "Menu", de: "Speisekarte", ar: "القائمة", fr: "Menu", es: "Carta", it: "Menù", ru: "Меню" },
  siteMenuSubtitle: {
    tr: "Kategorilere göz atın",
    en: "Browse categories",
    de: "Kategorien entdecken",
    ar: "تصفح الفئات",
    fr: "Parcourir les catégories",
    es: "Explora las categorías",
    it: "Sfoglia le categorie",
    ru: "Обзор категорий",
  },
  siteGallery: { tr: "Galeri", en: "Gallery", de: "Galerie", ar: "معرض الصور", fr: "Galerie", es: "Galería", it: "Galleria", ru: "Галерея" },
  siteHighlights: {
    tr: "Mekân özellikleri",
    en: "Venue features",
    de: "Ausstattung",
    ar: "مزايا المكان",
    fr: "Services du lieu",
    es: "Servicios del local",
    it: "Servizi del locale",
    ru: "Особенности заведения",
  },
  siteContact: { tr: "İletişim", en: "Contact", de: "Kontakt", ar: "تواصل معنا", fr: "Contact", es: "Contacto", it: "Contatti", ru: "Контакты" },
  siteReservationTitle: {
    tr: "Masanızı ayırtın",
    en: "Reserve your table",
    de: "Reserviere deinen Tisch",
    ar: "احجز طاولتك",
    fr: "Réservez votre table",
    es: "Reserva tu mesa",
    it: "Prenota il tuo tavolo",
    ru: "Забронировать столик",
  },
  siteReservationSubtitle: {
    tr: "{name} için yer ayırtmak birkaç saniye sürüyor.",
    en: "Reserving a table at {name} takes just a few seconds.",
    de: "Einen Tisch bei {name} zu reservieren dauert nur ein paar Sekunden.",
    ar: "حجز طاولة في {name} يستغرق ثوانٍ فقط.",
    fr: "Réserver une table chez {name} ne prend que quelques secondes.",
    es: "Reservar una mesa en {name} solo lleva unos segundos.",
    it: "Prenotare un tavolo da {name} richiede solo pochi secondi.",
    ru: "Бронирование столика в {name} займёт всего пару секунд.",
  },
  reservationViaWhatsapp: {
    tr: "WhatsApp'tan rezervasyon",
    en: "Reserve via WhatsApp",
    de: "Per WhatsApp reservieren",
    ar: "احجز عبر واتساب",
    fr: "Réserver via WhatsApp",
    es: "Reservar por WhatsApp",
    it: "Prenota su WhatsApp",
    ru: "Бронь через WhatsApp",
  },
  reservationViaPhone: {
    tr: "Telefonla rezervasyon",
    en: "Reserve by phone",
    de: "Telefonisch reservieren",
    ar: "احجز عبر الهاتف",
    fr: "Réserver par téléphone",
    es: "Reservar por teléfono",
    it: "Prenota per telefono",
    ru: "Бронь по телефону",
  },
  reservationViaUrl: {
    tr: "Rezervasyon yap",
    en: "Book a table",
    de: "Tisch reservieren",
    ar: "احجز طاولة",
    fr: "Réserver une table",
    es: "Reservar mesa",
    it: "Prenota un tavolo",
    ru: "Забронировать",
  },
  emailLabel: {
    tr: "E-posta",
    en: "Email",
    de: "E-Mail",
    ar: "البريد الإلكتروني",
    fr: "E-mail",
    es: "Correo electrónico",
    it: "E-mail",
    ru: "Эл. почта",
  },
  googleReviewLinkLabel: {
    tr: "Google'da değerlendirin",
    en: "Review us on Google",
    de: "Bewerte uns auf Google",
    ar: "قيّمنا على جوجل",
    fr: "Donnez votre avis sur Google",
    es: "Valóranos en Google",
    it: "Valutaci su Google",
    ru: "Оцените нас в Google",
  },
  directionsLabel: {
    tr: "Yol tarifi al",
    en: "Get directions",
    de: "Route planen",
    ar: "احصل على الاتجاهات",
    fr: "Itinéraire",
    es: "Cómo llegar",
    it: "Indicazioni stradali",
    ru: "Проложить маршрут",
  },
  openDigitalMenu: {
    tr: "Dijital menüyü aç",
    en: "Open digital menu",
    de: "Digitale Speisekarte öffnen",
    ar: "افتح القائمة الرقمية",
    fr: "Ouvrir le menu numérique",
    es: "Abrir la carta digital",
    it: "Apri il menù digitale",
    ru: "Открыть цифровое меню",
  },
  imageCreditsTitle: {
    tr: "Görsel kaynakları",
    en: "Image credits",
    de: "Bildnachweise",
    ar: "مصادر الصور",
    fr: "Crédits photo",
    es: "Créditos de las imágenes",
    it: "Crediti delle immagini",
    ru: "Источники изображений",
  },
  imageCreditsIntro: {
    tr: "Bu menüdeki bazı ürün görselleri açık lisanslı kaynaklardan alınmıştır.",
    en: "Some product photos in this menu come from openly licensed sources.",
    de: "Einige Produktfotos dieser Speisekarte stammen aus frei lizenzierten Quellen.",
    ar: "بعض صور المنتجات في هذه القائمة مأخوذة من مصادر ذات ترخيص مفتوح.",
    fr: "Certaines photos de produits de ce menu proviennent de sources sous licence libre.",
    es: "Algunas fotos de productos de esta carta proceden de fuentes con licencia abierta.",
    it: "Alcune foto dei prodotti di questo menù provengono da fonti con licenza libera.",
    ru: "Некоторые фотографии блюд в этом меню взяты из источников со свободной лицензией.",
  },
  imageCreditsEmpty: {
    tr: "Bu menüde künye gerektiren görsel bulunmuyor.",
    en: "No photos in this menu require credit.",
    de: "In dieser Speisekarte gibt es keine Bilder, die einen Nachweis erfordern.",
    ar: "لا توجد صور في هذه القائمة تتطلب نسب المصدر.",
    fr: "Aucune photo de ce menu ne nécessite de crédit.",
    es: "Ninguna foto de esta carta requiere atribución.",
    it: "Nessuna foto di questo menù richiede l'attribuzione.",
    ru: "В этом меню нет изображений, требующих указания авторства.",
  },
  photoBy: {
    tr: "Fotoğraf: {author}",
    en: "Photo: {author}",
    de: "Foto: {author}",
    ar: "تصوير: {author}",
    fr: "Photo : {author}",
    es: "Foto: {author}",
    it: "Foto: {author}",
    ru: "Фото: {author}",
  },
  // {brand} lib/branding.ts'ten gelir (ileride partner markası olabilir).
  poweredByBuyur: {
    tr: "{brand} ile hazırlandı",
    en: "Made by {brand}",
    de: "Erstellt mit {brand}",
    ar: "صُنع بواسطة {brand}",
    fr: "Réalisé avec {brand}",
    es: "Hecho con {brand}",
    it: "Realizzato con {brand}",
    ru: "Сделано на {brand}",
  },
  // Menü başlığındaki logo: misafiri platform sitesine değil, menünün başına götürür.
  menuHomeAria: {
    tr: "Menünün başına dön",
    en: "Back to the menu",
    de: "Zurück zum Anfang der Speisekarte",
    ar: "العودة إلى بداية القائمة",
    fr: "Revenir au début du menu",
    es: "Volver al inicio de la carta",
    it: "Torna all'inizio del menù",
    ru: "Вернуться к началу меню",
  },

  // İşletme bilgileri paneli (components/menu/business-info.tsx).
  businessInfo: {
    tr: "İşletme bilgileri",
    en: "About the venue",
    de: "Über das Lokal",
    ar: "معلومات المكان",
    fr: "À propos du lieu",
    es: "Sobre el local",
    it: "Sul locale",
    ru: "О заведении",
  },
  moreInfo: {
    tr: "Tüm bilgiler",
    en: "All info",
    de: "Alle Infos",
    ar: "كل المعلومات",
    fr: "Toutes les infos",
    es: "Toda la información",
    it: "Tutte le info",
    ru: "Вся информация",
  },
  callNow: { tr: "Hemen ara", en: "Call", de: "Anrufen", ar: "اتصل", fr: "Appeler", es: "Llamar", it: "Chiama", ru: "Позвонить" },
  socialLabel: {
    tr: "Sosyal medya",
    en: "Social media",
    de: "Soziale Medien",
    ar: "وسائل التواصل",
    fr: "Réseaux sociaux",
    es: "Redes sociales",
    it: "Social media",
    ru: "Соцсети",
  },
  copy: { tr: "Kopyala", en: "Copy", de: "Kopieren", ar: "نسخ", fr: "Copier", es: "Copiar", it: "Copia", ru: "Копировать" },
  copied: { tr: "Kopyalandı", en: "Copied", de: "Kopiert", ar: "تم النسخ", fr: "Copié", es: "Copiado", it: "Copiato", ru: "Скопировано" },
  scrollMore: {
    tr: "Daha fazlasını göster",
    en: "Show more",
    de: "Mehr anzeigen",
    ar: "عرض المزيد",
    fr: "Voir plus",
    es: "Ver más",
    it: "Mostra di più",
    ru: "Показать ещё",
  },

  // İşletme vitrini (isletme.buyur.in kökü): web sitesi yoksa otomatik karşılama
  // sayfası (components/site/welcome.tsx) ve menü ↔ site geçişleri.
  welcomeTitle: {
    tr: "Hoş geldiniz",
    en: "Welcome",
    de: "Willkommen",
    ar: "أهلاً وسهلاً",
    fr: "Bienvenue",
    es: "Bienvenidos",
    it: "Benvenuti",
    ru: "Добро пожаловать",
  },
  seeMenu: {
    tr: "Menüyü gör",
    en: "See the menu",
    de: "Zur Speisekarte",
    ar: "عرض القائمة",
    fr: "Voir le menu",
    es: "Ver la carta",
    it: "Vedi il menù",
    ru: "Открыть меню",
  },
  websiteLabel: {
    tr: "Web sitesi",
    en: "Website",
    de: "Website",
    ar: "الموقع الإلكتروني",
    fr: "Site web",
    es: "Sitio web",
    it: "Sito web",
    ru: "Сайт",
  },
  visitWebsite: {
    tr: "Web sitemizi ziyaret edin",
    en: "Visit our website",
    de: "Besuche unsere Website",
    ar: "زوروا موقعنا الإلكتروني",
    fr: "Visitez notre site web",
    es: "Visita nuestro sitio web",
    it: "Visita il nostro sito web",
    ru: "Перейти на наш сайт",
  },
  visitUs: {
    tr: "Bizi ziyaret edin",
    en: "Visit us",
    de: "Besuche uns",
    ar: "زورونا",
    fr: "Venez nous voir",
    es: "Visítanos",
    it: "Vieni a trovarci",
    ru: "Приходите к нам",
  },
  followUs: {
    tr: "Bizi takip edin",
    en: "Follow us",
    de: "Folge uns",
    ar: "تابعونا",
    fr: "Suivez-nous",
    es: "Síguenos",
    it: "Seguici",
    ru: "Мы в соцсетях",
  },
  // Kayan yazının ekran okuyucu etiketi (components/marquee.tsx).
  announcementsLabel: {
    tr: "Duyurular",
    en: "Announcements",
    de: "Ankündigungen",
    ar: "إعلانات",
    fr: "Annonces",
    es: "Anuncios",
    it: "Annunci",
    ru: "Объявления",
  },
} as const satisfies Record<string, Record<Locale, string>>;

export type UIKey = keyof typeof UI_STRINGS;

// Statik arayüz metinlerini seçili dile çevirir; {token} biçimindeki yer tutucuları vars ile değiştirir.
export function t(locale: Locale, key: UIKey, vars?: Record<string, string | number>): string {
  const template: string = UI_STRINGS[key][locale] ?? UI_STRINGS[key][DEFAULT_LOCALE];
  if (!vars) return template;
  return Object.entries(vars).reduce((acc: string, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);
}
