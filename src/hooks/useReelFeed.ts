import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchReelGamesPage } from "@/lib/api/games";
import {
  allCommunityGamesSeen,
  clearReelHomeContext,
  getReelNextId,
  getReelPrevId,
  isPlatformTemplateId,
  markReelSeen,
  readReelHomeContext,
  readReelSession,
  shuffleIds,
  writeReelSession,
  type ReelSession,
} from "@/lib/reelFeed";

const INITIAL_VISIBLE = 10;
const VISIBLE_GROWTH = 10;

export function useReelFeed(gameId: string, platformTemplateIds: string[]) {
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [detachedTemplateId, setDetachedTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [hasMoreRemote, setHasMoreRemote] = useState(true);
  const fetchOffsetRef = useRef(0);
  const templatesAppendedRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const syncSessionState = useCallback((session: ReelSession) => {
    setOrderedIds(session.orderedIds);
    setDetachedTemplateId(session.detachedTemplateId);
    fetchOffsetRef.current = session.fetchOffset;
    setHasMoreRemote(session.hasMore);
    templatesAppendedRef.current = session.templatesAppended;
  }, []);

  const persistSession = useCallback((patch: Partial<ReelSession>) => {
    const current = readReelSession();
    if (!current) return;
    const next = { ...current, ...patch };
    writeReelSession(next);
    syncSessionState(next);
  }, [syncSessionState]);

  const appendTemplateFallback = useCallback(() => {
    if (templatesAppendedRef.current || platformTemplateIds.length === 0) return;
    templatesAppendedRef.current = true;
    const extras = shuffleIds(platformTemplateIds).filter((id) => id !== "neon-sudoku" && id !== "simple-agent-game");
    setOrderedIds((prev) => {
      const next = [...prev, ...extras.filter((id) => !prev.includes(id))];
      persistSession({ orderedIds: next, templatesAppended: true });
      return next;
    });
  }, [persistSession, platformTemplateIds]);

  const loadMoreRemote = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRemote) return;
    loadingMoreRef.current = true;
    try {
      const page = await fetchReelGamesPage(fetchOffsetRef.current, 50);
      fetchOffsetRef.current = page.nextOffset;
      setHasMoreRemote(page.hasMore);
      setOrderedIds((prev) => {
        const filtered = page.ids.filter(
          (id) => !prev.includes(id) && !isPlatformTemplateId(id, platformTemplateIds),
        );
        if (filtered.length === 0) {
          persistSession({ fetchOffset: page.nextOffset, hasMore: page.hasMore });
          return prev;
        }
        const next = [...prev, ...filtered];
        persistSession({
          orderedIds: next,
          fetchOffset: page.nextOffset,
          hasMore: page.hasMore,
        });
        return next;
      });
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMoreRemote, persistSession, platformTemplateIds]);

  useEffect(() => {
    if (!gameId) return;

    const existing = readReelSession();
    const belongsToSession =
      existing &&
      (existing.orderedIds.includes(gameId) || existing.detachedTemplateId === gameId);

    if (belongsToSession) {
      syncSessionState(existing);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setVisibleCount(INITIAL_VISIBLE);

    void (async () => {
      const isTemplateEntry = isPlatformTemplateId(gameId, platformTemplateIds);
      const homeContext = readReelHomeContext();
      clearReelHomeContext();

      let ids: string[] = [];
      let nextOffset = 0;
      let hasMore = true;

      if (homeContext?.orderedIds.includes(gameId)) {
        ids = homeContext.orderedIds.filter((id) => !isPlatformTemplateId(id, platformTemplateIds));
        const page = await fetchReelGamesPage(0, 50);
        nextOffset = page.nextOffset;
        hasMore = page.hasMore;
        const extras = shuffleIds(
          page.ids.filter(
            (id) => !ids.includes(id) && !isPlatformTemplateId(id, platformTemplateIds),
          ),
        );
        ids = [...ids, ...extras];
      } else {
        const page = await fetchReelGamesPage(0, 50);
        ids = shuffleIds(
          page.ids.filter((id) => !isPlatformTemplateId(id, platformTemplateIds)),
        );
        nextOffset = page.nextOffset;
        hasMore = page.hasMore;
        if (!isTemplateEntry && !ids.includes(gameId)) {
          ids = [gameId, ...ids.filter((id) => id !== gameId)];
        }
      }

      if (cancelled) return;

      const session: ReelSession = {
        orderedIds: ids,
        detachedTemplateId: isTemplateEntry ? gameId : null,
        templatesAppended: false,
        fetchOffset: nextOffset,
        hasMore,
      };
      writeReelSession(session);
      syncSessionState(session);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, platformTemplateIds, syncSessionState]);

  useEffect(() => {
    if (!gameId || loading) return;
    markReelSeen(gameId);

    const session = readReelSession();
    if (!session || session.templatesAppended) return;
    if (!allCommunityGamesSeen(session, platformTemplateIds)) return;
    if (!session.hasMore) {
      appendTemplateFallback();
    }
  }, [appendTemplateFallback, gameId, loading, platformTemplateIds]);

  useEffect(() => {
    if (loading) return;
    const session = readReelSession();
    if (!session) return;

    const index = session.orderedIds.indexOf(gameId);
    const effectiveIndex =
      session.detachedTemplateId === gameId ? -1 : index >= 0 ? index : 0;

    if (effectiveIndex >= visibleCount - 3) {
      setVisibleCount((count) => Math.min(count + VISIBLE_GROWTH, session.orderedIds.length));
    }

    if (index >= 0 && index >= session.orderedIds.length - 5 && session.hasMore) {
      void loadMoreRemote();
    }
  }, [gameId, loadMoreRemote, loading, visibleCount]);

  const activeGamesList = useMemo(
    () => orderedIds.slice(0, visibleCount).map((id) => ({ id })),
    [orderedIds, visibleCount],
  );

  const getNextGameId = useCallback(
    (currentId: string) => {
      const session = readReelSession();
      if (!session) return null;
      return getReelNextId(session, currentId);
    },
    [],
  );

  const getPrevGameId = useCallback(
    (currentId: string) => {
      const session = readReelSession();
      if (!session) return null;
      return getReelPrevId(session, currentId);
    },
    [],
  );

  const tryLoadMoreForNavigation = useCallback(async () => {
    const session = readReelSession();
    if (!session?.hasMore) {
      if (session && allCommunityGamesSeen(session, platformTemplateIds)) {
        appendTemplateFallback();
      }
      return false;
    }
    await loadMoreRemote();
    return true;
  }, [appendTemplateFallback, loadMoreRemote, platformTemplateIds]);

  return {
    activeGamesList,
    loading,
    detachedTemplateId,
    orderedIds,
    hasMoreRemote,
    getNextGameId,
    getPrevGameId,
    tryLoadMoreForNavigation,
  };
}
