import { useCallback, useEffect, useRef, useState } from "react";
import { buildPlayUrl } from "@/lib/playNavigation";
import {
  fetchSocialStats,
  toggleLike,
  toggleFavorite,
  recordShare,
  postComment,
  fetchComments,
  removeComment,
  type SocialStats,
  type Comment,
  type SharePlatform,
} from "@/lib/api/social";
import { useCurrentUserId, useCurrentUsername } from "@/hooks/useCurrentUserId";

export type UseSocialReturn = {
  // Stats
  stats: SocialStats | null;
  loading: boolean;

  // Like
  liked: boolean;
  likeCount: number;
  handleLike: () => Promise<void>;
  likeAnimating: boolean;

  // Comments
  commentCount: number;
  comments: Comment[];
  commentsOpen: boolean;
  commentsLoading: boolean;
  setCommentsOpen: (open: boolean) => void;
  handleAddComment: (text: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
  loadMoreComments: () => Promise<void>;
  hasMoreComments: boolean;

  // Favorite
  favorited: boolean;
  favoriteCount: number;
  handleFavorite: () => Promise<void>;
  favoriteAnimating: boolean;

  // Share
  shareCount: number;
  handleShare: (platform?: SharePlatform) => Promise<void>;
  shareMenuOpen: boolean;
  setShareMenuOpen: (open: boolean) => void;
};

export function useSocial(gameId: string): UseSocialReturn {
  const userId = useCurrentUserId();
  const username = useCurrentUsername();

  const [stats, setStats] = useState<SocialStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Like
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  // Comment
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotalPages, setCommentTotalPages] = useState(1);

  // Favorite
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const favoritedRef = useRef(favorited);
  favoritedRef.current = favorited;

  // Share
  const [shareCount, setShareCount] = useState(0);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  // Fetch initial stats
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchSocialStats(gameId, userId || undefined)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setLiked(data.likes.liked);
        setLikeCount(data.likes.count);
        setCommentCount(data.comments.count);
        setFavorited(data.favorites.favorited);
        setFavoriteCount(data.favorites.count);
        setShareCount(data.shares.count);
      })
      .catch(() => {
        // keep defaults on error
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, userId]);

  // ─── Like ──────────────────────────────────────────────────────────────

  const handleLike = useCallback(async () => {
    const wasLiked = likedRef.current;
    setLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 600);

    try {
      const result = await toggleLike(gameId, userId);
      setLiked(result.liked);
      setLikeCount(result.count);
    } catch {
      setLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
    }
  }, [gameId, userId]);

  // ─── Comments ──────────────────────────────────────────────────────────

  const loadComments = useCallback(
    async (page: number) => {
      setCommentsLoading(true);
      try {
        const data = await fetchComments(gameId, page);
        if (page === 1) {
          setComments(data.comments);
        } else {
          setComments((prev) => [...prev, ...data.comments]);
        }
        setCommentPage(data.page);
        setCommentTotalPages(data.totalPages);
        setCommentCount(data.count);
      } finally {
        setCommentsLoading(false);
      }
    },
    [gameId],
  );

  useEffect(() => {
    if (commentsOpen) {
      setCommentPage(1);
      loadComments(1);
    }
  }, [commentsOpen, loadComments]);

  const handleAddComment = useCallback(
    async (text: string) => {
      const result = await postComment(gameId, userId, username, text);
      setComments((prev) => [result.comment, ...prev]);
      setCommentCount(result.count);
    },
    [gameId, userId, username],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      await removeComment(commentId, userId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setCommentCount((prev) => Math.max(0, prev - 1));
    },
    [userId],
  );

  const loadMoreComments = useCallback(async () => {
    if (commentPage < commentTotalPages) {
      await loadComments(commentPage + 1);
    }
  }, [commentPage, commentTotalPages, loadComments]);

  // ─── Favorite ──────────────────────────────────────────────────────────

  const handleFavorite = useCallback(async () => {
    const wasFavorited = favoritedRef.current;
    setFavorited(!wasFavorited);
    setFavoriteCount((prev) => (wasFavorited ? Math.max(0, prev - 1) : prev + 1));
    setFavoriteAnimating(true);
    setTimeout(() => setFavoriteAnimating(false), 600);

    try {
      const result = await toggleFavorite(gameId, userId);
      setFavorited(result.favorited);
      setFavoriteCount(result.count);
    } catch {
      setFavorited(wasFavorited);
      setFavoriteCount((prev) => (wasFavorited ? prev + 1 : Math.max(0, prev - 1)));
    }
  }, [gameId, userId]);

  // ─── Share ─────────────────────────────────────────────────────────────

  const handleShare = useCallback(
    async (platform: SharePlatform = "link") => {
      const url = buildPlayUrl(gameId);

      if (platform === "link") {
        try {
          if (navigator.share) {
            await navigator.share({ title: "Check out this game!", url });
          } else {
            await navigator.clipboard.writeText(url);
          }
        } catch {
          // user cancelled share dialog
        }
      } else if (platform === "twitter") {
        window.open(`https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Check out this awesome game!")}`, "_blank");
      } else if (platform === "whatsapp") {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this awesome game! ${url}`)}`, "_blank");
      } else if (platform === "discord") {
        await navigator.clipboard.writeText(url);
      } else if (platform === "instagram") {
        await navigator.clipboard.writeText(url);
      } else if (platform === "email") {
        window.open(`mailto:?subject=${encodeURIComponent("Check out this awesome game!")}&body=${encodeURIComponent(`Play this game on Creator Spark Studio:\n\n${url}`)}`, "_self");
      }

      try {
        const result = await recordShare(gameId, userId, platform);
        setShareCount(result.count);
      } catch {
        // silent
      }
    },
    [gameId, userId],
  );

  return {
    stats,
    loading,
    liked,
    likeCount,
    handleLike,
    likeAnimating,
    commentCount,
    comments,
    commentsOpen,
    commentsLoading,
    setCommentsOpen,
    handleAddComment,
    handleDeleteComment,
    loadMoreComments,
    hasMoreComments: commentPage < commentTotalPages,
    favorited,
    favoriteCount,
    handleFavorite,
    favoriteAnimating,
    shareCount,
    handleShare,
    shareMenuOpen,
    setShareMenuOpen,
  };
}
