import { stripAppBase, withAppBase } from "./appBase";

/** Where the user was before opening the reels / play feed. */
export const PLAY_RETURN_KEY = "dogegame-play-return-to";

export function isPlayPath(pathname: string) {
  const routePath = stripAppBase(pathname);
  return routePath === "/play" || routePath.startsWith("/play/");
}

function normalizeSearch(search = "") {
  if (!search || search === "?") return "";
  return search.startsWith("?") ? search : `?${search}`;
}

/** Call when routing from a non-play page into play. */
export function rememberPlayReturnPath(fromPathname: string, search = "") {
  if (!fromPathname || isPlayPath(fromPathname)) return;
  const target = `${fromPathname}${normalizeSearch(search)}` || "/";
  try {
    sessionStorage.setItem(PLAY_RETURN_KEY, target);
  } catch {
    // ignore quota / private mode
  }
}

export function readPlayReturnPath(): string | null {
  try {
    const value = sessionStorage.getItem(PLAY_RETURN_KEY);
    if (!value) return null;
    const pathname = value.split("?")[0] || "/";
    // Never bounce back into another reel slide.
    if (isPlayPath(pathname)) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearPlayReturnPath() {
  try {
    sessionStorage.removeItem(PLAY_RETURN_KEY);
  } catch {
    // ignore
  }
}

/** Safe fallback when there is no remembered origin. */
export function getPlayBackFallback(): string {
  return "/";
}

/**
 * Builds a shareable link to a specific game. Uses a search param, not a path
 * segment (`/play?gameId=...`, not `/play/...`) — swiping through the reel
 * feed only ever changes this query string via history.replaceState, never
 * the pathname, which avoids some embedded (in-app) WebViews treating
 * each swipe as "leaving the page" and prompting a confirmation dialog.
 */
export function buildPlayUrl(gameId: string): string {
  const path = withAppBase(`/play?gameId=${encodeURIComponent(gameId)}`);
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}
