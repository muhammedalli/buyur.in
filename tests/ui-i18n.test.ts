import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTranslator, msg, translate, type Catalog, type CatalogSet } from "@/lib/ui-i18n";
import { SITE_CATALOGS } from "@/lib/ui-messages/site";
import { SITE_CLIENT_CATALOGS } from "@/lib/ui-messages/site-client";
import { PANEL_CATALOGS } from "@/lib/ui-messages/panel";
import { PLAN_SEEDS } from "@/scripts/plan-catalog.mjs";
import { featureMatrix, freemiumLimits } from "@/lib/entitlements";
import { I18N_DOMAIN_FILES, type I18nDomain } from "@/scripts/i18n-domains";

// Arayüz dili sözleşmesi (lib/ui-i18n.ts): koddaki her t("…") / msg("…")
// kaynak metninin, o ekran grubunun HER dil kataloğunda karşılığı vardır;
// {yer tutucular} kaynakla birebir aynıdır ve katalogda koddan silinmiş bayat
// kayıt kalmaz. Yeni bir metin yazıp çevirisini eklemeyi unutan bu testte düşer.

const ROOT = join(__dirname, "..");

function walk(path: string): string[] {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => walk(join(path, name)));
}

const isSource = (file: string) => /\.(ts|tsx)$/.test(file);

const CATALOGS: Record<I18nDomain, CatalogSet> = {
  site: SITE_CATALOGS,
  siteClient: SITE_CLIENT_CATALOGS,
  panel: PANEL_CATALOGS,
};

/** Ekran grubu → kaynak dosyaları (scripts/i18n-domains.ts). */
const DOMAINS = Object.fromEntries(
  (Object.keys(I18N_DOMAIN_FILES) as I18nDomain[]).map((domain) => [
    domain,
    {
      catalogs: CATALOGS[domain],
      files: I18N_DOMAIN_FILES[domain].flatMap((path) => walk(path)).filter(isSource),
    },
  ])
) as Record<I18nDomain, { catalogs: CatalogSet; files: string[] }>;

function existsPath(path: string): boolean {
  try {
    statSync(join(ROOT, path));
    return true;
  } catch {
    return false;
  }
}

/** JS dize değişmezinin içeriğini çalışma zamanındaki metne çevirir. */
function unescape(raw: string, quote: string): string {
  const body = quote === '"' ? raw : raw.replace(/\\'/g, "'").replace(/\\`/g, "`").replace(/"/g, '\\"');
  return JSON.parse(`"${body.replace(/\n/g, "\\n")}"`) as string;
}

/** t("…"), copy.t("…"), msg("…") çağrılarındaki değişmez metinler. Değişken ya da
 *  şablon (${…}) içeren çağrılar kapsam dışı: onların kaynağı msg() ile işaretlenir. */
function extract(file: string): string[] {
  const source = readFileSync(join(ROOT, file), "utf8");
  const found: string[] = [];
  const pattern = /(?<![\w$])(?:t|msg)\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.)*)`)\s*[,)]/g;
  for (const match of source.matchAll(pattern)) {
    const [, dq, sq, bt] = match;
    if (dq !== undefined) found.push(unescape(dq, '"'));
    else if (sq !== undefined) found.push(unescape(sq, "'"));
    else if (bt !== undefined) found.push(unescape(bt, "`"));
  }
  return found;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const GRAMMAR_SUFFIX = /(Locative|Dative|Accusative)$/;

function placeholdersMatch(source: string, translation: string): boolean {
  const src = placeholders(source);
  const out = new Set(placeholders(translation));
  const base = (name: string) => name.replace(GRAMMAR_SUFFIX, "");
  // Çeviri kaynakta olmayan bir değişken kullanamaz (ek almış biçimin yalın adı hariç).
  const known = new Set([...src, ...src.filter((name) => GRAMMAR_SUFFIX.test(name)).map(base)]);
  if ([...out].some((name) => !known.has(name))) return false;
  // Kaynağın her değişkeni çeviride olmalı; ek almış olan yalın adıyla da gelebilir.
  return src.every((name) => out.has(name) || (GRAMMAR_SUFFIX.test(name) && out.has(base(name))) || (!GRAMMAR_SUFFIX.test(name) && src.some((other) => other !== name && base(other) === name && GRAMMAR_SUFFIX.test(other))));
}

