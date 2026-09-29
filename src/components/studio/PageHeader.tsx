import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page title block: a comment-style kicker, the pixel headline, and an
 * optional row of links or actions. Not sticky — the status bar is.
 */
export function PageHeader({
  title,
  subtitle,
  links,
  command,
  actions,
  className,
}: {
  title: string;
  subtitle: string;
  links?: { label: string; href: string }[];
  /** Shell command echoed above the title, e.g. `cat profile.json`. */
  command?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const subtitleText = subtitle.trim();

  return (
    <header className={cn("px-4 pb-2 pt-5 sm:px-6 lg:px-8 lg:pt-7", className)}>
      {command && (
        <p className="mb-2 font-mono text-[12px] text-text-3">
          <span className="text-phos">$</span> {command}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-pixel text-[18px] leading-tight text-text sm:text-[22px] lg:text-[26px]">
            {title}
            <span className="text-magenta">.</span>
          </h1>
          {subtitleText && (
            <p className="mt-2.5 font-mono text-[12px] text-text-2">
              <span className="text-text-3">// </span>
              {subtitleText}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {links && (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label={`${title} links`}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-btn"
              data-variant="ghost"
              data-size="sm"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
