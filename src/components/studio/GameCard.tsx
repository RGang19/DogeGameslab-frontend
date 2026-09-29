import { type Game } from "@/lib/games-data";
import { prepareReelPlayEntry } from "@/lib/reelFeed";
import { useNavigate } from "@tanstack/react-router";
import { GamePosterCard, type GamePosterSize } from "./GamePosterCard";

export function GameCard({
  game,
  index = 0,
  onEdit,
  compact = false,
  size,
  metaTheme = "dark",
}: {
  game: Game;
  index?: number;
  onEdit?: (game: Game) => void;
  compact?: boolean;
  size?: GamePosterSize;
  metaTheme?: "light" | "dark";
}) {
  const navigate = useNavigate();
  const cardSize = size ?? (compact ? "standard" : "featured");

  const open = () => {
    if (game.playUrl) {
      window.location.href = game.playUrl;
      return;
    }
    if (game.templateId) {
      prepareReelPlayEntry(game.templateId, [game.templateId]);
      navigate({ to: "/play", search: { gameId: game.templateId } });
    }
  };

  return (
    <GamePosterCard
      game={game}
      onClick={open}
      onEdit={onEdit ? () => onEdit(game) : undefined}
      size={cardSize}
      index={index}
      metaTheme={metaTheme}
      animated
    />
  );
}
