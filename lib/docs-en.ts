import type { DocSection } from "@/lib/docs";

// Yardım merkezinin İngilizcesi (/en/docs). Anahtar Türkçe rehberin slug'ıdır;
// her rehberin burada bir karşılığı olmalı ve bölüm sayısı aynı kalmalı
// (tests/release-notes.test.ts kilitler). Türkçe rehber değişince bu dosya da
// aynı değişiklikte güncellenir. Rakam kuralı burada da geçerli (CLAUDE.md §4).

export interface DocGuideTranslation {
  /** İngilizce adres parçası (/en/docs/<slug>). */
  slug: string;
  title: string;
  summary: string;
  sections: DocSection[];
}

export const DOC_GUIDES_EN: Record<string, DocGuideTranslation> = {
  "hizli-baslangic": {
    slug: "quick-start",
    title: "Quick start",
    summary: "A ten-minute setup, from opening an account to the first QR scan at a table.",
    sections: [
      {
        heading: "1. Open your account",
        steps: [
          "Click \"Start free\" on buyur.in.",
          "Enter your email address and a password, then type the 6-digit code sent to your inbox.",
          "On the setup screen, choose your business name and menu address (e.g. coffeestop). Your menu stays offline until both are filled in.",
        ],
      },
      {
        heading: "2. Build your menu",
        paragraphs: [
          "Add categories first (Breakfast, Mains, Drinks…), then products. If you have a printed menu, upload a photo and let AI import it; see \"Importing your menu with AI\".",
        ],
      },
      {
        heading: "3. Set the look",
        list: [
          "Settings → brand color and logo: your menu opens in this color.",
          "Settings → menu languages: pick the main language and the extra languages offered to guests (up to 4 including the main one).",
          "Settings → venue features: select as many as you like (Wi-Fi, parking, terrace…); they appear with icons on your menu and website.",
          "Opening hours, address and contact details appear on the menu's welcome screen.",
        ],
      },
      {
        heading: "4. Print the QR code",
        paragraphs: ["On the QR codes screen, create a single code or one code per table, print them and place them on the tables."],
        tip: "The go-live checklist on the Overview screen shows each step that is still missing.",
      },
    ],
  },
  "menu-yonetimi": {
    slug: "menu-management",
    title: "Managing categories and products",
    summary: "Categories, products, options, images, allergens and availability.",
    sections: [
      {
        heading: "Categories",
        paragraphs: [
          "Categories are the main headings of your menu. Drag to reorder them; switch off \"Active\" to hide one temporarily.",
          "Two categories cannot share a name; differences in case and spacing count as the same name.",
        ],
      },
      {
        heading: "Adding a product",
        steps: [
          "Products → New product.",
          "Write the name and description in the main language; set the price and category.",
          "Image: for a new product a matching image is searched automatically as you type the name. If you don't like it, upload your own photo (up to 5 MB).",
          "Optionally add preparation time, calories, allergens and a badge.",
          "Click Save. If you leave without saving, your input is kept as a draft; half-finished details never reach the live menu.",
        ],
      },
      {
        heading: "Options (size, extras, cooking)",
        paragraphs: [
          "Add a group (e.g. Size) and options (e.g. Large) in the Options section at the bottom of the product screen. The price difference is set per option; a negative value is a discount.",
        ],
      },
      {
        heading: "Taking items off sale and campaigns",
        list: [
          "Switching off \"On sale\" removes a product from the menu without deleting it; its details stay and it returns when you switch it back on.",
          "A discount percentage and a campaign label (e.g. Deal of the week) make the product card stand out.",
        ],
      },
    ],
  },
  "coklu-dil": {
    slug: "multilingual-menu",
    title: "Multiple languages and AI translation",
    summary: "Offering your menu in up to four of eight languages, and how \"Complete with AI\" works.",
    sections: [
      {
        heading: "How languages work",
        paragraphs: [
          "Supported languages: Türkçe, English, Deutsch, العربية, Français, Español, Italiano and Русский.",
          "Every text has a main language. In Settings → Menu languages, pick the main language from the dropdown and use \"Add language\" to enable extra ones. Up to 4 languages including the main one can be active; translations of a language you switch off are not deleted.",
          "When extra languages are active, language tabs appear on the product, category, option and campaign forms.",
          "If a translation is left empty, guests see the main-language text in that language; the menu is never blank. Arabic is shown right to left.",
        ],
      },
      {
        heading: "Dots on the tabs",
        list: [
          "Green dot: every field is filled in this language.",
          "Orange dot: some fields are missing.",
          "Empty ring: no translation in this language yet.",
        ],
      },
      {
        heading: "\"Complete with AI\"",
        steps: [
          "Write the text in the main-language tab.",
          "Click \"Complete with AI\" at the top right of the field group.",
          "AI fills in ONLY the empty translations; it never touches a translation you wrote or approved. The tab of the first filled language opens automatically.",
          "Review the translation, correct it if needed and click Save. No translation is published to the menu without saving.",
        ],
        tip: "To regenerate a translation, clear that field and click \"Complete with AI\" again.",
      },
      {
        heading: "What gets translated and what doesn't",
        list: [
          "Translated: product/category name and description, option and group names, campaign title, message and label, business description.",
          "Never sent and never changed: price, discount, calories, preparation time, allergen information.",
          "No translation is produced for a field that is empty in the main language; AI does not invent text.",
          "Dish names (e.g. Adana Kebap) are kept, with a short explanation added when needed.",
        ],
      },
      {
        heading: "Troubleshooting",
        list: [
          "The button is missing: at least one menu language other than the main one must be active, and your plan must include AI translation.",
          "\"Not saved yet\" warning: a language you just added in Settings must be saved first; translations only target saved languages.",
          "\"All languages are already filled\": there is no empty field to fill. Clear a field to regenerate it.",
          "\"Took too long\" or \"service not responding\": try again in a few seconds; temporary errors are retried once automatically.",
          "\"Could not generate language X\": the other languages were filled; click again for the missing one.",
        ],
      },
    ],
  },
  "yapay-zeka-menu-aktarimi": {
    slug: "ai-menu-import",
    title: "Importing your menu with AI",
    summary: "Create categories and products automatically from a photo of your printed menu.",
    sections: [
      {
        heading: "How to use it",
        steps: [
          "Open the AI screen in your dashboard.",
          "Upload clear, straight photos of your menu.",
          "Check the categories and products found on the preview screen; always review the prices.",
          "The items you approve are added to your menu. Products or categories with an existing name are not created again.",
        ],
      },
      {
        heading: "Good to know",
        list: [
          "Unreadable or unclear information is never guessed; it is flagged in the preview for you to complete.",
          "AI-generated content stays a draft until you approve it.",
          "Your monthly scan allowance depends on your plan; you can see what's left on the Plan screen.",
          "A connection problem does not stop the import; at the end you are told how many items were added and how many could not be.",
        ],
      },
    ],
  },
  "qr-kodlar": {
    slug: "qr-codes",
    title: "QR codes",
    summary: "A single QR, one QR per table, printing and your menu address.",
    sections: [
      {
        heading: "Your menu address",
        paragraphs: [
          "Your menu opens at both buyur.in/youraddress and youraddress.buyur.in. If you change the address in Settings, old QR codes stop working and you need to print new ones.",
        ],
      },
      {
        heading: "Creating QR codes",
        list: [
          "Create a single QR: one code for the door, window or counter.",
          "Create table QR codes in bulk: enter the number of tables and a separate code is created for each; analytics shows how many scans came from each table.",
          "The print page is laid out to fit A4.",
        ],
        tip: "Before placing a QR on the table, scan it with your phone to make sure the menu opens.",
      },
    ],
  },
  kampanyalar: {
    slug: "campaigns",
    title: "Campaigns (pop-up announcements)",
    summary: "Campaign and announcement windows shown to guests when the menu opens.",
    sections: [
      {
        heading: "Adding a campaign",
        steps: [
          "Campaigns → New campaign.",
          "Write the title and message in the main language; add an image if you like.",
          "Translate the title and message into extra languages with \"Complete with AI\".",
          "Switch on \"Active\" and save.",
        ],
      },
      { heading: "Tip", paragraphs: ["Keep it short: one title, one sentence. Your guest came to look at the menu."] },
    ],
  },
  "analiz-ve-raporlar": {
    slug: "analytics-and-reports",
    title: "Analytics and reports",
    summary: "Menu views, QR scans, most viewed products and periodic reports.",
    sections: [
      {
        heading: "Analytics screen",
        list: [
          "Menu performance over time: visits and sessions.",
          "Customer journey: how many people dropped off at each step from QR scan to cart.",
          "Traffic source, device split, most viewed products and categories.",
        ],
      },
      {
        heading: "Privacy",
        paragraphs: [
          "No personal data is collected from your guests; analytics works only with anonymous sessions. How long data is kept depends on your plan.",
        ],
      },
      {
        heading: "Reports",
        paragraphs: ["The Reports screen shows periodic summaries and suggestion cards. Advanced reports and export depend on your plan."],
      },
    ],
  },
  "web-sitesi-ve-degerlendirmeler": {
    slug: "website-and-reviews",
    title: "Website and reviews",
    summary: "The showcase website generated from your menu, and guest reviews.",
    sections: [
      {
        heading: "Automatic website",
        paragraphs: [
          "From the Website screen you can open a showcase site built from your menu details (youraddress.buyur.in/site). The site updates as you update your menu. This feature depends on your plan.",
          "The features you select in Settings → Venue features are listed with icons in the site's \"About us\" section.",
          "When the site first opens, the cover image stays clean; as the visitor scrolls down, a bar with your business name, a language selector and a \"Menu\" button appears at the top. The language selector lists the languages active on your menu.",
        ],
      },
      {
        heading: "Reviews",
        paragraphs: ["Guests can leave a review from the menu; you see all of them on the Reviews screen."],
      },
    ],
  },
  "plan-ve-hesap": {
    slug: "plan-and-account",
    title: "Plan, account and security",
    summary: "Plans, trial period, password, sessions and closing your account.",
    sections: [
      {
        heading: "Plans",
        paragraphs: [
          "There are Freemium, Premium and Elite plans. Which feature belongs to which plan, the quotas and current prices are always up to date on the Plan screen and at buyur.in/en#pricing.",
          "When you click a locked feature, an upgrade note shows what it unlocks.",
        ],
      },
      {
        heading: "Sign-in and password",
        list: [
          "If \"Remember me\" is unchecked, you are signed out when the browser closes.",
          "If you forgot your password, use the \"Forgot password?\" link on the sign-in screen and follow the reset link sent to your email.",
        ],
      },
      {
        heading: "Dashboard language",
        paragraphs: [
          "The dashboard is available in Turkish and English. Change it from the language button in the top bar or in Settings → Panel; your choice is saved to your account. The languages your menu offers to guests are separate (Settings → Menu languages).",
          "Automatic insight sentences in analytics and report summaries are generated in Turkish for now.",
        ],
      },
      {
        heading: "Help",
        paragraphs: ["For any question you can't find an answer to, write to merhaba@buyur.in or our WhatsApp support line."],
      },
    ],
  },
};
