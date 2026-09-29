import type { Game } from "./games-data";
import { withAppBase, withAppBaseRecord } from "./appBase";

// Build the API base URL from env, same logic as api.ts.
const rawBaseUrl = import.meta.env.VITE_API_URL ?? "";
const apiBase = rawBaseUrl.replace(/\/$/, "").endsWith("/api")
  ? rawBaseUrl.replace(/\/$/, "")
  : `${rawBaseUrl.replace(/\/$/, "")}/api`;

/**
 * Returns the backend API URL for a thumbnail image.
 * Falls back to the static path from templateThumbnails if needed.
 */
// Thumbnails are served from object storage when configured; the backend
// endpoint (which redirects to storage) remains the fallback.
const thumbnailsBase = (import.meta.env.VITE_THUMBNAILS_BASE ?? "").replace(/\/$/, "");

// Optimized covers bundled with the matching offline templates. Keep this
// allowlist explicit so templates without a supplied local cover continue to
// use the backend/CDN thumbnail fallback instead of returning a static 404.
const localTemplateThumbnailIds = new Set(
  `offline-12minibattles offline-1on1soccer offline-1on1tennis offline-2048 offline-2048cupcakes offline-8ballclassic offline-agariolite offline-ageofwar offline-alpha_1.2.6 offline-amongus offline-awesometanks offline-badicecream offline-badpiggies offline-basketballlegends offline-basketbros offline-basketrandom offline-beta_1.3 offline-bloonstd offline-bloonstd2 offline-bloonstd3 offline-bloonstd4 offline-bloxorz offline-blumgiracers offline-blumgirocket offline-bobtherobber2 offline-bobtherobber5 offline-breakingthebank offline-bubbleshooter offline-candycrush offline-chess offline-choppyorc offline-circloo offline-circloo2 offline-clashofvikings offline-dadish offline-dadish2 offline-dadish3 offline-doodlejump offline-drawclimber offline-ducklife offline-ducklife2 offline-ducklingsio offline-earntodie offline-eggycar offline-evilglitch offline-fancypantsadventure offline-fireboyandwatergirl offline-fireboyandwatergirl2 offline-fireboyandwatergirl3 offline-fireboyandwatergirl4 offline-floodrunner2 offline-floodrunner3 offline-footballlegends offline-freerider3 offline-fruitninja offline-getontop offline-googlebaseball offline-hanger2 offline-hillclimbracinglite offline-idlebreakout offline-ironsnout offline-johnnytrigger offline-jumpingshell offline-karatebros offline-learntofly offline-learntoflyidle offline-mergeroundracers offline-minesweeper offline-monstertracks offline-motox3m2 offline-motox3m3 offline-motox3mpoolparty offline-motox3mspookyland offline-motox3mwinter offline-noobminer offline-oppositeday offline-ovo offline-pacman offline-papasburgeria offline-papaspizzeria offline-parkingfury offline-parkingfury2 offline-parkingfury3 offline-picosschool offline-pixelspeedrun offline-plonky offline-polytrack`
    .split(" "),
);

export function getThumbnailUrl(templateId: string): string {
  if (localTemplateThumbnailIds.has(templateId)) {
    return withAppBase(`/templates/${encodeURIComponent(templateId)}/thumbnail.webp`);
  }
  if (thumbnailsBase) return `${thumbnailsBase}/${encodeURIComponent(templateId)}`;
  return `${apiBase}/thumbnails/${encodeURIComponent(templateId)}`;
}

function absoluteThumbnailUrl(url: string): string {
  if (url.startsWith("/api/")) {
    const origin = apiBase.replace(/\/api$/, "");
    return `${origin}${url}`;
  }
  return url;
}

function isPlaceholderThumbnail(url: string): boolean {
  return !url || url.startsWith("data:image/svg+xml") || url.startsWith("/thumbnails/");
}

