// Every reference seed must boot in the sandbox harness, paint pixels, and
// produce zero runtime errors.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { assert, withBrowser } from "./helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(here, "../../../backend/src/data/reference");

const pkg = {
  title: "Seed Test",
  visuals: { colors: ["#35e8ff", "#ff3df2", "#ffd166"] },
  gameplay: { tuning: {} }
};

function prepare(code) {
  return code
    .replace(/^\s*import\s+["'][^"']*\.css["'];?\s*$/gm, "")
    .replace(/^\s*import\s+[^;\n]*from\s+["']\.\.?\/[^"']*["'];?\s*$/gm, "");
}

export async function run() {
  const seeds = readdirSync(SEED_DIR).filter((f) => f.endsWith(".js") && f !== "gamePackage.js");
  await withBrowser(async (browser) => {
    for (const file of seeds) {
      const code = readFileSync(join(SEED_DIR, file), "utf8");
      const html = `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;height:100%;background:#070a12}#game{width:100%;aspect-ratio:16/9;display:block}</style></head>
<body><canvas id="game"></canvas><script type="module">
try { const gamePackage = ${JSON.stringify(pkg)};
${prepare(code)}
} catch (e) { console.error("seed boot error", e); }
<\/script></body></html>`;
      const htmlPath = join(tmpdir(), `seed-${file}.html`);
      writeFileSync(htmlPath, html);

      const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`file://${htmlPath}`);
      await page.waitForTimeout(1000);
      await page.locator("#game").click({ position: { x: 512, y: 300 } }).catch(() => {});
      await page.waitForTimeout(800);

      const painted = await page.evaluate(() => {
        const c = document.querySelector("#game");
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4 * 97) {
          if (Math.abs(d[i] - 7) + Math.abs(d[i + 1] - 10) + Math.abs(d[i + 2] - 18) > 40) n += 1;
        }
        return n;
      });
      await page.close();

      assert(errors.length === 0, `${file} runs without errors (got: ${errors[0] ?? ""})`);
      assert(painted > 20, `${file} paints content (painted=${painted})`);
    }
  });
}
