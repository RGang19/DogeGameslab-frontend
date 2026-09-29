import { useEffect, useMemo, useState } from "react";

import { gradientClass, type Game } from "@/lib/games-data";
import { getThumbnailCandidates, gradientForId, templateEmoji } from "@/lib/studio-meta";
import { onImageErrorUnlessUnmounting } from "@/lib/safeImageError";

export type CoverArtworkGame = {
  id?: string;
  templateId?: string;
  familyTemplateId?: string;
  thumbnailUrl?: string | null;
  emoji?: string;
  gradient?: Game["gradient"];
};

export function useGameCoverArtwork(game: CoverArtworkGame, lookupId?: string) {
  const candidates = useMemo(() => getThumbnailCandidates(game), [game]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const thumbnailUrl = showFallback ? undefined : candidates[candidateIndex];

  useEffect(() => {
    setCandidateIndex(0);
    setShowFallback(false);
  }, [game.id, game.templateId, game.thumbnailUrl, game.familyTemplateId]);

  const resolvedLookupId = lookupId ?? game.id ?? game.templateId ?? "";
  const emoji = game.emoji ?? templateEmoji[resolvedLookupId] ?? "🎮";
  const gradient =
    gradientClass[game.gradient ?? gradientForId(resolvedLookupId)] ?? gradientClass.violet;

  const handleImageError = (target: HTMLImageElement) => {
    onImageErrorUnlessUnmounting(target, () => {
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((current) => current + 1);
        return;
      }
      setShowFallback(true);
    });
  };

  return {
    showFallback: showFallback || !thumbnailUrl,
    thumbnailUrl,
    emoji,
    gradient,
    handleImageError,
  };
}