/** Ordered thumbnail URLs to try when a cover image fails or is still generating. */
export function getThumbnailCandidates(game: {
  id?: string;
  templateId?: string;
  familyTemplateId?: string;
  thumbnailUrl?: string | null;
}): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const add = (url?: string | null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push(url);
  };

  const raw = game.thumbnailUrl ?? "";
  if (!isPlaceholderThumbnail(raw)) {
    add(absoluteThumbnailUrl(raw));
  }

  const gameId = game.id ?? game.templateId;
  if (gameId) add(getThumbnailUrl(gameId));

  const familyId = game.familyTemplateId;
  if (familyId && familyId !== gameId) add(getThumbnailUrl(familyId));

  if (!gameId && !familyId) add(getThumbnailUrl("simple-agent-game"));

  return candidates;
}

/**
 * Resolves the best cover image for a created game:
 *  1. its own generated cover (served by the backend, stored as "/api/..."),
 *  2. any non-placeholder URL it carries,
 *  3. the game's OWN id in the thumbnails collection,
 *  4. finally the template family cover.
 */
export function resolveGameThumbnail(game: {
  id?: string;
  templateId?: string;
  thumbnailUrl?: string | null;
}): string {
  return getThumbnailCandidates(game)[0] ?? getThumbnailUrl(game?.templateId ?? "simple-agent-game");
}

// Maps every template id to a poster emoji (ported from the original studio shell).
export const templateEmoji: Record<string, string> = {
  flappy: "🐤",
  match3: "💎",
  clicker: "🪙",
  memory: "🃏",
  quiz: "⚡",
  drawing: "🎨",
  runner: "🏃",
  racing: "🏎️",
  idle: "🏭",
  "ai-arena": "🤖",
  "cyber-runner": "🌃",
  "space-shooter": "🛸",
  minigames: "🎮",
  "realistic-driving": "🚗",
  "fps-survival": "🧟",
  "flight-sim": "✈️",
  "head-soccer-2026": "⚽",
  "goof-runner": "🏃",
  "mini-racer": "🏎️",
  "bubble-shooter": "🫧",
  "blocks-match3": "💎",
  "happy-halloween-match3": "🎃",
  "happy-chef-bubble-shooter": "👨‍🍳",
  "sea-animals": "🐠",
  "christmas-candy": "🍬",
  "lollipops-match3": "🍭",
  "speed-racer": "🏎️",
  "candy-match3": "🍫",
  "smiles-match3": "😊",
  "valentines-match3": "💝",
  "christmas-match3": "🎄",
  "animals-crash-match3": "🦁",
  "halloween-match3": "👻",
  "scary-run": "💀",
  "billiards": "🎱",
  "crazy-match3": "🤪",
  "cars": "🚗",
  "monster-match3": "👾",
  "sweet-match3": "🧁",
  "crazy-car": "🚙",
  "summer-match3": "☀️",
  "funny-faces-match3": "🤡",
  "space-match3": "🚀",
  "math-game-kids": "🔢",
  "truck-racer": "🚛",
  "christmas-gifts": "🎁",
  "christmas-bubbles": "🎅",
  "stick-panda": "🐼",
  "christmas-balls": "🎄",
  "road-racer": "🛣️",
  "jewels-match": "💎",
  "pops-billiards": "🎱",
  "frog-super-bubbles": "🐸",
  "chicken-cross": "🐔",
  "cratch-royale": "🎰",
  "neon-bounce": "🔮",
  "plinko-pro": "📍",
  "race-kings": "🏁",
  "spin-wheel-royale": "🎡",
  "stake-mines": "💣",
};

