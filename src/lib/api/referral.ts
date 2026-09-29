import { api } from "../api";

export type ReferralSummary = {
  code: string;
  link: string;
  count: number;
  kpEarned: number;
};

export async function fetchReferralSummary() {
  const { data } = await api.get("/referral/me");
  return data as ReferralSummary;
}

export async function qualifyReferral(gameId: string, durationSeconds: number) {
  const { data } = await api.post("/referral/qualify", { gameId, durationSeconds });
  return data as {
    qualified: boolean;
    status?: "held" | "rewarded";
    reason?: string;
  };
}
