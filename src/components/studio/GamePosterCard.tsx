import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Pencil, X } from "lucide-react";
import { type Game } from "@/lib/games-data";
import { GameCoverArtwork } from "@/components/studio/GameCoverArtwork";
import { PixelIcon } from "@/components/term/PixelIcon";
import { Tag, formatCount } from "@/components/term/Term";
import { categoryTone } from "@/components/term/tones";
import { cn } from "@/lib/utils";

export type GamePosterSize = "featured" | "standard" | "compact";

/**
 * Game cartridge: a CRT screen showing the cover, with a label strip below.
 * Hovering (or focusing) lights the frame and flashes PRESS START.
 */
export function GamePosterCard({
  game,
  onClick,
  onEdit,
  onDelete,
  size = "standard",
  index = 0,
  animated = false,
  className = "",
}: {
  game: Game;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  size?: GamePosterSize;
  index?: number;
  /** @deprecated kept for call-site compatibility */
  metaTheme?: "light" | "dark";
  animated?: boolean;
  className?: string;
}) {
  const stopPress = (event: MouseEvent | ReactPointerEvent) => {
    event.stopPropagation();
  };
  const creator =
    game.creator.length > 16
      ? `${game.creator.slice(0, 6)}…${game.creator.slice(-4)}`
      : game.creator;
  const tone = categoryTone(game.category);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Play ${game.title}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex h-full w-full min-w-0 cursor-pointer flex-col border-2 border-line bg-ink-2 outline-none transition-colors hover:border-phos focus-visible:border-phos",
        animated && "animate-rise",
        className,
      )}
      style={animated ? { animationDelay: `${Math.min(index, 12) * 45}ms` } : undefined}
    >
      <div className="scanlines relative aspect-[4/3] w-full shrink-0 overflow-hidden border-b-2 border-line bg-ink-0 group-hover:border-phos">
        <GameCoverArtwork
          game={game}
          emojiClass={size === "compact" ? "text-4xl" : "text-5xl"}
          imageClassName="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
        />

        <span className="pointer-events-none absolute inset-0 z-[3] grid place-items-center bg-ink-0/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="font-pixel animate-blink text-[10px] text-phos glow-phos">
            ▶ PRESS START
          </span>
        </span>

        {game.plays && (
          <span className="absolute bottom-1.5 left-1.5 z-[4] flex items-center gap-1 border border-line-2 bg-ink-0/85 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-text">
            <PixelIcon name="play" size={8} className="text-phos" />
            {game.plays}
          </span>
        )}

        {(onEdit || onDelete) && (
          <span className="absolute right-1.5 top-1.5 z-[4] flex flex-col gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {onEdit && (
              <button
                type="button"
                title="Edit game"
                aria-label={`Edit ${game.title}`}
                onPointerDown={stopPress}
                onPointerUp={stopPress}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="grid size-8 place-items-center border-2 border-line-2 bg-ink-0/90 text-text transition-colors hover:border-phos hover:text-phos"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                title="Delete game"
                aria-label={`Delete ${game.title}`}
                onPointerDown={stopPress}
                onPointerUp={stopPress}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className="grid size-8 place-items-center border-2 border-line-2 bg-ink-0/90 text-text transition-colors hover:border-danger hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1.5",
          size === "featured" ? "p-3" : "p-2.5",
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3
            className={cn(
              "min-w-0 truncate font-mono font-extrabold text-text group-hover:text-phos",
              size === "compact" ? "text-[12px]" : "text-[13px]",
            )}
            title={game.title}
          >
            {game.title}
          </h3>
          {typeof game.likes === "number" && game.likes > 0 && (
            <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold text-magenta">
              <PixelIcon name="heart" size={9} />
              {formatCount(game.likes)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Tag tone={tone}>{game.category}</Tag>
          <span className="min-w-0 truncate font-mono text-[10px] text-text-3" title={game.creator}>
            @{creator}
          </span>
        </div>
      </div>
    </article>
  );
}
