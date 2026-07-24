import client from "./client";

export interface FeedbackItemPayload {
  problemId: number;
  slug: string;
  title: string;
  difficulty: string;
  status: string;
  score?: number | null;
  submitCount: number;
}

export interface FeedbackLifetimePayload {
  solvedCount: number;
  totalSubmissions: number;
  totalScore: number;
}

export interface CreateFeedbackPayload {
  title: string;
  studentId: number;
  items?: FeedbackItemPayload[];
  problemIds?: number[];
  note?: string;
  /** 海报右上角日期 YYYY-MM-DD */
  displayDate?: string;
  /** 做题查询起始 */
  rangeStart?: string;
  /** 做题查询结束 */
  rangeEnd?: string;
}

export interface FeedbackListItem {
  id: number;
  publicToken: string;
  title: string;
  studentId: number;
  creatorId: number;
  items: FeedbackItemPayload[];
  lifetime?: FeedbackLifetimePayload | null;
  note?: string | null;
  displayDate?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: number; username: string; avatar?: string | null };
  creator?: { id: number; username: string };
}

export interface PreviewSummaryResult {
  student: { id: number; username: string; avatar?: string | null };
  range: { start: string; end: string };
  items: Array<FeedbackItemPayload & { hasAc?: boolean }>;
  lifetime: FeedbackLifetimePayload;
}


export interface PublicSubmissionItem {
  id: number;
  language: string;
  status: string;
  score: number | null;
  timeUsed: number | null;
  memoryUsed: number | null;
  code: string;
  createdAt: string;
}

export interface PublicProblemSubmissionsResult {
  problem: { id: number; slug: string; title: string };
  submissions: PublicSubmissionItem[];
}

export const feedbackApi = {
  /** 时间窗做题汇总（管理端） */
  previewSummary: (params: { userId: number; start: string; end: string }) =>
    client.get("/feedback/preview-summary", { params }) as Promise<PreviewSummaryResult>,

  list: (params?: { page?: number; pageSize?: number }) =>
    client.get("/feedback", { params }) as Promise<{
      items: FeedbackListItem[];
      total: number;
      page: number;
      pageSize: number;
    }>,

  getOne: (id: number) => client.get(`/feedback/${id}`) as Promise<FeedbackListItem>,

  create: (data: CreateFeedbackPayload) =>
    client.post("/feedback", data) as Promise<FeedbackListItem>,

  remove: (id: number) => client.delete(`/feedback/${id}`) as Promise<{ ok: boolean }>,

  /** 公开详情（无需登录） */
  getPublic: (token: string) =>
    client.get(`/feedback/public/${encodeURIComponent(token)}`),

  /** 公开：某题在本反馈时间窗内的全部提交（含代码，倒序） */
  getPublicProblemSubmissions: (token: string, problemId: number) =>
    client.get(
      `/feedback/public/${encodeURIComponent(token)}/problems/${problemId}/submissions`,
    ) as Promise<PublicProblemSubmissionsResult>,

  /** 当前海报 Logo */
  getLogo: () =>
    client.get("/feedback/logo") as Promise<{ logoUrl: string | null }>,

  /** 上传/替换 Logo（Base64 data URL） */
  setLogo: (logo: string) =>
    client.post("/feedback/logo", { logo }) as Promise<{ logoUrl: string }>,

  /** 清除自定义 Logo */
  clearLogo: () =>
    client.delete("/feedback/logo") as Promise<{ ok: boolean }>,
};
