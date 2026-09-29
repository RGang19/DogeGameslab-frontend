import { api } from "../api";

export type GenerationQuota = {
  limits: {
    hybridFree: number;
    proFree: number;
    ultraFree: number;
  };
  used: {
    hybrid: number;
    pro: number;
    ultra: number;
  };
  remaining: {
    hybridFree: number;
    proFree: number;
    ultraFree: number;
    hybridCredits: number;
    proCredits: number;
    ultraCredits: number;
  };
};

export async function fetchGenerationQuota(): Promise<GenerationQuota> {
  const { data } = await api.get("/games/generation-quota");
  return data.quota as GenerationQuota;
}

export function remainingForTier(quota: GenerationQuota | null | undefined, tier: 1 | 2 | 3): number {
  if (!quota) return 0;
  if (tier === 1) return quota.remaining.hybridFree + quota.remaining.hybridCredits;
  if (tier === 2) return quota.remaining.proFree + quota.remaining.proCredits;
  return quota.remaining.ultraFree + quota.remaining.ultraCredits;
}

export function tierQuotaHint(quota: GenerationQuota | null | undefined, tier: 1 | 2 | 3): string | null {
  if (!quota) return null;
  const free =
    tier === 1
      ? quota.remaining.hybridFree
      : tier === 2
        ? quota.remaining.proFree
        : quota.remaining.ultraFree;
  const paid =
    tier === 1
      ? quota.remaining.hybridCredits
      : tier === 2
        ? quota.remaining.proCredits
        : quota.remaining.ultraCredits;
  if (free > 0 && paid > 0) return `${free} free · ${paid} credits left`;
  if (free > 0) return `${free} free left`;
  if (paid > 0) return `${paid} credits left`;
  return "Subscribe to continue";
}
