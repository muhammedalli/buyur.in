// Geliştirici yardımcısı: bir ekran grubunun kaynak dosyalarında olup İngilizce
// katalogda karşılığı olmayan metinleri listeler (tests/ui-i18n.test.ts ile aynı
// tarama). Kullanım: bun scripts/i18n-missing.ts site|siteClient|panel [--stale]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CATALOGS } from "@/lib/ui-messages/site";
import { SITE_CLIENT_CATALOGS } from "@/lib/ui-messages/site-client";
import { PANEL_CATALOGS } from "@/lib/ui-messages/panel";
import { PLAN_SEEDS } from "@/scripts/plan-catalog.mjs";
import { I18N_DOMAIN_FILES } from "@/scripts/i18n-domains";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function walk(path: string): string[] {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => walk(join(path, name)));
}

function unescape(raw: string, quote: string): string {
  const body = quote === '"' ? raw : raw.replace(/\\'/g, "'").replace(/\\`/g, "`").replace(/"/g, '\\"');
  return JSON.parse(`"${body.replace(/\n/g, "\\n")}"`) as string;
}

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

const domain = process.argv[2] as keyof typeof I18N_DOMAIN_FILES;
const catalogs = { site: SITE_CATALOGS, siteClient: SITE_CLIENT_CATALOGS, panel: PANEL_CATALOGS }[domain];
const files = I18N_DOMAIN_FILES[domain].flatMap(walk).filter((f) => /\.(ts|tsx)$/.test(f));
const keys = new Set(files.flatMap(extract));
if (domain === "site") PLAN_SEEDS.flatMap((s) => [s.description, ...s.features]).forEach((k) => keys.add(k));
const catalog = catalogs.en;
if (process.argv.includes("--stale")) {
  console.log(JSON.stringify(Object.keys(catalog).filter((k) => !keys.has(k)), null, 2));
} else {
  console.log(JSON.stringify([...keys].filter((k) => !(k in catalog)), null, 2));
}
