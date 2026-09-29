import { api } from "../api";

export type LeaderboardEntry = {
  rank: number;
  gameId: string;
  userId: string;
  username: string;
  score: number;
  createdAt: string;
  updatedAt?: string;
  zeroGStorage?: ZeroGStoragePointer;
};

export type Leaderboard = {
  gameId: string;
  entries: LeaderboardEntry[];
  zeroGStorage?: ZeroGStoragePointer;
};

export type CreatorScoreEntry = {
  rank: number;
  id: string;
  creatorId: string;
  name: string;
  creatorScore: number;
  lifetimeScore: number;
  updatedAt?: string | null;
};

export type DogeGamePointsEntry = {
  rank: number;
  id: string;
  userId: string;
  walletAddress: string;
  name: string;
  dogeGamePoints: number;
  lifetimePoints: number;
  updatedAt?: string | null;
};

export type LeaderboardRange = "weekly" | "monthly" | "allTime";

export type AggregateLeaderboard<TEntry> = {
  kind: "creator-score" | "dogegame-points";
  metric: "creatorScore" | "dogeGamePoints";
  range: LeaderboardRange;
  entries: TEntry[];
};

export type ZeroGStoragePointer = {
  objectType: string;
  objectId: string;
  status: "uploaded" | "skipped" | "failed";
  contentHash: string;
  rootHash?: string | null;
  txHash?: string | null;
  uri: string;
  byteLength: number;
};

export async function fetchLeaderboard(gameId: string, limit = 20) {
  const { data } = await api.get(`/leaderboards/${gameId}`, { params: { limit } });
  return data as Leaderboard;
}

export async function fetchCreatorScoreLeaderboard(limit = 20, range: LeaderboardRange = "allTime") {
  const { data } = await api.get("/leaderboards/creators", { params: { limit, range } });
  return data as AggregateLeaderboard<CreatorScoreEntry>;
}

export async function fetchDogeGamePointsLeaderboard(limit = 20, range: LeaderboardRange = "allTime") {
  const { data } = await api.get("/leaderboards/dogegame-points", { params: { limit, range } });
  return data as AggregateLeaderboard<DogeGamePointsEntry>;
}

export async function submitLeaderboardScore(
  gameId: string,
  userId: string,
  username: string,
  score: number,
) {
  const { data } = await api.post(`/leaderboards/${gameId}/scores`, {
    userId,
    username,
    score,
  });
  return data as Leaderboard;
}
