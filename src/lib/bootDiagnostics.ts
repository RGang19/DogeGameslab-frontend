/**
 * Boot-time checks for the failures that render this app as a blank screen with no
 * console error of their own.
 *
 * The main one: a build's base path is baked into `index.html` at build time
 * (`VITE_BASE_PATH`, see vite.config.ts). Serve a `base: "/"` build from `/create/` and
 * every module request resolves against the main app instead, which answers with its own
 * `index.html`. The browser then fails to parse HTML as JavaScript and nothing mounts.
 */

const PREFIX = "[studio-boot]";

export function logBootDiagnostics() {
  const base = import.meta.env.BASE_URL ?? "/";
  const { pathname, origin } = window.location;

  console.info(`${PREFIX} starting`, {
    buildBase: base,
    pathname,
    origin,
    apiBase: import.meta.env.VITE_API_URL ?? "(unset)",
    mode: import.meta.env.MODE,
  });

  // The served path must live under the base the bundle was built with.
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  if (normalizedBase !== "/" && !pathname.startsWith(normalizedBase)) {
    console.error(
      `${PREFIX} base path mismatch — this build expects to be served from "${normalizedBase}" but is being served from "${pathname}". ` +
        `Asset URLs will resolve to the wrong app. Rebuild with VITE_BASE_PATH set to the path it is mounted at.`,
    );
  }
  if (normalizedBase === "/" && pathname.startsWith("/create/")) {
    console.error(
      `${PREFIX} base path mismatch — this build was made for the domain root (VITE_BASE_PATH=/) but is served under /create/. ` +
        `This is the Cloudflare build; DigitalOcean needs a build with base "/create/".`,
    );
  }

  // Nothing mounted means the app crashed before React rendered.
  window.setTimeout(() => {
    const root = document.getElementById("root");
    if (root && root.childElementCount === 0) {
      console.error(
        `${PREFIX} #root is still empty after 8s — the app bundle never mounted. Check the Network tab for ` +
          `/assets/*.js requests that returned HTML (wrong base path) or 404.`,
      );
    }
  }, 8000);
}
