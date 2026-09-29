import { api } from "../api";

export type PublishGameResult = {
  game: Record<string, unknown>;
  playPath?: string;
  points?: { awarded?: boolean; cs?: number; points?: number };
};

export async function publishGamePackage(gameId: string): Promise<PublishGameResult> {
  const { data } = await api.post(`/games/${encodeURIComponent(gameId)}/publish`);
  return data;
}

export async function unpublishGamePackage(gameId: string) {
  const { data } = await api.delete(`/games/${encodeURIComponent(gameId)}/publish`);
  return data;
}
