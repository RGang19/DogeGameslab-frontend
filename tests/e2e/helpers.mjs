import { chromium } from "playwright";

export const FRONTEND = process.env.E2E_FRONTEND_URL ?? "http://localhost:5173";
export const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:3001";

export async function withBrowser(fn) {
  const browser = await chromium.launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

/** Counts canvas pixels that differ from the app background (#070a12). */
export async function paintedSamples(frameOrPage) {
  return frameOrPage.evaluate(() => {
    const c = document.querySelector("#game");
    if (!c) return -1;
    const ctx = c.getContext("2d");
    if (!ctx) return -1;
    const d = ctx.getImageData(0, 0, c.width || 1, c.height || 1).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (Math.abs(d[i] - 7) + Math.abs(d[i + 1] - 10) + Math.abs(d[i + 2] - 18) > 40) n += 1;
    }
    return n;
  });
}

/**
 * Finds the iframe (or page itself) that contains the #game canvas.
 * The frame mounts only after React renders and the game record loads, so
 * poll instead of sampling page.frames() once right after domcontentloaded.
 */
export async function gameFrame(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const frame of page.frames()) {
      if ((await frame.locator("#game").count().catch(() => 0)) > 0) return frame;
    }
    await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return null;
}

export async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return { status: response.status, body: await response.json().catch(() => null) };
}
