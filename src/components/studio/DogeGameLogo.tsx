import { DogeIcon, DogeOSWordmark } from "@/components/dogeos/DogeBrand";
import { cn } from "@/lib/utils";

type DogeGameLogoProps = {
  className?: string;
  /** Compact mark ("D//") for tight spaces. */
  compact?: boolean;
  /** Show the "on DogeOS" co-brand. */
  coBrand?: boolean;
};

/** Pixel wordmark: DOGE//CREATE. Tapping it reloads the studio, as before. */
export function DogeGameLogo({
  className = "",
  compact = false,
  coBrand = false,
}: DogeGameLogoProps) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="DogeGame Create — reload"
      title="Reload"
      className={cn(
        "hover-glitch group inline-flex shrink-0 items-center gap-2 text-left outline-none",
        className,
      )}
    >
      <DogeIcon size={compact ? 26 : 24} className="rounded-[7px]" />
      <span className="font-pixel whitespace-nowrap text-[11px] leading-none text-phos glow-phos sm:text-[12px]">
        {compact ? (
          <>
            <span className="text-doge">D</span>
            <span className="text-magenta">//</span>
          </>
        ) : (
          <>
            <span className="text-doge">DOGE</span>
            <span className="text-magenta">//</span>
            <span className="text-text">CREATE</span>
          </>
        )}
      </span>
      {coBrand && !compact && (
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.18em] text-text-3">
          on <DogeOSWordmark height={9} className="text-doge" />
        </span>
      )}
    </button>
  );
}
