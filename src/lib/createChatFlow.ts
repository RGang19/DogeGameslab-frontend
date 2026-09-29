import { api } from "@/lib/api";

export type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

export type ChatStage = "game" | "vibe" | "ready";

export const CREATE_CHAT_GREETING =
  "Hey there! What kind of game do you want to create?";

export const vibeIdeas = ["Chill vibes", "World Cup energy", "Neon arcade", "Kids friendly"];

export const createIdeaSeeds = [
  "A neon-cyberpunk parkour runner in Tokyo",
  "Cozy farm sim where animals talk back",
  "Voxel space pirate adventure",
  "Roguelike dungeon crawler with cats",
  "Fast arcade racing game with drift boosts",
  "Fantasy RPG adventure with quests and loot",
  "Sports game with exciting levels and quick matches",
  "Creative arcade game with unique mechanics",
];

const conceptByGame: Record<string, string[]> = {
  fruit: [
    "Fruit Slice Zen: Swipe through flying fruit, avoid bombs, chain combos, and keep the pace calm but satisfying.",
    "Fruit Ninja Arcade: A fast slicing game with fruit arcs, combo streaks, bombs to avoid, and juicy touch controls.",
  ],
  chess: [
    "Royal Gambit: A calm 1-on-1 chess match against a thoughtful AI on a clean neon board.",
    "Knight's Duel: Sharp tactical chess with highlighted legal moves and quick AI replies.",
  ],
  soccer: [
    "World Cup Rush: A fast arcade soccer match with quick goals, dramatic saves, and bright stadium energy.",
    "Street Header: A playful head-soccer duel in a neon street arena with bouncy physics.",
  ],
  runner: [
    "River Ripple: Guide a calm lily pad through a winding river, collecting blossoms and avoiding leaves.",
    "Dream Dash: Run through a soft pastel skyline, collecting stars and gliding past gentle obstacles.",
  ],
  racing: [
    "Mini Traffic Drift: Weave through traffic, collect boost pickups, and chase the cleanest lap.",
    "Sunset Sprint: A chill top-down racer with warm roads, smooth turns, and simple mobile controls.",
  ],
  bubble: [
    "Bubble Reef: Aim colorful bubbles through a peaceful underwater board with satisfying pops.",
    "Cloud Popper: Clear floating bubble clusters in a soft sky world.",
  ],
  match: [
    "Block Bloom: Swap colorful blocks to grow combos in a cozy puzzle garden.",
    "Gem Picnic: A bright match-3 board with relaxed scoring and cheerful effects.",
  ],
};

export function gameKind(text: string) {
  const value = text.toLowerCase();
  if (/(fruit\s*ninja|fruit|slice|slicing|slash|knife|blade)/.test(value)) return "fruit";
  if (/(chess|checkmate|chessboard)/.test(value)) return "chess";
  if (/(soccer|football|world cup)/.test(value)) return "soccer";
  if (/(runner|running|run|parkour|jump)/.test(value)) return "runner";
  if (/(racing|racer|race|car|driv)/.test(value)) return "racing";
  if (/(bubble|shooter|aim)/.test(value)) return "bubble";
  if (/(match|blocks|jewel|candy)/.test(value)) return "match";
  return "runner";
}

export function conceptFor(game: string, vibe: string) {
  const [first, fallback] = conceptByGame[game] ?? conceptByGame.runner;
  if (/chill|calm|cozy|peace|soft|relax/i.test(vibe)) return first;
  return fallback ?? first;
}

export async function fetchConceptFromAgent(
  gameIdea: string,
  vibe: string,
): Promise<string | null> {
  try {
    const { data } = await api.post(
      "/agents/background",
      {
        task: "game-concept",
        input: {
          instruction:
            "Write ONE original browser mini-game concept for the given game idea and vibe. Reply with a single line of plain text, no markdown, formatted exactly as '<Catchy Title>: <two short sentences describing the playable mechanics and mood>'. Under 60 words.",
          gameIdea,
          vibe,
        },
      },
      { timeout: 30000 },
    );

    const jobId = data?.jobId;
    if (!jobId) throw new Error("No jobId returned for concept generation");

    const startedAt = Date.now();
    const maxWaitMs = 12 * 60 * 1000;
    let consecutivePollFailures = 0;
    let result: any = null;

    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      let job: any;
      try {
        const poll = await api.get(`/agents/jobs/${encodeURIComponent(jobId)}`, {
          timeout: 60_000,
        });
        consecutivePollFailures = 0;
        job = poll.data;
      } catch (error) {
        // Temporary mobile-network/proxy failures do not discard a still-
        // running backend generation.
        consecutivePollFailures += 1;
        if (consecutivePollFailures < 5) continue;
        throw error;
      }
      if (job?.status === "complete") {
        result = job.result;
        break;
      }
      if (job?.status === "failed") {
        throw new Error(job.error?.message ?? "Concept generation failed");
      }
    }

    if (!result) throw new Error("Concept generation did not finish in time");
    const text = String(result?.content ?? "")
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "");
    if (!/^[^:\n]{2,60}:\s.+/s.test(text)) return null;
    return text.split("\n")[0].trim();
  } catch (error) {
    console.error("Game concept generation failed", error);
    return null;
  }
}

export function quickRepliesForStage(stage: ChatStage) {
  if (stage === "game") return createIdeaSeeds.slice(0, 4);
  if (stage === "vibe") return vibeIdeas;
  return [];
}
