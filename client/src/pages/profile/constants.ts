// 验证头像 URL 是否安全（仅允许 data:image 或 http/https URL）
export function getSafeAvatar(avatar: string | undefined): string | undefined {
  if (!avatar) return undefined;
  if (/^data:image\//.test(avatar) || /^https?:\/\//.test(avatar)) return avatar;
  return undefined;
}

// ---------- Color palette (cal.com inspired) ----------
export const COLORS = {
  ac: "#00b42a",
  wa: "#f53f3f",
  tle: "#ff7d00",
  mle: "#7816ff",
  re: "#b37feb", // 淡紫色
  ce: "#ffb470", // 淡橙色
  se: "#c9cdd4",
};

export const STATUS_COLOR_MAP: Record<string, string> = {
  AC: COLORS.ac, WA: COLORS.wa, TLE: COLORS.tle,
  MLE: COLORS.mle, RE: COLORS.re, CE: COLORS.ce, SE: COLORS.se,
};

// ---------- Types ----------
export interface ProfileInfo {
  id: number; username: string; avatar?: string; signature?: string;
  role: string; createdAt: string; solvedCount: number; totalSubmissions: number; totalScore: number;
}
export interface ProfileStats {
  statusDistribution: { name: string; value: number }[];
  heatmapData: [string, number][];
  wordCloudData: { name: string; value: number }[];
  acProblems: { problem_id: number; slug: string; title: string; difficulty: string }[];
  attemptedProblems: { problem_id: number; slug: string; title: string; difficulty: string }[];
}
