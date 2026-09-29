// Minimal e2e runner: executes every *.test.mjs in this directory.
// Requires the backend (port 3001) and the frontend dev server (port 5173)
// to be running:  cd backend && npm start   |   cd creator-studio-frontend && npm run dev
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith(".test.mjs")).sort();

let failed = 0;
for (const file of files) {
  const started = Date.now();
  try {
    const mod = await import(join(here, file));
    await mod.run();
    console.log(`✓ ${file} (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${file}: ${error.message}`);
  }
}

console.log(failed === 0 ? `\nAll ${files.length} e2e tests passed` : `\n${failed}/${files.length} tests FAILED`);
process.exit(failed === 0 ? 0 : 1);