// Public-folder game builds live under the app base (e.g. /create/templates/…).
// Root-absolute /templates/ paths escape the base in production and fall
// through to the host app's router, which 404s inside the game iframe.
export const constructGameUrls: Record<string, string> = withAppBaseRecord({
  "offline-12minibattles": "/templates/offline-12minibattles/",
  "offline-1on1soccer": "/templates/offline-1on1soccer/",
  "offline-1on1tennis": "/templates/offline-1on1tennis/",
  "offline-2048": "/templates/offline-2048/",
  "offline-2048cupcakes": "/templates/offline-2048cupcakes/",
  "offline-8ballclassic": "/templates/offline-8ballclassic/",
  "offline-alpha_1.2.6": "/templates/offline-alpha_1.2.6/",
  "offline-beta_1.3": "/templates/offline-beta_1.3/",
  "offline-indev": "/templates/offline-indev/",
  "offline-agariolite": "/templates/offline-agariolite/",
  "offline-ageofwar": "/templates/offline-ageofwar/",
  "offline-amongus": "/templates/offline-amongus/",
  "offline-awesometanks": "/templates/offline-awesometanks/",
  "offline-baconmaydie": "/templates/offline-baconmaydie/",
  "offline-badicecream": "/templates/offline-badicecream/",
  "offline-badicecream2": "/templates/offline-badicecream2/",
  "offline-badicecream3": "/templates/offline-badicecream3/",
  "offline-badpiggies": "/templates/offline-badpiggies/",
  "offline-basketballlegends": "/templates/offline-basketballlegends/",
  "offline-basketballstars": "/templates/offline-basketballstars/",
  "offline-basketbros": "/templates/offline-basketbros/",
  "offline-basketrandom": "/templates/offline-basketrandom/",
  "offline-bloonstd": "/templates/offline-bloonstd/",
  "offline-bloonstd2": "/templates/offline-bloonstd2/",
  "offline-bloonstd3": "/templates/offline-bloonstd3/",
  "offline-bloonstd4": "/templates/offline-bloonstd4/",
  "offline-bloxorz": "/templates/offline-bloxorz/",
  "offline-blumgiracers": "/templates/offline-blumgiracers/",
  "offline-blumgirocket": "/templates/offline-blumgirocket/",
  "offline-bobtherobber2": "/templates/offline-bobtherobber2/",
  "offline-bobtherobber5": "/templates/offline-bobtherobber5/",
  "offline-breakingthebank": "/templates/offline-breakingthebank/",
  "offline-bubbleshooter": "/templates/offline-bubbleshooter/",
  "offline-candycrush": "/templates/offline-candycrush/",
  "offline-chess": "/templates/offline-chess/",
  "offline-choppyorc": "/templates/offline-choppyorc/",
  "offline-circloo": "/templates/offline-circloo/",
  "offline-circloo2": "/templates/offline-circloo2/",
  "offline-clashofvikings": "/templates/offline-clashofvikings/",
  "offline-dadish": "/templates/offline-dadish/",
  "offline-dadish2": "/templates/offline-dadish2/",
  "offline-dadish3": "/templates/offline-dadish3/",
  "offline-doodlejump": "/templates/offline-doodlejump/",
  "offline-drawclimber": "/templates/offline-drawclimber/",
  "offline-ducklife": "/templates/offline-ducklife/",
  "offline-ducklife2": "/templates/offline-ducklife2/",
  "offline-ducklingsio": "/templates/offline-ducklingsio/",
  "offline-earntodie": "/templates/offline-earntodie/",
  "offline-eggycar": "/templates/offline-eggycar/",
  "offline-evilglitch": "/templates/offline-evilglitch/",
  "offline-fancypantsadventure": "/templates/offline-fancypantsadventure/",
  "offline-fireboyandwatergirl": "/templates/offline-fireboyandwatergirl/",
  "offline-fireboyandwatergirl2": "/templates/offline-fireboyandwatergirl2/",
  "offline-fireboyandwatergirl3": "/templates/offline-fireboyandwatergirl3/",
  "offline-fireboyandwatergirl4": "/templates/offline-fireboyandwatergirl4/",
  "offline-flappybird": "/templates/offline-flappybird/",
  "offline-floodrunner2": "/templates/offline-floodrunner2/",
  "offline-floodrunner3": "/templates/offline-floodrunner3/",
  "offline-footballlegends": "/templates/offline-footballlegends/",
  "offline-freerider3": "/templates/offline-freerider3/",
  "offline-fruitninja": "/templates/offline-fruitninja/",
  "offline-getontop": "/templates/offline-getontop/",
  "offline-googlebaseball": "/templates/offline-googlebaseball/",
  "offline-googledino": "/templates/offline-googledino/",
  "offline-hanger2": "/templates/offline-hanger2/",
  "offline-hillclimbracinglite": "/templates/offline-hillclimbracinglite/",
  "offline-idlebreakout": "/templates/offline-idlebreakout/",
  "offline-ironsnout": "/templates/offline-ironsnout/",
  "offline-johnnytrigger": "/templates/offline-johnnytrigger/",
  "offline-jumpingshell": "/templates/offline-jumpingshell/",
  "offline-karatebros": "/templates/offline-karatebros/",
  "offline-learntofly": "/templates/offline-learntofly/",
  "offline-learntoflyidle": "/templates/offline-learntoflyidle/",
  "offline-leveldevil": "/templates/offline-leveldevil/",
  "offline-mergeroundracers": "/templates/offline-mergeroundracers/",
  "offline-minesweeper": "/templates/offline-minesweeper/",
  "offline-monstertracks": "/templates/offline-monstertracks/",
  "offline-motox3m2": "/templates/offline-motox3m2/",
  "offline-motox3m3": "/templates/offline-motox3m3/",
  "offline-motox3mpoolparty": "/templates/offline-motox3mpoolparty/",
  "offline-motox3mspookyland": "/templates/offline-motox3mspookyland/",
  "offline-motox3mwinter": "/templates/offline-motox3mwinter/",
  "offline-noobminer": "/templates/offline-noobminer/",
  "offline-oppositeday": "/templates/offline-oppositeday/",
  "offline-ovo": "/templates/offline-ovo/",
  "offline-ovo2": "/templates/offline-ovo2/",
  "offline-pacman": "/templates/offline-pacman/",
  "offline-papasburgeria": "/templates/offline-papasburgeria/",
  "offline-papaspizzeria": "/templates/offline-papaspizzeria/",
  "offline-parkingfury": "/templates/offline-parkingfury/",
  "offline-parkingfury2": "/templates/offline-parkingfury2/",
  "offline-parkingfury3": "/templates/offline-parkingfury3/",
  "offline-picosschool": "/templates/offline-picosschool/",
  "offline-pixelspeedrun": "/templates/offline-pixelspeedrun/",
  "offline-plonky": "/templates/offline-plonky/",
  "offline-polytrack": "/templates/offline-polytrack/",

  "head-soccer-2026": "/templates/head-soccer-2026/",
  "goof-runner": "/templates/goof-runner/",
  "mini-racer": "/templates/mini-racer/",
  "bubble-shooter": "/templates/bubble-shooter/",
  "blocks-match3": "/templates/blocks-match3/",
  "chicken-cross": "/templates/chicken-cross/",
  "cratch-royale": "/templates/cratch-royale/",
  "neon-bounce": "/templates/neon-bounce/",
  "plinko-pro": "/templates/plinko-pro/",
  "race-kings": "/templates/race-kings/",
  "spin-wheel-royale": "/templates/spin-wheel-royale/",
  "stake-mines": "/templates/stake-mines/",
});

