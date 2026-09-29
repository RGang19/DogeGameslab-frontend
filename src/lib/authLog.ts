/**
 * Studio sign-in tracing. On by default so the deployed build can be diagnosed;
 * set `localStorage.dogegame_auth_debug = "0"` to silence it.
 */

const PREFIX = "[studio-auth]";
const DEBUG_FLAG_KEY = "dogegame_auth_debug";

function enabled() {
  try {
    return localStorage.getItem(DEBUG_FLAG_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Never log full tokens — enough to correlate across events, useless if leaked. */
export function tokenFingerprint(token: string | null | undefined) {
  if (!token) return null;
  return `len=${token.length}:${token.slice(0, 6)}…${token.slice(-4)}`;
}

export function studioAuthLog(event: string, data?: Record<string, unknown>) {
  if (!enabled()) return;
  if (data) console.info(`${PREFIX} ${event}`, data);
  else console.info(`${PREFIX} ${event}`);
}

export function studioAuthWarn(event: string, data?: Record<string, unknown>) {
  if (!enabled()) return;
  console.warn(`${PREFIX} ${event}`, data ?? "");
}
