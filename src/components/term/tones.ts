import type { Tone } from "./Term";

const CATEGORY_TONES: Record<string, Tone> = {
  arcade: "phos",
  puzzle: "cyan",
  racing: "amber",
  sports: "amber",
  action: "magenta",
  shooter: "magenta",
  combat: "magenta",
  strategy: "violet",
  rpg: "violet",
  adventure: "cyan",
  multiplayer: "magenta",
  casual: "phos",
  board: "cyan",
};

/** Stable ANSI colour for a game category. */
export function categoryTone(category: string | undefined): Tone {
  const key = String(category ?? "").toLowerCase();
  for (const [name, tone] of Object.entries(CATEGORY_TONES)) {
    if (key.includes(name)) return tone;
  }
  const tones: Tone[] = ["phos", "cyan", "amber", "magenta", "violet"];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}
