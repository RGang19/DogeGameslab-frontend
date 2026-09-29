function expireCookie(name: string, path: string) {
  try {
    document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; SameSite=Lax`;
  } catch {
    // ignore
  }
}

/** Best-effort: clears non-HttpOnly cookies for this origin. */
export function clearAllClientCookies() {
  try {
    const raw = document.cookie;
    if (!raw) return;
    const names = raw
      .split(";")
      .map((c) => c.trim().split("=")[0]?.trim())
      .filter(Boolean) as string[];

    for (const name of names) {
      expireCookie(name, "/");
      expireCookie(name, "/create");
      expireCookie(name, "/create/");
    }
  } catch {
    // ignore
  }
}

/** Clears localStorage + sessionStorage (best-effort). */
export function clearAllBrowserStorage() {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

