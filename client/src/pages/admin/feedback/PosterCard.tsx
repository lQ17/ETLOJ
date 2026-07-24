import type { Ref } from "react";
import type { FeedbackItem, FeedbackPosterData } from "./types";
import { computeFeedbackStats } from "./types";
import "./poster.css";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  AC: { bg: "rgba(0,180,42,0.12)", color: "#00b42a" },
  WA: { bg: "rgba(245,63,63,0.12)", color: "#f53f3f" },
  TLE: { bg: "rgba(255,125,0,0.12)", color: "#ff7d00" },
  MLE: { bg: "rgba(120,22,255,0.12)", color: "#7816ff" },
  RE: { bg: "rgba(179,127,235,0.15)", color: "#8b5cf6" },
  CE: { bg: "rgba(255,180,112,0.25)", color: "#d97706" },
  SE: { bg: "rgba(201,205,212,0.5)", color: "#86909c" },
  PENDING: { bg: "rgba(22,93,255,0.1)", color: "#165dff" },
  JUDGING: { bg: "rgba(22,93,255,0.1)", color: "#165dff" },
};

const MAX_VISIBLE_ITEMS = 10;

export interface PosterCardProps {
  data: FeedbackPosterData;
  /** 供 html-to-image 挂载 */
  posterRef?: Ref<HTMLDivElement>;
  className?: string;
  /**
   * 固定 480 宽（管理端预览 / 导出克隆用）。
   * 公开页手机端不要开，以便数据概况自动换行。
   */
  fixedWidth?: boolean;
  /**
   * 公开短链页开启：头像可跳转主页、题目可查看提交代码。
   * 管理端预览 / 导出保持 false，避免误点与导出态污染。
   */
  interactive?: boolean;
  onAvatarClick?: () => void;
  onItemClick?: (item: FeedbackItem) => void;
}

function initialOf(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  // 中文取首字，英文取首字母大写
  return /[\u4e00-\u9fff]/.test(t[0]) ? t[0] : t[0].toUpperCase();
}