function entryTexts(entry: Catalog[string]): string[] {
  return typeof entry === "string" ? [entry] : Object.values(entry).filter((v): v is string => typeof v === "string");
}

/** Paket tohum metinleri: İngilizce landing, yönetimin değiştirmediği Türkçe
 *  metnin ya da tohum metnin çevirisini gösterir (components/pricing.tsx). */
const planSeedTexts = PLAN_SEEDS.flatMap((seed) => [seed.description, ...seed.features]);

describe("arayüz dili katalogları", () => {
  for (const [domain, { catalogs, files }] of Object.entries(DOMAINS)) {
    const keys = new Set(files.flatMap(extract));
    if (domain === "site") planSeedTexts.forEach((text) => keys.add(text));

    for (const [locale, catalog] of Object.entries(catalogs)) {
      it(`${domain}/${locale}: koddaki her metnin çevirisi var`, () => {
        const missing = [...keys].filter((key) => !(key in catalog));
        expect(missing).toEqual([]);
      });

      // Yer tutucular kaynakla eşleşir. Tek istisna Türkçe ekler: kaynak ek almış
      // biçimi kullanır ({planLocative} → "Premium'da"), diğer diller yalın adı
      // ({plan}); çağıran ikisini de geçirir (bkz. components/panel/plan-gate.tsx).
      it(`${domain}/${locale}: yer tutucular kaynakla eşleşiyor`, () => {
        const broken = Object.entries(catalog).filter(([key, entry]) =>
          entryTexts(entry).some((text) => !placeholdersMatch(key, text))
        );
        expect(broken.map(([key]) => key)).toEqual([]);
      });

      it(`${domain}/${locale}: katalogda koddan silinmiş bayat kayıt yok`, () => {
        const stale = Object.keys(catalog).filter((key) => !keys.has(key));
        expect(stale).toEqual([]);
      });
    }
  }

  it("taranan dosyalar gerçekten var (liste bayatlamasın)", () => {
    const listed = Object.values(I18N_DOMAIN_FILES).flat();
    expect(listed.filter((path) => !existsPath(path))).toEqual([]);
  });
});

describe("çevirmen", () => {
  const catalogs: CatalogSet = {
    en: { Kaydet: "Save", "{count} ürün": { one: "{count} product", other: "{count} products" } },
  };

  it("Türkçe kaynağı olduğu gibi, yer tutucuları doldurarak döndürür", () => {
    expect(translate(catalogs, "tr", "{count} ürün", { count: 3 })).toBe("3 ürün");
  });

  it("İngilizce katalogdan çevirir, çoğul biçimi sayıya göre seçer", () => {
    const t = createTranslator(catalogs, "en");
    expect(t("Kaydet")).toBe("Save");
    expect(t("{count} ürün", { count: 1 })).toBe("1 product");
    expect(t("{count} ürün", { count: 4 })).toBe("4 products");
  });

  it("katalogda olmayan metin Türkçe kalır (ekran boş görünmez)", () => {
    expect(translate(catalogs, "en", "Yeni metin")).toBe("Yeni metin");
  });

  it("msg metni değiştirmez", () => {
    expect(msg("Genel bakış")).toBe("Genel bakış");
  });

  it("plan tablosu ve Freemium özeti İngilizce kurulabilir", () => {
    const t = createTranslator(SITE_CATALOGS, "en");
    expect(freemiumLimits(t, "en-US").summary).not.toMatch(/ay|görüntülenme/);
    expect(featureMatrix(t, "en-US").every((row) => !/[çğıöşüÇĞİÖŞÜ]/.test(row.label))).toBe(true);
  });
});
