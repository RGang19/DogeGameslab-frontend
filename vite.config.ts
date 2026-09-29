import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ command }) => ({
  // DigitalOcean (production) serves this app under /create/, proxied by nginx on the main
  // app host. Cloudflare Workers serves it at its own domain root, so the build there sets
  // VITE_BASE_PATH=/ explicitly (see .github/workflows/deploy.yml). Don't hardcode this.
  base: process.env.VITE_BASE_PATH || "/create/",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routeFileIgnorePattern: ".*\\.full\\.tsx$",
    }),
    react(),
    // Tailwind blocks the dev server for minutes on first compile — build CSS via
    // `npm run dev:css` instead and serve it from /public in development.
    ...(command === "build" ? [tailwindcss()] : []),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
  server: {
    // Listen on the local network too, so phones on the same Wi-Fi can open the dev app.
    host: true,
    // 5173 belongs to creator-studio-frontend-tg; this app runs beside it.
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
    watch: {
      // The home page lives in _app.index.full.tsx; the router plugin skips it via
      // routeFileIgnorePattern, so the watcher must still see edits to it.
      ignored: ["**/public/templates/**"],
    },
  },
  build: {
    outDir: "dist",
  },
}));
