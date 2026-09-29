import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentUserId,
  getCurrentUsername,
  hasDisplayName,
  IDENTITY_CHANGED_EVENT,
} from "@/lib/identity";
import {
  fetchLeaderboard,
  submitLeaderboardScore,
  type LeaderboardEntry,
} from "@/lib/api/leaderboards";



export function useLeaderboard(gameId: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Remembers a score that was submitted before the identity had a real display
  // name, so we can re-label its leaderboard entry once the name loads.
  const pendingRelabel = useRef<{ score: number } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const leaderboard = await fetchLeaderboard(gameId);
      setEntries(leaderboard.entries);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const submitScore = useCallback(
    async (score: number) => {
      const userId = getCurrentUserId();
      if (!userId) return;
      const username = getCurrentUsername();
      const leaderboard = await submitLeaderboardScore(gameId, userId, username, score);
      setEntries(leaderboard.entries);
      // If this was labelled with a temporary id-derived name, remember it so we
      // can re-label the entry once the real name loads; otherwise clear.
      pendingRelabel.current = hasDisplayName() ? null : { score };
    },
    [gameId],
  );

  // When the identity becomes ready (wallet / name loads), re-label a score that
  // was submitted under a temporary id. Same userId → the backend $sets the new
  // username on the same row (score preserved via $max), so no duplicate entry.
  useEffect(() => {
    const onIdentityChanged = () => {
      const pending = pendingRelabel.current;
      if (!pending || !hasDisplayName()) return;
      const userId = getCurrentUserId();
      if (!userId) return;
      pendingRelabel.current = null;
      submitLeaderboardScore(gameId, userId, getCurrentUsername(), pending.score)
        .then((leaderboard) => setEntries(leaderboard.entries))
        .catch(() => {});
    };
    window.addEventListener(IDENTITY_CHANGED_EVENT, onIdentityChanged);
    return () => window.removeEventListener(IDENTITY_CHANGED_EVENT, onIdentityChanged);
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(gameId)
      .then((leaderboard) => {
        if (!cancelled) setEntries(leaderboard.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return { entries, loading, refresh, submitScore };
}
