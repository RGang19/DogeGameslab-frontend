// The loader must appear on the clicked strategy button only. API calls are
// stalled so no real (paid) generation is triggered.
import { FRONTEND, assert, withBrowser } from "./helpers.mjs";

async function clickAndInspect(browser, which) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/api/games/generate-from-prompt", () => {});
  await page.route("**/api/agents/**", () => {});
  await page.route("**/api/games/list*", (route) => route.fulfill({ json: { games: [] } }));
  await page.goto(`${FRONTEND}/create`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(800);

  const hybridBtn = page.locator("button", { hasText: "HYBRID MODE" }).first();
  const pureBtn = page.locator("button", { hasText: "PURE AGENT STRATEGY" }).first();
  await (which === "hybrid" ? hybridBtn : pureBtn).click();
  await page.waitForTimeout(600);

  const hybridText = ((await hybridBtn.textContent()) ?? "").trim();
  const pureText = ((await pureBtn.textContent()) ?? "").trim();
  await page.close();
  return { hybridText, pureText };
}

export async function run() {
  await withBrowser(async (browser) => {
    const hybrid = await clickAndInspect(browser, "hybrid");
    assert(hybrid.hybridText.includes("Building"), "hybrid button shows loader when clicked");
    assert(!hybrid.pureText.includes("Building"), "pure agent button stays idle on hybrid click");

    const pure = await clickAndInspect(browser, "pure");
    assert(pure.pureText.includes("Building"), "pure agent button shows loader when clicked");
    assert(!pure.hybridText.includes("Building"), "hybrid button stays idle on pure agent click");
  });
}
