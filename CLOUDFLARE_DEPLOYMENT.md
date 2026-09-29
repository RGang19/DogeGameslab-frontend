# Cloudflare deployment

Production is deployed as a Cloudflare Worker with static assets using Workers
Builds. Connect this repository to the `creator-studio-frontend-tg` Worker and
use:

- Production branch: `main`
- Build command: `npm run build:cloudflare`
- Deploy command: `npx --yes wrangler@4.123.0 deploy`
- Version command: `npx --yes wrangler@4.123.0 versions upload`
- Root directory: `/`

The Cloudflare build command is intentionally different from `build:do`.
Cloudflare serves this frontend at the domain root, while the DigitalOcean
artifact uses the `/create/` base path.

Add public `VITE_*` values under **Settings → Build → Build Variables and
Secrets** in Cloudflare. Vite embeds these values into the browser bundle, so
they must never contain private credentials even when Cloudflare marks them as
secret.

Worker-only credentials belong under **Settings → Variables and Secrets** and
must not use a `VITE_` prefix. The current asset-only Worker has no runtime code
that consumes Worker secrets.

Local `.env` and `.dev.vars` files are ignored by Git and must not be committed.

