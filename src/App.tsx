import { RouterProvider } from "@tanstack/react-router";
import { PostHogProvider } from "@posthog/react";
import { AnalyticsIdentity, GlobalClickTracker } from "@/components/analytics/GlobalClickTracker";
import { DogeOSProvider } from "@/components/dogeos/DogeOSProvider";
import { GlobalAudioEffects } from "@/components/studio/GlobalAudioEffects";
import { StudioProvider } from "@/context/StudioContext";
import { router } from "./router";

function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const apiKey = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN as string | undefined;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

  if (!apiKey || !apiHost) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{
        api_host: apiHost,
        defaults: "2026-05-30",
        // GlobalClickTracker emits one consistent event for every document click.
        // Disable PostHog's built-in click autocapture to prevent duplicates.
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        capture_dead_clicks: true,
        capture_heatmaps: true,
        capture_performance: {
          network_timing: true,
          web_vitals: true,
          web_vitals_attribution: true,
        },
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: true,
        },
        disable_session_recording: false,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: ".ph-mask, [data-private]",
          blockSelector: ".ph-no-capture, [data-analytics-block]",
        },
      }}
    >
      <GlobalClickTracker />
      {children}
    </PostHogProvider>
  );
}

export default function App() {
  return (
    <AnalyticsProvider>
      <GlobalAudioEffects />
      <DogeOSProvider>
        <AnalyticsIdentity />
        <StudioProvider openCreatePage={() => void router.navigate({ to: "/create" })}>
          <RouterProvider router={router} />
        </StudioProvider>
      </DogeOSProvider>
    </AnalyticsProvider>
  );
}
