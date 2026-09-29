import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Sidebar } from "@/components/studio/Sidebar";
import { MobileNav } from "@/components/studio/MobileNav";
import { AppHeader } from "@/components/studio/AppHeader";
import { StudioPageBackground } from "@/components/studio/StudioPageBackground";
import { BootScreen } from "@/components/term/BootScreen";
import { isPlayPath, rememberPlayReturnPath } from "@/lib/playNavigation";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const isPlayPage = isPlayPath(location.pathname);
  const isEditPage = /\/edit\//.test(location.pathname);
  const prevLocationRef = useRef({
    pathname: location.pathname,
    search: typeof location.search === "string" ? location.search : "",
  });

  useEffect(() => {
    const prev = prevLocationRef.current;
    const currentSearch = typeof location.search === "string" ? location.search : "";
    if (isPlayPath(location.pathname) && !isPlayPath(prev.pathname)) {
      rememberPlayReturnPath(prev.pathname, prev.search);
    }
    prevLocationRef.current = { pathname: location.pathname, search: currentSearch };
  }, [location.pathname, location.search]);

  return (
    <div className="relative flex min-h-screen w-full">
      <BootScreen />
      {/* Games get a clean picture — the CRT layer stays off while one runs. */}
      {!isPlayPage && !isEditPage && <div className="crt-overlay" aria-hidden="true" />}
      <StudioPageBackground />
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {!isPlayPage && <AppHeader />}
        <main
          className={
            isPlayPage || isEditPage
              ? "min-w-0 flex-1"
              : "min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10"
          }
        >
          <Outlet />
        </main>
      </div>
      {!isPlayPage && <MobileNav />}
    </div>
  );
}
