import { useGameCoverArtwork, type CoverArtworkGame } from "@/hooks/useGameCoverArtwork";

type GameCoverArtworkProps = {
  game: CoverArtworkGame;
  lookupId?: string;
  emojiClass?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  alt?: string;
  loading?: "lazy" | "eager";
  draggable?: boolean;
};

export function GameCoverArtwork({
  game,
  lookupId,
  emojiClass = "text-5xl",
  className = "absolute inset-0",
  imageClassName = "absolute inset-0 h-full w-full object-cover object-top",
  fallbackClassName = "absolute inset-0 grid place-items-center",
  alt = "",
  loading = "lazy",
  draggable = false,
}: GameCoverArtworkProps) {
  const { showFallback, thumbnailUrl, emoji, handleImageError } = useGameCoverArtwork(
    game,
    lookupId,
  );

  if (showFallback) {
    // No cover yet: a dithered "no signal" screen with the game's emoji.
    return (
      <div className={`${fallbackClassName} dither bg-ink-3`}>
        <span className={`drop-shadow-[3px_3px_0_#000] ${emojiClass}`}>{emoji}</span>
      </div>
    );
  }

  return (
    <img
      src={thumbnailUrl}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={draggable}
      onError={(event) => handleImageError(event.currentTarget)}
      className={`${className} ${imageClassName}`}
    />
  );
}
