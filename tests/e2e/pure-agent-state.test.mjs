// Regression: the pure-agent designed package must survive the click (it used
// to be overwritten by the default flappy template package).
import { FRONTEND, assert, withBrowser } from "./helpers.mjs";

export async function run() {
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route("**/api/games/list*", (route) => route.fulfill({ json: { games: [] } }));
    await page.route("**/api/games/generate-from-prompt", (route) =>
      route.fulfill({
        status: 201,
        json: {
          game: {
            id: "e2e-pure-agent",
            title: "E2E Custom Game",
            templateId: "pure-agent",
            templateName: "Pure AI Agent Game",
            category: "Casual",
            gameplay: { mechanic: "custom", controls: "tap", tuning: {} },
            visuals: { mood: "test", colors: ["#fff", "#000", "#f0f"] }
          }
        }
      })
    );
    await page.route("**/api/agents/code", (route) =>
      route.fulfill({ status: 202, json: { jobId: "job_e2e", status: "running" } })
    );
    await page.route("**/api/agents/jobs/job_e2e", (route) =>
      route.fulfill({ json: { jobId: "job_e2e", status: "running" } })
    );

    await page.goto(`${FRONTEND}/create`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(800);
    await page.locator("button", { hasText: "Pure Agent Strategy" }).click();
    await page.waitForTimeout(3500);

    const body = await page.textContent("body");
    assert(body.includes("E2E Custom Game"), "AI-designed title survives");
    assert(!body.includes("Neon Flappy Bird"), "package not overwritten by default template");
    await page.close();
  });
}
