import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PageHeader } from "@/components/studio/PageHeader";
import { getThumbnailCandidates } from "@/lib/studio-meta";
import { onImageErrorUnlessUnmounting } from "@/lib/safeImageError";
import { getCurrentUserId } from "@/lib/identity";
import {
  fetchCreatorDashboard,
  type CreatorDashboard,
  type DashboardGame,
  type DashboardRange,
  type DashboardSeries,
  type DashboardSeriesPoint,
} from "@/lib/api/dashboard";
import { fetchComments, fetchPointSummary, type Comment } from "@/lib/api/social";
import { PixelIcon, type PixelIconName } from "@/components/term/PixelIcon";
import {
  Btn,
  EmptyState,
  Panel,
  SectionHead,
  Spinner,
  Stat,
  TONE_TEXT,
  Tag,
  TermLoader,
  type Tone,
} from "@/components/term/Term";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Creator Studio" },
      { name: "description", content: "Your games' analytics, comments, and earnings." },
    ],
  }),
  component: Dashboard,
});

type TabKey = "analytics" | "activity" | "earn";

const TABS: { key: TabKey; label: string; icon: PixelIconName }[] = [
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "activity", label: "Activity", icon: "chat" },
  { key: "earn", label: "Earn", icon: "bolt" },
];

// Per-game / earnings lists collapse to this many rows behind a "View all".
const COLLAPSED_GAME_COUNT = 5;

const RANGE_OPTIONS: { value: DashboardRange; label: string; caption: string }[] = [
  { value: "day", label: "Last day", caption: "last 24 hours" },
  { value: "week", label: "Last week", caption: "last 7 days" },
  { value: "month", label: "Last month", caption: "last 30 days" },
  { value: "year", label: "Last year", caption: "last 12 months" },
];

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

// Seconds → "1h 20m" / "45m" / "30s", for the Time metric.
function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  if (total <= 0) return "0m";
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

type MetricKey = "plays" | "games" | "time";

const METRICS: Record<
  MetricKey,
  {
    label: string;
    value: (point: DashboardSeriesPoint) => number;
    format: (value: number) => string;
    noun: string;
    axis: string;
  }
