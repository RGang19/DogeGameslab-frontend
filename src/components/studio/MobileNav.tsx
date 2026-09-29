import { Link } from "@tanstack/react-router";
import { NAV_ITEMS } from "@/components/studio/navItems";
import { PixelIcon } from "@/components/term/PixelIcon";

const SIDE = NAV_ITEMS.filter((item) => item.to === "/" || item.to === "/templates");
const END = NAV_ITEMS.filter((item) => item.to === "/leaderboard" || item.to === "/profile");

export const MOBILE_BAR_COLOR = "#040607";

function Tab({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === "/" }}
      className="group flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1.5 text-text-3 transition-colors data-[status=active]:text-phos"
    >
      <span className="grid h-6 place-items-center">
        <PixelIcon name={item.icon} size={18} />
      </span>
      <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.14em]">
        {item.label}
      </span>
      <span className="h-[3px] w-5 bg-transparent group-data-[status=active]:bg-phos group-data-[status=active]:shadow-[0_0_8px_var(--phos)]" />
    </Link>
  );
}

/** Bottom tab bar (phones and tablets). */
export function MobileNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-ink-0 pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
    >
      <div className="flex h-[64px] items-stretch">
        {SIDE.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          <Link
            to="/create"
            aria-label="Create a game"
            className="px-btn absolute -top-5 h-14 w-14 p-0"
            data-variant="magenta"
          >
            <PixelIcon name="plus" size={20} />
          </Link>
          <span className="mt-9 font-mono text-[9px] font-extrabold uppercase tracking-[0.14em] text-magenta">
            Create
          </span>
        </div>
        {END.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
      </div>
    </nav>
  );
}
