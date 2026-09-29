import { usePostHog } from "@posthog/react";
import { useStudioAuth } from "@/hooks/useStudioAuth";
import { useEffect, useRef } from "react";

const MAX_PATH_DEPTH = 7;

function routePattern(pathname: string) {
  return pathname
    .replace(/^\/play\/[^/]+$/, "/play/:gameId")
    .replace(/^\/edit\/[^/]+$/, "/edit/:gameId")
    .replace(/^\/games\/[^/]+$/, "/games/:gameId")
    .replace(/^\/profile\/[^/]+$/, "/profile/:profileId");
}

function baseProperties() {
  return {
    page_path: routePattern(location.pathname),
    page_title: document.title,
    viewport_width: innerWidth,
    viewport_height: innerHeight,
    device_pixel_ratio: devicePixelRatio,
  };
}

function safeHref(element: Element) {
  const anchor = element.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return undefined;
  try {
    const url = new URL(anchor.href, location.href);
    return url.origin === location.origin
      ? routePattern(url.pathname)
      : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function safeLabel(element: Element) {
  const raw =
    element.getAttribute("data-analytics-label") ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    (["A", "BUTTON"].includes(element.tagName) ? element.textContent : "");
  return (
    raw
      ?.replace(/0x[a-fA-F0-9]{8,}/g, "[address]")
      .replace(/[A-Za-z0-9_-]{20,}/g, "[id]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || undefined
  );
}

function elementDescriptor(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && parts.length < MAX_PATH_DEPTH) {
    let part = current.tagName.toLowerCase();
    if (current.id) part += `#${CSS.escape(current.id)}`;
    const analyticsId = current.getAttribute("data-analytics-id");
    const testId = current.getAttribute("data-testid");
    if (analyticsId) part += `[data-analytics-id="${CSS.escape(analyticsId)}"]`;
    else if (testId) part += `[data-testid="${CSS.escape(testId)}"]`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function componentName(element: Element) {
  return (
    element.closest("[data-analytics-component]")?.getAttribute("data-analytics-component") ||
    undefined
  );
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "Unknown error"))
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/0x[a-fA-F0-9]{8,}/g, "[address]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")
    .slice(0, 240);
}

/** Full delegated analytics coverage for lazy routes, portals, cards, forms and controls. */
export function GlobalClickTracker() {
  const posthog = usePostHog();
  const routeRef = useRef("");
  const scrollMilestones = useRef(new Set<number>());
  const recentClicks = useRef(new Map<string, number[]>());
  const focusedFields = useRef(
    new WeakMap<Element, { startedAt: number; initialLength: number }>(),
  );

  useEffect(() => {
    const capturePage = (navigationType: string) => {
      const path = routePattern(location.pathname);
      if (path === routeRef.current && navigationType !== "initial") return;
      routeRef.current = path;
      scrollMilestones.current.clear();
      posthog.capture("page_viewed", { ...baseProperties(), navigation_type: navigationType });
    };
    capturePage("initial");

    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);
    history.pushState = (...args) => {
      originalPush(...args);
      queueMicrotask(() => capturePage("push"));
    };
    history.replaceState = (...args) => {
      originalReplace(...args);
      queueMicrotask(() => capturePage("replace"));
    };
    const onPop = () => capturePage("pop");

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const tracked =
        event.target.closest(
          "button, a, input, select, textarea, [role], [data-analytics-id], [data-analytics-component]",
        ) || event.target;
      posthog.capture("ui_click", {
        ...baseProperties(),
        element_tag: tracked.tagName.toLowerCase(),
        element_id: tracked.id || undefined,
        element_role: tracked.getAttribute("role") || undefined,
        element_type: tracked.getAttribute("type") || undefined,
        analytics_id: tracked.getAttribute("data-analytics-id") || undefined,
        component: componentName(tracked),
        element_label: safeLabel(tracked),
        element_path: elementDescriptor(tracked),
        destination: safeHref(tracked),
        mouse_button: event.button,
      });
      const clickKey = `${routePattern(location.pathname)}:${elementDescriptor(tracked)}`;
      const now = Date.now();
      const history = [...(recentClicks.current.get(clickKey) ?? []), now].filter(
        (time) => now - time < 1500,
      );
      recentClicks.current.set(clickKey, history);
      if (history.length === 3)
        posthog.capture("ui_rage_click", {
          ...baseProperties(),
          element_path: elementDescriptor(tracked),
          element_label: safeLabel(tracked),
          click_count: history.length,
        });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest(
        "button, input, select, textarea, [aria-disabled='true']",
      );
      const disabled =
        control instanceof HTMLButtonElement ||
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
          ? control.disabled
          : control?.getAttribute("aria-disabled") === "true";
      if (control && disabled)
        posthog.capture("disabled_control_attempted", {
          ...baseProperties(),
          element_path: elementDescriptor(control),
          element_label: safeLabel(control),
          component: componentName(control),
        });
    };

    const onFocus = (event: FocusEvent) => {
      const field = event.target;
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        )
      )
        return;
      posthog.capture("ui_field_focused", {
        ...baseProperties(),
        field_id: field.id || undefined,
        field_name: field.name || undefined,
        field_type: field instanceof HTMLSelectElement ? "select" : field.type,
        component: componentName(field),
      });
      focusedFields.current.set(field, {
        startedAt: Date.now(),
        initialLength: field.value.length,
      });
    };
    const onBlur = (event: FocusEvent) => {
      const field = event.target;
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        )
      )
        return;
      const focus = focusedFields.current.get(field);
      if (!focus) return;
      focusedFields.current.delete(field);
      if (field.value.length === focus.initialLength)
        posthog.capture("ui_field_abandoned", {
          ...baseProperties(),
          field_id: field.id || undefined,
          field_name: field.name || undefined,
          field_type: field instanceof HTMLSelectElement ? "select" : field.type,
          focused_ms: Date.now() - focus.startedAt,
          component: componentName(field),
        });
    };
    const onChange = (event: Event) => {
      const field = event.target;
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        )
      )
        return;
      posthog.capture("ui_field_changed", {
        ...baseProperties(),
        field_id: field.id || undefined,
        field_name: field.name || undefined,
        field_type: field instanceof HTMLSelectElement ? "select" : field.type,
        value_length: field instanceof HTMLSelectElement ? undefined : field.value.length,
        selected_index: field instanceof HTMLSelectElement ? field.selectedIndex : undefined,
        checked:
          field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)
            ? field.checked
            : undefined,
        component: componentName(field),
      });
    };
    const onSubmit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      posthog.capture("ui_form_submitted", {
        ...baseProperties(),
        form_id: event.target.id || undefined,
        form_name: event.target.getAttribute("name") || undefined,
        field_count: event.target.elements.length,
        component: componentName(event.target),
      });
    };

    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const available = document.documentElement.scrollHeight - innerHeight;
        if (available <= 0) return;
        const depth = Math.round((scrollY / available) * 100);
        [25, 50, 75, 90, 100].forEach((milestone) => {
          if (depth >= milestone && !scrollMilestones.current.has(milestone)) {
            scrollMilestones.current.add(milestone);
            posthog.capture("page_scroll_depth", { ...baseProperties(), depth_percent: milestone });
          }
        });
      });
    };
    const onVisibility = () =>
      posthog.capture("page_visibility_changed", {
        ...baseProperties(),
        visibility_state: document.visibilityState,
      });
    const onError = (event: ErrorEvent) =>
      posthog.capture("frontend_error", {
        ...baseProperties(),
        error_name: event.error instanceof Error ? event.error.name : "Error",
        error_message: safeError(event.error || event.message),
        source_file: event.filename?.split("/").pop(),
        line: event.lineno || undefined,
        column: event.colno || undefined,
      });
    const onRejection = (event: PromiseRejectionEvent) =>
      posthog.capture("frontend_unhandled_rejection", {
        ...baseProperties(),
        error_message: safeError(event.reason),
      });
    const onApiAnalytics = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      posthog.capture(
        detail?.outcome === "failure" ? "api_request_failed" : "api_request_completed",
        {
          ...baseProperties(),
          ...detail,
        },
      );
    };
    const onLoad = () => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!nav) return;
      posthog.capture("page_load_performance", {
        ...baseProperties(),
        dns_ms: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        connect_ms: Math.round(nav.connectEnd - nav.connectStart),
        ttfb_ms: Math.round(nav.responseStart - nav.requestStart),
        dom_interactive_ms: Math.round(nav.domInteractive),
        load_complete_ms: Math.round(nav.loadEventEnd || performance.now()),
        transfer_size: nav.transferSize,
      });
    };

    addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onBlur, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisibility);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("error", onError);
    addEventListener("unhandledrejection", onRejection);
    addEventListener("dogegame:api-analytics", onApiAnalytics);
    if (document.readyState === "complete") onLoad();
    else addEventListener("load", onLoad, { once: true });

    return () => {
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onBlur, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("scroll", onScroll);
      removeEventListener("error", onError);
      removeEventListener("unhandledrejection", onRejection);
      removeEventListener("dogegame:api-analytics", onApiAnalytics);
      removeEventListener("load", onLoad);
    };
  }, [posthog]);
  return null;
}

async function opaqueWalletId(address: string) {
  const bytes = new TextEncoder().encode(`dogegamelab:${address.toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `wallet_${hex.slice(0, 32)}`;
}

/** Identifies users by a hash of their DogeOS wallet; the address itself is never sent. */
export function AnalyticsIdentity() {
  const posthog = usePostHog();
  const { ready, authenticated, user } = useStudioAuth();
  const identified = useRef<string | null>(null);
  useEffect(() => {
    const walletAddress = ready && authenticated ? (user?.id ?? null) : null;
    if (walletAddress && identified.current !== walletAddress) {
      identified.current = walletAddress;
      void opaqueWalletId(walletAddress).then((id) => posthog.identify(id, { is_authenticated: true }));
    } else if (ready && !authenticated && identified.current) {
      posthog.reset();
      identified.current = null;
    }
  }, [authenticated, posthog, ready, user?.id]);
  return null;
}