> = {
  plays: {
    label: "Plays",
    value: (p) => p.plays,
    format: formatNumber,
    noun: "plays",
    axis: "plays",
  },
  games: {
    label: "Games",
    value: (p) => p.games,
    format: formatNumber,
    noun: "games",
    axis: "no. of games",
  },
  time: {
    label: "Time",
    value: (p) => p.timeSeconds,
    format: formatDuration,
    noun: "",
    axis: "play time",
  },
};

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: "plays", label: "Plays" },
  { value: "games", label: "Games" },
  { value: "time", label: "Time" },
];

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function TermSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      aria-label={label}
      className="h-8 border-2 border-line-2 bg-ink-0 px-2 font-mono text-[10px] font-extrabold uppercase text-text outline-none focus:border-phos"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function GameThumb({
  id,
  title,
  thumbnailUrl,
}: {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}) {
  const candidates = useMemo(
    () => getThumbnailCandidates({ id, thumbnailUrl }),
    [id, thumbnailUrl],
  );
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  return (
    <div className="size-11 shrink-0 overflow-hidden border-2 border-line-2 bg-ink-0">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={(event) =>
            onImageErrorUnlessUnmounting(event.currentTarget, () =>
              setIndex((current) => Math.min(current + 1, candidates.length)),
            )
          }
        />
      ) : (
        <div className="dither grid size-full place-items-center font-pixel text-[10px] text-text-3">
          {title.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

/** Step path (pixel-chart look): hold each value until the next bucket. */
function stepPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const midX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(2);
    d += ` H${midX} V${pts[i].y.toFixed(2)} H${pts[i].x.toFixed(2)}`;
  }
  return d;
}

function PlaysChart({ series, metric }: { series: DashboardSeries; metric: MetricKey }) {
  const data = series.points;
  const cfg = METRICS[metric];
  const valueOf = (point: DashboardSeriesPoint) => {
    const value = Number(cfg.value(point));
    return Number.isFinite(value) ? value : 0;
  };
  const [hover, setHover] = useState<number | null>(null);
  const padX = 2;
  const padY = 10;
  const innerW = 100 - padX * 2;
  const innerH = 100 - padY * 2 - 8;
  const max = Math.max(1, ...data.map(valueOf));
  const scaleMax = max * 1.15;
  const baseline = padY + innerH;
  const pts = data.map((point, i) => ({
    x: data.length > 1 ? padX + (i / (data.length - 1)) * innerW : 50,
    y: padY + (1 - valueOf(point) / scaleMax) * innerH,
  }));
  const line = stepPath(pts);
  const area = pts.length ? `${line} V${baseline} H${pts[0].x.toFixed(2)} Z` : "";
  const hasValues = data.some((point) => valueOf(point) > 0);
  let peak = 0;
  data.forEach((point, i) => {
    if (valueOf(point) > valueOf(data[peak])) peak = i;
  });
  const active = hover ?? (hasValues ? peak : null);
  const describe = (value: number) =>
    metric === "time" ? cfg.format(value) : `${cfg.format(value)} ${cfg.noun}`;
  const tickCount = Math.min(5, data.length);
  const ticks =
    tickCount > 1
      ? Array.from({ length: tickCount }, (_, i) =>
          Math.round((i / (tickCount - 1)) * (data.length - 1)),
        )
      : data.map((_, i) => i);

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (data.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (data.length - 1)));
  };

  return (
    <div
      className="relative h-52 w-full touch-none border-2 border-line bg-ink-0 sm:h-48"
      onPointerMove={handleMove}
      onPointerDown={handleMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={`${cfg.label} over time, peak ${hasValues ? describe(valueOf(data[peak])) : "none"}`}
    >
      <span className="absolute left-2 top-1.5 font-mono text-[10px] text-text-3">
        {cfg.format(max)}
      </span>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={100 - padX}
            y1={padY + f * innerH}
            y2={padY + f * innerH}
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area && <path d={area} fill="var(--phos)" fillOpacity="0.1" />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke="var(--phos)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 3px rgb(61 255 143 / 0.8))" }}
          />
        )}
      </svg>
      {active !== null && pts[active] && (
        <>
          <div
            className="pointer-events-none absolute bottom-6 top-2 w-px bg-phos/40"
            style={{ left: `${pts[active].x}%` }}
          />
          <div
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 bg-phos shadow-[0_0_8px_var(--phos)]"
            style={{ left: `${pts[active].x}%`, top: `${pts[active].y}%` }}
          />
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border-2 border-phos-3 bg-ink-0 px-2 py-1 text-center font-mono"
            style={{
              left: `${Math.min(86, Math.max(14, pts[active].x))}%`,
              top: `${Math.max(16, pts[active].y - 4)}%`,
            }}
          >
            <p className="text-[11px] font-extrabold text-phos">
              {describe(valueOf(data[active]))}
            </p>
            <p className="text-[9px] text-text-3">{data[active].label}</p>
          </div>
        </>
      )}
      <div className="absolute inset-x-2 bottom-1 flex justify-between font-mono text-[9px] text-text-3">
        {ticks.map((idx) => (
          <span key={idx}>{data[idx]?.label}</span>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("analytics");
  const [range, setRange] = useState<DashboardRange>("week");
  // Doge Points come from the SAME point summary as the header/profile, so the
  // Earn card matches what the user sees elsewhere.
  const [dogeGamePoints, setDogeGamePoints] = useState(0);
  const signedIn = Boolean(getCurrentUserId());
  const navigate = useNavigate();
  const openGame = (gameId: string) => navigate({ to: "/play/$gameId", params: { gameId } });

  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) return;
    fetchPointSummary(userId)
      .then((summary) => setDogeGamePoints(summary.dogeGamePoints ?? summary.lifetimePoints ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    if (!signedIn) {
      setLoading(false);
      return;
    }
    if (data) setRangeLoading(true);
    else setLoading(true);
    fetchCreatorDashboard(range)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("Could not load your dashboard. Please try again.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRangeLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, range]);

  const earners = useMemo(
    () =>
      (data?.games ?? [])
        .filter((game) => game.earned > 0 || Number(game.kpEarned) > 0)
        .sort(
          (a, b) =>
            Math.max(b.earned, Number(b.kpEarned) || 0) -
            Math.max(a.earned, Number(a.kpEarned) || 0),
        ),
    [data],
  );

  return (
    <div className="w-full">
      <PageHeader
        command="top --creator"
        title="DASHBOARD"
        subtitle="Analytics, activity, and earnings for your games."
      />

      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-3 sm:px-6 lg:px-8">
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="mb-5 flex border-2 border-line bg-ink-0 p-1"
        >
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 px-3 py-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] transition-colors",
                tab === key ? "bg-phos text-ink-0" : "text-text-3 hover:text-text",
              )}
            >
              <PixelIcon name={icon} size={12} />
              {label}
            </button>
          ))}
        </div>

        {!signedIn ? (
          <EmptyState
            title="ACCESS DENIED"
            text="Sign in to see your games' analytics, comments, and earnings."
          />
        ) : loading ? (
          <div className="grid place-items-center py-20">
            <TermLoader label="Collecting metrics" />
          </div>
        ) : error ? (
          <EmptyState title="ERROR" text={error} />
        ) : (
          <>
            {tab === "analytics" && (
              <AnalyticsTab
                data={data!}
                range={range}
                onRangeChange={setRange}
                rangeLoading={rangeLoading}
                onOpenGame={openGame}
              />
            )}
            {tab === "activity" && <ActivityTab data={data!} onOpenGame={openGame} />}
            {tab === "earn" && (
              <EarnTab
                earners={earners}
                total={data!.totals.earned}
                dogeGamePoints={dogeGamePoints}
                series={data!.series}
                onOpenGame={openGame}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GameListRow({
  game,
  onOpen,
  value,
  unit,
  tone = "phos",
}: {
  game: DashboardGame;
  onOpen: () => void;
  value: string;
  unit: string;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-2 border-line bg-ink-2 p-2 text-left transition-colors hover:border-phos"
    >
      <GameThumb id={game.id} title={game.title} thumbnailUrl={game.thumbnailUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[13px] font-bold text-text">{game.title}</p>
        <Tag tone={game.published ? "phos" : "amber"} className="mt-1">
          {game.published ? "Published" : "Draft"}
        </Tag>
      </div>
      <div className="text-right">
        <p className={cn("font-term text-[28px] leading-none tabular-nums", TONE_TEXT[tone])}>
          {value}
        </p>
        <p className="font-mono text-[9px] font-bold uppercase text-text-3">{unit}</p>
      </div>
    </button>
  );
}

function AnalyticsTab({
  data,
  range,
  onRangeChange,
  rangeLoading,
  onOpenGame,
}: {
  data: CreatorDashboard;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  rangeLoading: boolean;
  onOpenGame: (gameId: string) => void;
}) {
  const caption = RANGE_OPTIONS.find((option) => option.value === range)?.caption ?? "";
  const [showAllGames, setShowAllGames] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("plays");
  const visibleGames = showAllGames ? data.games : data.games.slice(0, COLLAPSED_GAME_COUNT);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total plays" value={formatNumber(data.totals.plays)} tone="phos" />
        <Stat label="Comments" value={formatNumber(data.totals.comments)} tone="cyan" />
        <Stat label="Score earned" value={formatNumber(data.totals.earned)} tone="amber" />
        <Stat label="Games" value={formatNumber(data.totals.games)} tone="magenta" />
      </div>

      <Panel
        tone="phos"
        title={
          <span className="flex items-center gap-2">
            {METRICS[metric].label.toLowerCase()}.graph
            {rangeLoading && <Spinner />}
          </span>
        }
        actions={
          <>
            <TermSelect
              value={metric}
              onChange={setMetric}
              options={METRIC_OPTIONS}
              label="Chart metric"
            />
            <TermSelect
              value={range}
              onChange={onRangeChange}
              options={RANGE_OPTIONS}
              label="Analytics time range"
            />
          </>
        }
      >
        <p className="mb-2 font-mono text-[10px] text-text-3">
          {METRICS[metric].axis} · {caption}
        </p>
        <PlaysChart series={data.series} metric={metric} />
      </Panel>

      <section>
        <SectionHead title="PER GAME" />
        {data.games.length === 0 ? (
          <EmptyState text="No games yet. Create one to start collecting plays." />
        ) : (
          <>
            <div className="space-y-2">
              {visibleGames.map((game) => (
                <GameListRow
                  key={game.id}
                  game={game}
                  onOpen={() => onOpenGame(game.id)}
                  value={formatNumber(game.plays)}
                  unit="plays"
                />
              ))}
            </div>
            {data.games.length > COLLAPSED_GAME_COUNT && (
              <Btn
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => setShowAllGames((c) => !c)}
              >
                {showAllGames ? "Show less" : `View all ${data.games.length} games`}
              </Btn>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CommentRow({
  username,
  text,
  createdAt,
}: {
  username: string;
  text: string;
  createdAt: string;
}) {
  return (
    <div className="font-mono text-[12px]">
      <span className="text-text-3">[{timeAgo(createdAt)}]</span>{" "}
      <span className="font-bold text-cyan">&lt;{username}&gt;</span>{" "}
      <span className="text-text">{text}</span>
    </div>
  );
}

const STAT_PILLS: {
  key: keyof Pick<DashboardGame, "plays" | "likes" | "comments" | "shares" | "remixes">;
  icon: PixelIconName;
  tone: Tone;
}[] = [
  { key: "plays", icon: "play", tone: "phos" },
  { key: "likes", icon: "heart", tone: "magenta" },
  { key: "comments", icon: "chat", tone: "cyan" },
  { key: "shares", icon: "send", tone: "cyan" },
  { key: "remixes", icon: "code", tone: "amber" },
];

function ActivityGameCard({
  game,
  onViewAll,
  onOpen,
}: {
  game: DashboardGame;
  onViewAll: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="border-2 border-line bg-ink-2 p-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 text-left hover:opacity-90"
      >
        <GameThumb id={game.id} title={game.title} thumbnailUrl={game.thumbnailUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13px] font-bold text-text">{game.title}</p>
          <Tag tone={game.published ? "phos" : "amber"} className="mt-1">
            {game.published ? "Published" : "Draft"}
          </Tag>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STAT_PILLS.map((pill) => (
          <span
            key={pill.key}
            className="flex items-center gap-1.5 border-2 border-line bg-ink-0 px-2 py-1"
          >
            <PixelIcon name={pill.icon} size={10} className={TONE_TEXT[pill.tone]} />
            <span className="font-mono text-[11px] font-bold tabular-nums text-text">
              {formatNumber(game[pill.key])}
            </span>
          </span>
        ))}
      </div>

      {game.recentComments.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t-2 border-dashed border-line pt-3">
          {game.recentComments.map((comment) => (
            <CommentRow
              key={comment.id}
              username={comment.username}
              text={comment.text}
              createdAt={comment.createdAt}
            />
          ))}
          {game.comments > game.recentComments.length && (
            <Btn variant="ghost" size="sm" className="mt-2 w-full" onClick={onViewAll}>
              View all {game.comments} comments
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

function CommentsModal({ game, onClose }: { game: DashboardGame; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchComments(game.id, 1, 100)
      .then((page) => {
        if (active) setComments(page.comments);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [game.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0">
        <DialogTitle className="px-titlebar font-mono text-[10px] text-text">
          #{game.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} — {formatNumber(game.comments)}{" "}
          comments
        </DialogTitle>
        <DialogDescription className="sr-only">All comments on {game.title}.</DialogDescription>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? (
            <div className="grid place-items-center py-12">
              <TermLoader label="Loading comments" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-12 text-center font-mono text-sm text-text-3">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <CommentRow
                key={comment._id}
                username={comment.username || "Anonymous"}
                text={comment.text}
                createdAt={comment.createdAt}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityTab({
  data,
  onOpenGame,
}: {
  data: CreatorDashboard;
  onOpenGame: (gameId: string) => void;
}) {
  const [modalGame, setModalGame] = useState<DashboardGame | null>(null);
  // Games with the most social action first.
  const games = useMemo(
    () =>
      [...data.games].sort(
        (a, b) =>
          b.likes +
          b.comments +
          b.shares +
          b.remixes -
          (a.likes + a.comments + a.shares + a.remixes),
      ),
    [data.games],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Likes"
          value={formatNumber(data.totals.likes)}
          tone="magenta"
          icon={<PixelIcon name="heart" size={12} />}
        />
        <Stat
          label="Comments"
          value={formatNumber(data.totals.comments)}
          tone="cyan"
          icon={<PixelIcon name="chat" size={12} />}
        />
        <Stat
          label="Shares"
          value={formatNumber(data.totals.shares)}
          tone="phos"
          icon={<PixelIcon name="send" size={12} />}
        />
        <Stat
          label="Remixes"
          value={formatNumber(data.totals.remixes)}
          tone="amber"
          icon={<PixelIcon name="code" size={12} />}
        />
      </div>

      <section>
        <SectionHead title="YOUR GAMES" />
        {games.length === 0 ? (
          <EmptyState text="No games yet. Create one to start collecting activity." />
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <ActivityGameCard
                key={game.id}
                game={game}
                onViewAll={() => setModalGame(game)}
                onOpen={() => onOpenGame(game.id)}
              />
            ))}
          </div>
        )}
      </section>

      {modalGame && <CommentsModal game={modalGame} onClose={() => setModalGame(null)} />}
    </div>
  );
}

function EarnTab({
  earners,
  total,
  dogeGamePoints,
  series,
  onOpenGame,
}: {
  earners: CreatorDashboard["games"];
  total: number;
  dogeGamePoints: number;
  series: DashboardSeries;
  onOpenGame: (gameId: string) => void;
}) {
  const [historyMetric, setHistoryMetric] = useState<"all" | "kp" | "cs">("all");
  const historyEntries = earners
    .flatMap((game) => {
      const entries: { game: DashboardGame; metric: "kp" | "cs"; value: number }[] = [];
      if ((historyMetric === "all" || historyMetric === "cs") && game.earned > 0) {
        entries.push({ game, metric: "cs", value: game.earned });
      }
      if ((historyMetric === "all" || historyMetric === "kp") && Number(game.kpEarned) > 0) {
        entries.push({ game, metric: "kp", value: Number(game.kpEarned) });
      }
      return entries;
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="border-2 border-amber-2 bg-ink-2 p-4">
          <p className="label-term text-amber">Creator score earned</p>
          <p className="font-term mt-2 text-[48px] leading-none text-amber glow-amber">
            {formatNumber(total)}
          </p>
        </div>
        <div className="border-2 border-magenta-2 bg-ink-2 p-4">
          <p className="label-term text-magenta">Doge Points earned</p>
          <p className="font-term mt-2 text-[48px] leading-none text-magenta glow-magenta">
            {formatNumber(dogeGamePoints)}
          </p>
        </div>
      </div>

      <EarningsChart series={series} metric={historyMetric} />

      <section>
        <SectionHead
          title="HISTORY"
          action={
            <TermSelect
              value={historyMetric}
              onChange={setHistoryMetric}
              options={[
                { value: "all", label: "All" },
                { value: "kp", label: "DP" },
                { value: "cs", label: "CS" },
              ]}
              label="Earnings history type"
            />
          }
        />
        {historyEntries.length === 0 ? (
          <EmptyState
            text={
              historyMetric === "all"
                ? "No earnings history yet."
                : historyMetric === "cs"
                  ? "No Creator Score history yet."
                  : "No Doge Points history for these games yet."
            }
          />
        ) : (
          <div className="space-y-2">
            {historyEntries.map(({ game, metric, value }) => (
              <GameListRow
                key={`${game.id}-${metric}`}
                game={game}
                onOpen={() => onOpenGame(game.id)}
                value={formatNumber(value)}
                unit={`${metric.toUpperCase()} earned`}
                tone={metric === "kp" ? "magenta" : "amber"}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EarningsChart({
  series,
  metric,
}: {
  series: DashboardSeries;
  metric: "all" | "kp" | "cs";
}) {
  const data = series.points;
  const [hover, setHover] = useState<number | null>(null);
  const padX = 2;
  const padTop = 10;
  const innerW = 100 - padX * 2;
  const innerH = 100 - padTop - 20;
  const csValues = data.map((point) => Number(point.earned) || 0);
  const kpValues = data.map((point) => Number(point.kpEarned) || 0);
  const csMax = Math.max(1, ...csValues);
  const kpMax = Math.max(1, ...kpValues);
  const pointsFor = (values: number[], max: number) =>
    values.map((value, index) => ({
      x: data.length > 1 ? padX + (index / (data.length - 1)) * innerW : 50,
      y: padTop + (1 - value / (max * 1.12)) * innerH,
    }));
  const csPoints = pointsFor(csValues, csMax);
  const kpPoints = pointsFor(kpValues, kpMax);
  const tickCount = Math.min(5, data.length);
  const ticks =
    tickCount > 1
      ? Array.from({ length: tickCount }, (_, index) =>
          Math.round((index / (tickCount - 1)) * (data.length - 1)),
        )
      : data.map((_, index) => index);

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!data.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(fraction * (data.length - 1)));
  };

  return (
    <Panel
      tone="amber"
      title="earnings.graph"
      actions={
        <span className="flex items-center gap-3">
          {(metric === "all" || metric === "kp") && (
            <span className="flex items-center gap-1.5 text-magenta">
              <i className="size-2 bg-magenta" /> DP
            </span>
          )}
          {(metric === "all" || metric === "cs") && (
            <span className="flex items-center gap-1.5 text-amber">
              <i className="size-2 bg-amber" /> CS
            </span>
          )}
        </span>
      }
    >
      <div
        className="relative h-48 w-full touch-none border-2 border-line bg-ink-0"
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Earnings over time"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="size-full overflow-visible"
        >
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={padX}
              x2={100 - padX}
              y1={padTop + f * innerH}
              y2={padTop + f * innerH}
              stroke="var(--line)"
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {(metric === "all" || metric === "kp") && (
            <path
              d={stepPath(kpPoints)}
              fill="none"
              stroke="var(--magenta)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {(metric === "all" || metric === "cs") && (
            <path
              d={stepPath(csPoints)}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hover !== null && data[hover] && (
          <>
            <div
              className="pointer-events-none absolute bottom-6 top-2 w-px bg-amber/40"
              style={{ left: `${csPoints[hover].x}%` }}
            />
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border-2 border-amber-2 bg-ink-0 px-2 py-1 text-center font-mono"
              style={{
                left: `${Math.min(85, Math.max(15, csPoints[hover].x))}%`,
                top: `${Math.max(28, Math.min(csPoints[hover].y, kpPoints[hover].y) - 3)}%`,
              }}
            >
              <p className="text-[11px] font-extrabold">
                {(metric === "all" || metric === "kp") && (
                  <span className="text-magenta">{formatNumber(kpValues[hover])} DP</span>
                )}
                {metric === "all" && <span className="mx-1.5 text-text-3">·</span>}
                {(metric === "all" || metric === "cs") && (
                  <span className="text-amber">{formatNumber(csValues[hover])} CS</span>
                )}
              </p>
              <p className="text-[9px] text-text-3">{data[hover].label}</p>
            </div>
          </>
        )}
        <div className="absolute inset-x-2 bottom-1 flex justify-between font-mono text-[9px] text-text-3">
          {ticks.map((index) => (
            <span key={index}>{data[index]?.label}</span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
