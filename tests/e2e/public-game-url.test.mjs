// A published game must boot from its URL without relying on creator localStorage.
import { FRONTEND, assert, gameFrame, paintedSamples, withBrowser } from "./helpers.mjs";

const generatedCode = `
const canvas = document.querySelector("#game");
canvas.width = 960;
canvas.height = 540;
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#35e8ff";
ctx.fillRect(100, 100, 760, 340);
`;

export async function run() {
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route("**/api/games/public-e2e", (route) =>
      route.fulfill({
        json: {
          game: {
            id: "public-e2e",
            title: "Public E2E Game",
            templateId: "pure-agent",
            category: "Arcade",
            creatorId: "e2e-creator",
            publish: { published: true, status: "published" },
            refinement: { generatedCode },
          },
        },
      }),
    );
    await page.route("**/api/games/list*", (route) => route.fulfill({ json: { games: [] } }));

    await page.goto(`${FRONTEND}/play/public-e2e`, { waitUntil: "domcontentloaded" });
    const frame = await gameFrame(page);
    assert(frame, "published game creates a playable frame");
    assert((await paintedSamples(frame)) > 20, "published game paints its generated build");

    await page.route("**/api/games/missing-e2e", (route) =>
      route.fulfill({ status: 404, json: { error: "Published game not found" } }),
    );
    await page.goto(`${FRONTEND}/play/missing-e2e`, { waitUntil: "domcontentloaded" });
    await page.getByText("Game unavailable").waitFor();
    assert(await page.getByText("Game unavailable").isVisible(), "missing public game shows not-found UI");
    await page.close();
  });
}
