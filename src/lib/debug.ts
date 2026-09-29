// Opt-in, on-device debugging: append ?debug=1 to any URL once, and it's
// remembered (via localStorage) across route/reel navigation. Loads eruda (an
// on-screen DevTools clone) so console logs, network requests, and errors are
// visible directly on a phone with no cable/remote-inspector setup needed.
// No-op for everyone else — nothing loads unless explicitly turned on.
const STORAGE_KEY = "dogegame-debug";

export function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    if (params.get("debug") === "0") {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function initDebugConsole(): void {
  if (!isDebugMode()) return;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.onload = () => {
    (window as unknown as { eruda?: { init: () => void } }).eruda?.init();
  };
  document.body.appendChild(script);
}

// Tagged so `reel:` logs are easy to filter for in eruda's console.
export function reelDebugLog(...args: unknown[]): void {
  if (!isDebugMode()) return;
  // eslint-disable-next-line no-console
  console.log("[reel]", ...args);
}
