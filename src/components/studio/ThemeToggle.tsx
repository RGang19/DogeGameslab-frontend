import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/term/PixelIcon";

export type Theme = "dark" | "light";

const THEME_KEY = "dogegame-theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Header switch between the dark CRT palette and the light paper palette. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f1ede2" : "#080c0f");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="px-btn text-text-2"
      data-variant="ghost"
      data-size="icon"
    >
      <PixelIcon name={theme === "light" ? "moon" : "sun"} size={15} />
    </button>
  );
}
