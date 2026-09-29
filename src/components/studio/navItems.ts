import type { PixelIconName } from "@/components/term/PixelIcon";

export type NavItem = {
  to: "/" | "/templates" | "/create" | "/leaderboard" | "/profile";
  /** Shell-style name shown in the command rail. */
  cmd: string;
  label: string;
  icon: PixelIconName;
  /** Number key that jumps here (desktop, outside inputs and games). */
  key: string;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", cmd: "home", label: "Home", icon: "home", key: "1" },
  { to: "/templates", cmd: "templates", label: "Templates", icon: "templates", key: "2" },
  { to: "/create", cmd: "create", label: "Create", icon: "plus", key: "3" },
  { to: "/leaderboard", cmd: "ranks", label: "Ranks", icon: "trophy", key: "4" },
  { to: "/profile", cmd: "profile", label: "Profile", icon: "user", key: "5" },
];

/** `/edit/abc` → `~/edit`, `/` → `~` — the path shown in the status prompt.
 * The router's pathname already excludes the app base path. */
export function shellPath(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0];
  return first ? `~/${first}` : "~";
}
