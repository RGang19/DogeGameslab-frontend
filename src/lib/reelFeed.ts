export const REEL_SESSION_KEY = "dogegame-reel-session-v2";
export const REEL_SEEN_KEY = "dogegame-reel-seen-v2";
export const REEL_HOME_CONTEXT_KEY = "dogegame-reel-home-context-v2";

export type ReelSession = {
  orderedIds: string[];
  detachedTemplateId: string | null;
  templatesAppended: boolean;
  fetchOffset: number;
  hasMore: boolean;
};

export type ReelHomeContext = {
  orderedIds: string[];
  sourceGameId: string;
};

export function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isPlatformTemplateId(id: string, platformTemplateIds: string[]): boolean {
  return platformTemplateIds.includes(id);
}

export function readReelSession(): ReelSession | null {
  try {
    const raw = sessionStorage.getItem(REEL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReelSession;
    if (!Array.isArray(parsed?.orderedIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeReelSession(session: ReelSession) {
  try {
    sessionStorage.setItem(REEL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

export function clearReelSession() {
  try {
    sessionStorage.removeItem(REEL_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function readReelSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(REEL_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markReelSeen(gameId: string) {
  if (!gameId) return;
  const seen = readReelSeen();
  if (seen.has(gameId)) return;
  seen.add(gameId);
  try {
    sessionStorage.setItem(REEL_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore
  }
}

export function rememberReelHomeContext(context: ReelHomeContext) {
  try {
    sessionStorage.setItem(REEL_HOME_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // ignore
  }
}

export function readReelHomeContext(): ReelHomeContext | null {
  try {
    const raw = sessionStorage.getItem(REEL_HOME_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReelHomeContext;
    if (!Array.isArray(parsed?.orderedIds) || !parsed.sourceGameId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearReelHomeContext() {
  try {
    sessionStorage.removeItem(REEL_HOME_CONTEXT_KEY);
  } catch {
    // ignore
  }
}

export function getReelNextId(session: ReelSession, currentId: string): string | null {
  if (session.detachedTemplateId === currentId) {
    return session.orderedIds[0] ?? null;
  }
  const index = session.orderedIds.indexOf(currentId);
  if (index >= 0) return session.orderedIds[index + 1] ?? null;
  return session.orderedIds[0] ?? null;
}

export function getReelPrevId(session: ReelSession, currentId: string): string | null {
  const index = session.orderedIds.indexOf(currentId);
  if (index > 0) return session.orderedIds[index - 1] ?? null;
  if (index === 0 && session.detachedTemplateId) return session.detachedTemplateId;
  if (session.detachedTemplateId === currentId) return null;
  return null;
}

export function communityIdsInSession(session: ReelSession, platformTemplateIds: string[]): string[] {
  return session.orderedIds.filter((id) => !isPlatformTemplateId(id, platformTemplateIds));
}

export function prepareReelPlayEntry(gameId: string, orderedIds?: string[]) {
  clearReelSession();
  const ids = (orderedIds ?? [gameId]).map(String).filter(Boolean);
  if (ids.includes(gameId)) {
    rememberReelHomeContext({ orderedIds: ids, sourceGameId: gameId });
  }
}

export function allCommunityGamesSeen(session: ReelSession, platformTemplateIds: string[]): boolean {
  const communityIds = communityIdsInSession(session, platformTemplateIds);
  if (communityIds.length === 0) return true;
  const seen = readReelSeen();
  return communityIds.every((id) => seen.has(id));
}
