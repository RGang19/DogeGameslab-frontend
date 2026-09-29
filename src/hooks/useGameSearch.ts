import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { mapApiGameToGame } from "@/lib/api/games";
import type { Game } from "@/lib/games-data";

export function useGameSearch(query: string) {
  const [results, setResults] = useState<Game[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(() => {
      api
        .get("/games/list", { params: { limit: 100, offset: 0 } })
        .then((res) => {
          const normalizedQuery = trimmed.toLowerCase();
          const games = (res.data?.games ?? []) as Record<string, unknown>[];
          const mapped = games
            .filter((game) => game?.title)
            .map(mapApiGameToGame)
            .filter((game) =>
              [game.title, game.category, game.creator, game.prompt ?? ""].some((value) =>
                value.toLowerCase().includes(normalizedQuery),
              ),
            )
            .slice(0, 20);
          setResults(mapped);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  return { results, isSearching };
}
