// CHANGELOG.md'yi lib/release-notes.ts'ten yeniden yazar. Sürüm notu eklendikten
// sonra çalıştırılır; tests/release-notes.test.ts ikisinin ayrışmasını yakalar.
import { writeFileSync } from "node:fs";
import { renderChangelog } from "../lib/release-notes";

writeFileSync(new URL("../CHANGELOG.md", import.meta.url), renderChangelog());
console.log("CHANGELOG.md güncellendi.");
