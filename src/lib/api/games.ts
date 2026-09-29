import { api } from "../api";
import { GAMES_PAGE_SIZE } from "../pagination";
import { resolveGameThumbnail } from "../studio-meta";
import type { Game } from "../games-data";

export function mapApiGameToGame(g: Record<string, unknown>, index: number): Game {
  const creatorId = typeof g.creatorId === "string" ? g.creatorId : undefined;
  const creatorName =
    (typeof g.creatorName === "string" && g.creatorName) ||
    (typeof g.username === "string" && g.username) ||
    (typeof g.displayName === "string" && g.displayName);
  const points = g.points as Record<string, unknown> | undefined;
  return {
    title: String(g.title ?? "Untitled"),
    category: typeof g.category === "string" ? g.category : "Game",
    plays: "New",
    emoji: "🎮",
    gradient: (index % 2 === 0 ? "violet" : "cyan") as "violet" | "cyan",
    creator:
      creatorName ||
      (creatorId?.startsWith("0x")
        ? `${creatorId.slice(0, 6)}…${creatorId.slice(-4)}`
        : creatorId || "community"),
    creatorId,
    id: typeof g.id === "string" ? g.id : undefined,
    familyTemplateId:
      typeof g.templateId === "string" && g.templateId !== g.id ? g.templateId : undefined,
    thumbnailUrl: resolveGameThumbnail(g),
    templateId: String(g.id ?? g.templateId ?? ""),
    likes: Number(points?.likes ?? 0),
    shares: Number(points?.shares ?? 0),
    creatorScore: Number(g.creatorScore ?? points?.total ?? 0),
    remixOf: typeof g.remixOf === "string" ? g.remixOf : undefined,
    createdAt: typeof g.createdAt === "string" ? g.createdAt : undefined,
  };
}

export async function fetchGamesPage(offset = 0, limit = GAMES_PAGE_SIZE, category?: string) {
  const { data } = await api.get("/games/list", {
    params: { limit, offset, ...(category ? { category } : {}) },
  });
  const raw = (data?.games ?? []) as Record<string, unknown>[];
  const games = raw.filter((g) => g?.title).map(mapApiGameToGame);
  return { games, hasMore: raw.length >= limit };
}

/** Paginated published game ids for the reels feed (user-generated only on backend). */
export async function fetchReelGamesPage(offset = 0, limit = 50) {
  const { data } = await api.get("/games/list", {
    params: { limit, offset, forReels: true },
  });
  const raw = (data?.games ?? []) as Record<string, unknown>[];
  const ids = raw
    .map((game) => String(game.id ?? game.templateId ?? "").trim())
    .filter(Boolean);
  return {
    ids,
    hasMore: raw.length >= limit,
    nextOffset: offset + raw.length,
  };
}