export default function PosterCard({
  data,
  posterRef,
  className,
  fixedWidth = false,
  interactive = false,
  onAvatarClick,
  onItemClick,
}: PosterCardProps) {
  const avatarClickable = interactive && !!onAvatarClick;
  const itemClickable = interactive && !!onItemClick;
  const stats = computeFeedbackStats(data.items);
  const visible = data.items.slice(0, MAX_VISIBLE_ITEMS);
  const overflow = data.items.length - visible.length;
  const brand = data.brand ?? "威科姆编程中心";

  const rootClass = [
    "fb-poster",
    fixedWidth ? "fb-poster--fixed" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} ref={posterRef}>
      <div className="fb-poster-inner">
        {/* 顶栏 */}
        <div className="fb-poster-header">
          <div className="fb-poster-brand">
            {data.logoUrl ? (
              <div className="fb-poster-brand-logo">
                <img src={data.logoUrl} alt="" />
              </div>
            ) : (
              <div className="fb-poster-brand-mark">OJ</div>
            )}
            <div className="fb-poster-brand-meta">
              <div className="fb-poster-brand-text">{brand} · 学习记录</div>
              <div className="fb-poster-brand-sub">每一次提交，都是成长的足迹</div>
            </div>
          </div>
          {data.dateLabel && <div className="fb-poster-date-chip">{data.dateLabel}</div>}
        </div>

        {/* 标题 */}
        <h1 className="fb-poster-title">{data.title}</h1>

        {/* 学生 */}
        <div className="fb-poster-student">
          <div
            className={`fb-poster-avatar${avatarClickable ? " is-clickable" : ""}`}
            onClick={avatarClickable ? onAvatarClick : undefined}
            onKeyDown={
              avatarClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAvatarClick?.();
                    }
                  }
                : undefined
            }
            role={avatarClickable ? "link" : undefined}
            tabIndex={avatarClickable ? 0 : undefined}
            title={avatarClickable ? "查看主页" : undefined}
          >
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="" />
            ) : (
              initialOf(data.studentName)
            )}
          </div>
          <div className="fb-poster-student-meta">
            <p className="fb-poster-student-name">{data.studentName}</p>
            {data.studentHandle && (
              <p className="fb-poster-student-handle">@{data.studentHandle}</p>
            )}
          </div>
        </div>

        {/* 统计：左=本节彩色 / 右=累计灰色；同行用 baseline 做字体底部对齐 */}
        <div className="fb-poster-section-label">数据概况</div>
        <div className="fb-poster-stats">
          <div className={`fb-poster-stat${data.lifetime ? " has-lifetime" : ""}`}>
            <div className="fb-poster-stat-values">
              <span className="fb-poster-stat-value is-ac">{stats.acCount}</span>
              {data.lifetime ? (
                <>
                  <span className="fb-poster-stat-slash" aria-hidden>
                    /
                  </span>
                  <span className="fb-poster-stat-value is-lifetime">
                    {data.lifetime.solvedCount}
                  </span>
                </>
              ) : null}
            </div>
            <div className="fb-poster-stat-labels">
              <span className="fb-poster-stat-label">本节AC数</span>
              {data.lifetime ? (
                <>
                  <span className="fb-poster-stat-slash-gap" aria-hidden />
                  <span className="fb-poster-stat-label is-lifetime">累计通过</span>
                </>
              ) : null}
            </div>
          </div>
          <div className={`fb-poster-stat${data.lifetime ? " has-lifetime" : ""}`}>
            <div className="fb-poster-stat-values">
              <span className="fb-poster-stat-value is-try">{stats.totalAttempts}</span>
              {data.lifetime ? (
                <>
                  <span className="fb-poster-stat-slash" aria-hidden>
                    /
                  </span>
                  <span className="fb-poster-stat-value is-lifetime">
                    {data.lifetime.totalSubmissions}
                  </span>
                </>
              ) : null}
            </div>
            <div className="fb-poster-stat-labels">
              <span className="fb-poster-stat-label">提交次数</span>
              {data.lifetime ? (
                <>
                  <span className="fb-poster-stat-slash-gap" aria-hidden />
                  <span className="fb-poster-stat-label is-lifetime">累计提交</span>
                </>
              ) : null}
            </div>
          </div>
          <div className={`fb-poster-stat${data.lifetime ? " has-lifetime" : ""}`}>
            <div className="fb-poster-stat-values">
              <span className="fb-poster-stat-value is-total">{stats.totalCount}</span>
              {data.lifetime ? (
                <>
                  <span className="fb-poster-stat-slash" aria-hidden>
                    /
                  </span>
                  <span className="fb-poster-stat-value is-lifetime">
                    {data.lifetime.totalScore}
                  </span>
                </>
              ) : null}
            </div>
            <div className="fb-poster-stat-labels">
              <span className="fb-poster-stat-label">获得分数</span>
              {data.lifetime ? (
                <>
                  <span className="fb-poster-stat-slash-gap" aria-hidden />
                  <span className="fb-poster-stat-label is-lifetime">累计总分</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* 题目列表 */}
        <div className="fb-poster-section-label">本次练习</div>
        <div className="fb-poster-items">
          {visible.map((item) => {
            const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.SE;
            const isAc = item.status === "AC";
            return (
              <div
                key={item.problemId}
                className={`fb-poster-item${itemClickable ? " is-clickable" : ""}`}
                onClick={itemClickable ? () => onItemClick?.(item) : undefined}
                onKeyDown={
                  itemClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onItemClick?.(item);
                        }
                      }
                    : undefined
                }
                role={itemClickable ? "button" : undefined}
                tabIndex={itemClickable ? 0 : undefined}
                title={itemClickable ? "查看提交代码" : undefined}
              >
                <div className={`fb-poster-item-mark ${isAc ? "is-ac" : "is-other"}`}>
                  {isAc ? "✓" : "○"}
                </div>
                <div className="fb-poster-item-body">
                  <div className="fb-poster-item-slug">{item.slug}</div>
                  <div className="fb-poster-item-title" title={item.title}>
                    {item.title}
                  </div>
                </div>
                <div className="fb-poster-item-right">
                  <span
                    className="fb-poster-status"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {item.status}
                  </span>
                  {item.score != null && (
                    <span className="fb-poster-score">
                      {item.score} 分 · {item.submitCount} 次
                    </span>
                  )}
                  {item.score == null && (
                    <span className="fb-poster-score">{item.submitCount} 次提交</span>
                  )}
                </div>
              </div>
            );
          })}
          {overflow > 0 && (
            <div className="fb-poster-more">还有 {overflow} 题未展示</div>
          )}
          {data.items.length === 0 && (
            <div className="fb-poster-more">本时段暂无勾选题目</div>
          )}
        </div>

        {/* 评语 */}
        {data.note && (
          <div className="fb-poster-note">
            <div className="fb-poster-note-label">老师寄语</div>
            <p className="fb-poster-note-text">{data.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
