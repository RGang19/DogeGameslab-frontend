/** Normalized app base path without trailing slash, e.g. `/create`. Empty at domain root. */
export const APP_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

/** Root-relative home URL (`/` or `/create/`). */
export function appHomeHref(): string {
  if (!APP_BASE) return "/";
  return `${APP_BASE}/`;
}

/** Prefix a root-relative public asset or route path with the app base. */
export function withAppBase(path: string): string {
  if (!path.startsWith("/")) return path;
  if (!APP_BASE) return path;
  return `${APP_BASE}${path}`;
}

/** Strip the app base from a browser pathname when present. */
export function stripAppBase(pathname: string): string {
  if (!APP_BASE) return pathname;
  if (pathname === APP_BASE || pathname === `${APP_BASE}/`) return "/";
  if (pathname.startsWith(`${APP_BASE}/`)) {
    return pathname.slice(APP_BASE.length) || "/";
  }
  return pathname;
}

/** Map root-relative paths in a record to include the app base. */
export function withAppBaseRecord(urls: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(urls).map(([id, url]) => [id, withAppBase(url)]));
}
