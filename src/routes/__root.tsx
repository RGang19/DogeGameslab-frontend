import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { clearLegacyAnonymousIdentity } from "../lib/identity";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-1 px-4">
      <div className="crt-overlay" aria-hidden="true" />
      <div className="w-full max-w-md font-mono">
        <p className="text-[12px] text-text-3">
          <span className="text-phos">$</span> cd{" "}
          {typeof window !== "undefined" ? window.location.pathname : ""}
        </p>
        <h1 className="font-pixel mt-4 text-[44px] leading-none text-magenta glow-magenta">404</h1>
        <p className="mt-4 text-sm text-text">
          <span className="font-bold text-danger">bash:</span> no such file or directory
        </p>
        <p className="mt-2 text-sm text-text-2">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6 flex gap-2">
          <Link to="/" className="px-btn" data-variant="primary">
            cd ~/home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-ink-1 px-4">
      <div className="crt-overlay" aria-hidden="true" />
      <div className="w-full max-w-lg font-mono">
        <p className="font-pixel text-[14px] leading-relaxed text-danger">SEGMENTATION FAULT</p>
        <p className="mt-3 text-sm text-text">This page didn't load.</p>
        <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap border-2 border-line bg-ink-0 p-3 text-[12px] text-text-2">
          {error.message}
        </pre>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="px-btn"
            data-variant="primary"
          >
            Retry
          </button>
          <Link to="/" className="px-btn" data-variant="ghost">
            cd ~/home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // The studio depends on client-only DogeOS and Studio providers installed in
  // App.tsx. Rendering routes on the server bypasses those providers and makes
  // direct route loads call useStudioContext outside StudioProvider.
  ssr: false,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The DogeOS provider (App.tsx) owns the wallet session and identity sync.
  useEffect(() => {
    clearLegacyAnonymousIdentity();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