export const templateThumbnails: Record<string, string> = {};

const gradientKeys: Game["gradient"][] = ["pink", "green", "cyan", "warm", "violet"];

// Deterministically assigns one of the design-system gradients to a template id,
// so real templates render with the same look as the mock GameCard data.
export function gradientForId(id: string): Game["gradient"] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return gradientKeys[hash % gradientKeys.length];
}

export type TemplateEngine = "threejs" | "construct";

export function engineOf(template: { engine?: string } | null | undefined): TemplateEngine {
  if (template?.engine === "construct") return "construct";
  return "threejs";
}

// Templates start with no fabricated play counts — the home page overlays the
// real view totals from /social/views-top wherever they exist.
export function playCount(_index: number): string {
  return "New";
}

// Adapts a raw gameTemplate into the design-system Game shape used by GameCard.
export function templateToGame(template: any, index = 0): Game {
  if (!template?.id && !template?.name) {
    return {
      title: "Loading…",
      category: "Game",
      plays: playCount(index),
      emoji: "🎮",
      gradient: "violet",
      creator: "studio",
    };
  }
  return {
    title: String(template.name ?? "Untitled"),
    category: typeof template.category === "string" ? template.category : "Game",
    plays: playCount(index),
    emoji: templateEmoji[template.id] ?? "🎮",
    gradient: gradientForId(String(template.id ?? index)),
    creator: engineOf(template) === "construct" ? "Construct Template" : "3D Web Game",
    thumbnailUrl: template.id ? getThumbnailUrl(template.id) : undefined,
    templateId: template.id ? String(template.id) : undefined,
  };
}
