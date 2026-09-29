export type Game = {
  title: string;
  category: string;
  plays: string;
  emoji: string;
  gradient: "pink" | "green" | "cyan" | "warm" | "violet";
  creator: string;
  /** Raw backend creator id (e.g. wallet address) — used to fetch creator stats. */
  creatorId?: string;
  thumbnailUrl?: string;
  /** Backend game package id (same value often stored in templateId for feed cards). */
  id?: string;
  /** Original template family id when different from the game package id. */
  familyTemplateId?: string;
  /** When set, the card opens this real template in the Studio. */
  templateId?: string;
  playUrl?: string;
  prompt?: string;
  likes?: number;
  shares?: number;
  remixes?: number;
  creatorScore?: number;
  remixOf?: string;
  createdAt?: string;
  zeroGStorage?: ZeroGStoragePointer;
  thumbnailZeroGStorage?: ZeroGStoragePointer;
};

export type ZeroGStoragePointer = {
  objectType: string;
  objectId: string;
  status: "uploaded" | "skipped" | "failed";
  contentHash: string;
  rootHash?: string | null;
  txHash?: string | null;
  uri: string;
  byteLength: number;
};

export const gradientClass: Record<Game["gradient"], string> = {
  pink: "from-[oklch(0.72_0.27_340)] to-[oklch(0.6_0.27_300)]",
  green: "from-[oklch(0.85_0.2_150)] to-[oklch(0.82_0.16_195)]",
  cyan: "from-[oklch(0.82_0.16_195)] to-[oklch(0.65_0.25_270)]",
  warm: "from-[oklch(0.85_0.19_80)] to-[oklch(0.7_0.22_30)]",
  violet: "from-[oklch(0.65_0.25_295)] to-[oklch(0.5_0.25_300)]",
};

/** Empty placeholders — hardcoded showcase data was removed. Kept so stale HMR imports don't crash. */
export const trending: Game[] = [];
export const fresh: Game[] = [];
export const playersChoice: Game[] = [];
