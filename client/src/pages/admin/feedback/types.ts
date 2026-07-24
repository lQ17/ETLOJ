/** 课堂反馈海报 / 快照条目（前后端共用形状，Phase 1 后端对齐） */
export interface FeedbackItem {
  problemId: number;
  slug: string;
  title: string;
  difficulty: string;
  /** 该时段最好结果：AC / WA / TLE / … */
  status: string;
  /** 最好得分 0–100，可空 */
  score: number | null;
  submitCount: number;
}

/** 学生全站累计（与个人主页一致，非本节课） */
export interface FeedbackLifetimeStats {
  solvedCount: number;
  totalSubmissions: number;
  totalScore: number;
}

export interface FeedbackPosterData {
  /**
   * 主标题：节次 · 课程名（不含日期）
   * 例：第二节课·前缀和与差分
   */
  title: string;
  /**
   * 顶栏右上角日期，固定 YYYY-MM-DD
   * 例：2026-03-20
   */
  dateLabel: string;
  studentName: string;
  studentHandle?: string;
  avatarUrl?: string;
  note?: string;
  items: FeedbackItem[];
  /** 累计解题 / 总提交 / 总分（个人主页同款） */
  lifetime?: FeedbackLifetimeStats;
  /** 公开访问 token（入库，分享链接用；海报不展示） */
  publicToken?: string;
  /** 详情完整 URL（导出时现拼，不入库；海报不展示） */
  detailUrl?: string;
  /** 站点品牌文案 */
  brand?: string;
  /** 左上角 Logo（data URL 或 http URL），缺省显示 OJ 字标 */
  logoUrl?: string;
}

export interface FeedbackStats {
  acCount: number;
  /** 各题提交次数之和 */
  totalAttempts: number;
  totalCount: number;
}

export function computeFeedbackStats(items: FeedbackItem[]): FeedbackStats {
  const acCount = items.filter((i) => i.status === "AC").length;
  const totalCount = items.length;
  const totalAttempts = items.reduce((sum, i) => sum + (i.submitCount || 0), 0);
  return { acCount, totalAttempts, totalCount };
}
