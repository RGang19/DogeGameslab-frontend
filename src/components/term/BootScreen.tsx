import { useEffect, useState } from "react";

const BOOT_KEY = "dogegame-term-booted";

const LINES: { text: string; status?: string }[] = [
  { text: "DogeGame BIOS v3.14  (c) 2026 DogeGame" },
  { text: "CONNECTING TO DOGEOS", status: "OK" },
  { text: "CHECKING 0G COMPUTE LINK", status: "OK" },
  { text: "MOUNTING GAME CARTRIDGES", status: "OK" },
  { text: "WAKING UP BUILD AGENTS", status: "OK" },
  { text: "LOADING CREATOR STUDIO" },
];

function shouldBoot() {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(BOOT_KEY)) return false;
  } catch {
    return false;
  }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  // Deep links straight into a game or the auth hand-off skip the intro.
  const path = window.location.pathname;
  return !/\/play(\/|$)/.test(path);
}

/**
 * One-time-per-session POST screen. It never blocks for more than ~1.4s and
 * any key or tap skips it.
 */
export function BootScreen() {
  const [visible, setVisible] = useState(shouldBoot);
  const [shown, setShown] = useState(0);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      // storage blocked — the screen just shows again next time
    }
    const timers: number[] = [];
    LINES.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), 120 + i * 150)));
    for (let p = 1; p <= 10; p += 1) {
      timers.push(window.setTimeout(() => setProgress(p), 780 + p * 45));
    }
    timers.push(window.setTimeout(() => setLeaving(true), 1350));
    timers.push(window.setTimeout(() => setVisible(false), 1520));
    const skip = () => setVisible(false);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-ink-0 px-6 transition-opacity duration-150 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="crt-overlay" />
      <div className="w-full max-w-md font-mono text-[12px] leading-6 text-phos glow-phos sm:text-[13px]">
        {LINES.slice(0, shown).map((line) => (
          <div key={line.text} className="flex gap-2">
            <span className="truncate">{line.text}</span>
            {line.status && (
              <>
                <span className="min-w-4 flex-1 overflow-hidden whitespace-nowrap text-phos-3">
                  ........................................
                </span>
                <span className="text-amber">[{line.status}]</span>
              </>
            )}
          </div>
        ))}
        {shown >= LINES.length && (
          <div className="mt-1 text-phos">
            [{"█".repeat(progress)}
            <span className="text-phos-3">{"░".repeat(10 - progress)}</span>] {progress * 10}%
          </div>
        )}
        <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-text-3">
          press any key <span className="animate-blink">█</span>
        </div>
      </div>
    </div>
  );
}
