import { memo, useEffect, useMemo, useState } from "react";

/*
 * Multi-colour pixel sprites with frame animation. A frame is a list of rows;
 * each character picks a palette colour, `.` is transparent.
 */
const PALETTE: Record<string, string> = {
  g: "var(--phos)",
  G: "var(--phos-2)",
  d: "var(--phos-3)",
  a: "var(--amber)",
  m: "var(--magenta)",
  c: "var(--cyan)",
  v: "var(--violet)",
  w: "var(--text)",
  k: "var(--ink-0)",
  r: "var(--danger)",
};

export const SPRITES = {
  // DogeGame bot — the studio's mascot: a little CRT with an antenna.
  bot: [
    [
      "......aa......",
      "......aa......",
      ".......g......",
      "..gggggggggg..",
      "..gkkkkkkkkg..",
      "..gkcckkcckg..",
      "..gkcckkcckg..",
      "..gkkkkkkkkg..",
      "..gkkmmmmkkg..",
      "..gkkkkkkkkg..",
      "..gggggggggg..",
      "....dd..dd....",
      "...ddd..ddd...",
    ],
    [
      "......mm......",
      "......mm......",
      ".......g......",
      "..gggggggggg..",
      "..gkkkkkkkkg..",
      "..gkkkkkkkkg..",
      "..gkcckkcckg..",
      "..gkkkkkkkkg..",
      "..gkkkmmkkkg..",
      "..gkkkkkkkkg..",
      "..gggggggggg..",
      "....dd..dd....",
      "...ddd..ddd...",
    ],
  ],
  invader: [
    [
      "..#.....#..",
      "...#...#...",
      "..#######..",
      ".##.###.##.",
      "###########",
      "#.#######.#",
      "#.#.....#.#",
      "...##.##...",
    ],
    [
      "..#.....#..",
      "#..#...#..#",
      "#.#######.#",
      "###.###.###",
      "###########",
      ".#########.",
      "..#.....#..",
      ".#.......#.",
    ],
  ],
  ghost: [
    [
      "...####...",
      ".########.",
      "##########",
      "##ww##ww##",
      "##wk##wk##",
      "##########",
      "##########",
      "##.##.##.#",
    ],
    [
      "...####...",
      ".########.",
      "##########",
      "##ww##ww##",
      "##kw##kw##",
      "##########",
      "##########",
      "#.##.##.##",
    ],
  ],
  coin: [
    [
      "..####..",
      ".#aaaa#.",
      "#aawwaa#",
      "#aawaaa#",
      "#aawaaa#",
      "#aawwaa#",
      ".#aaaa#.",
      "..####..",
    ],
    [
      "...##...",
      "..#aa#..",
      "..#wa#..",
      "..#wa#..",
      "..#wa#..",
      "..#wa#..",
      "..#aa#..",
      "...##...",
    ],
  ],
  heart: [
    [
      ".mm...mm.",
      "mmmm.mmmm",
      "mwmmmmmmm",
      "mmmmmmmmm",
      ".mmmmmmm.",
      "..mmmmm..",
      "...mmm...",
      "....m....",
    ],
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;

type PixelSpriteProps = {
  name: SpriteName;
  /** Size of one pixel in CSS px. */
  scale?: number;
  /** Colour for `#` pixels (sprites drawn in one colour). */
  color?: string;
  /** Milliseconds per frame; 0 freezes on the first frame. */
  frameMs?: number;
  className?: string;
  title?: string;
};

function framePaths(rows: readonly string[], fallback: string) {
  const byColor = new Map<string, string>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x += 1;
        continue;
      }
      let run = 1;
      while (row[x + run] === ch) run += 1;
      const fill = ch === "#" ? fallback : (PALETTE[ch] ?? fallback);
      byColor.set(fill, `${byColor.get(fill) ?? ""}M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  return Array.from(byColor.entries());
}

export const PixelSprite = memo(function PixelSprite({
  name,
  scale = 4,
  color = "var(--phos)",
  frameMs = 520,
  className = "",
  title,
}: PixelSpriteProps) {
  const frames = SPRITES[name] as readonly (readonly string[])[];
  const [frame, setFrame] = useState(0);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (frames.length < 2 || !frameMs || reduced) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % frames.length), frameMs);
    return () => window.clearInterval(id);
  }, [frames.length, frameMs, reduced]);

  const rendered = useMemo(() => frames.map((rows) => framePaths(rows, color)), [frames, color]);
  const rows = frames[0];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
    >
      {rendered[frame].map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
});
