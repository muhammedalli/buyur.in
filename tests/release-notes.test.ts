import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELEASE_NOTES, renderChangelog } from "@/lib/release-notes";
import { DOC_GUIDES, RELEASE_NOTES_SLUG } from "@/lib/docs";

// Sürüm notu sözleşmesi (CLAUDE.md §12): her geliştirme bir sürüm notuyla
// yayına girer, CHANGELOG.md ve /docs/surum-notlari aynı kaynaktan beslenir.

const root = new URL("../", import.meta.url);
const semver = /^\d+\.\d+\.\d+$/;

function compare(a: string, b: string): number {
  const [x, y] = [a.split(".").map(Number), b.split(".").map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

describe("sürüm notları", () => {
  it("en üstteki sürüm package.json sürümüyle aynı", () => {
    const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
    expect(RELEASE_NOTES[0].version).toBe(pkg.version);
  });

  it("CHANGELOG.md kaynaktan üretilmiş hâliyle aynı — `bun run changelog` çalıştırın", () => {
    expect(readFileSync(new URL("CHANGELOG.md", root), "utf8")).toBe(renderChangelog());
  });

  it("sürümler geçerli, tekil ve yeniden eskiye sıralı", () => {
    RELEASE_NOTES.forEach((note, index) => {
      expect(note.version).toMatch(semver);
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.items.length).toBeGreaterThan(0);
      const older = RELEASE_NOTES[index + 1];
      if (older) {
        expect(compare(note.version, older.version)).toBeGreaterThan(0);
        expect(note.date >= older.date).toBe(true);
      }
    });
  });
});

describe("yardım merkezi", () => {
  it("rehber adresleri tekil ve sürüm notları adresiyle çakışmıyor", () => {
    const slugs = DOC_GUIDES.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).not.toContain(RELEASE_NOTES_SLUG);
  });

  // Plan kuralları buyur_plans kaydından gelir; rehberde yazılan bir rakam
  // admin panelinden fiyat değişince yanlış kalırdı (CLAUDE.md §4).
  it("rehberlerde fiyat rakamı yazılmaz", () => {
    const text = JSON.stringify(DOC_GUIDES);
    expect(text).not.toMatch(/\d+\s*(₺|TL)/);
  });
});
