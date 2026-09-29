import { api } from "../api";

export type DashboardComment = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
};

export type DashboardGame = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  published: boolean;
  plays: number;
  comments: number;
  likes: number;
  shares: number;
  remixes: number;
  earned: number;
  kpEarned: number;
  recentComments: DashboardComment[];
};

export type DashboardRange = "day" | "week" | "month" | "year";

export type DashboardSeriesPoint = {
  key: string;
  label: string;
  earned: number;
  kpEarned: number;
  plays: number;
  timeSeconds: number;
  games: number;
};

export type DashboardSeries = {
  range: DashboardRange;
  points: DashboardSeriesPoint[];
};

export type CreatorDashboard = {
  games: DashboardGame[];
  totals: {
    games: number;
    plays: number;
    comments: number;
    likes: number;
    shares: number;
    remixes: number;
    earned: number;
    dogeGamePoints: number;
  };
  series: DashboardSeries;
};

export async function fetchCreatorDashboard(range: DashboardRange = "week"): Promise<CreatorDashboard> {
  const { data } = await api.get("/dashboard/creator", { params: { range } });
  return data as CreatorDashboard;
}
