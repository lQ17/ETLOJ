import { useState, useEffect, useRef, useCallback } from "react";
import { Typography, Button, Space } from "@arco-design/web-react";
import { IconArrowRight, IconClockCircle, IconDashboard, IconNotification } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router-dom";
import { announcementApi } from "../../api/announcement";
import { statsApi } from "../../api/stats";

const { Title, Paragraph } = Typography;

/** 元素进入可视区域时返回 true（仅触发一次） */
function useInViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

/** easeOutExpo: 快起慢停的缓动函数，start 为 true 时开始动画 */
function useCountUp(target: number, start: boolean, duration = 1500) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const firedRef = useRef(false);

  const animate = useCallback(() => {
    const begin = performance.now();
    const tick = (now: number) => {
      const elapsed = now - begin;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [target, duration]);

  useEffect(() => {
    if (start && target > 0 && !firedRef.current) {
      firedRef.current = true;
      animate();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [start, target, animate]);

  return value;
}

interface Announcement {
  id: number;
  title: string;
  summary: string;
  isPinned: boolean;
  createdAt: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState({ problemCount: 0, submissionCount: 0, userCount: 0 });
  const [aiStats, setAiStats] = useState({ todayTokens: 0, todayCalls: 0, totalTokens: 0, totalMessages: 0 });
  const { ref: statsRef, inView: statsInView } = useInViewport<HTMLDivElement>();

  const displayProblems = useCountUp(stats.problemCount, statsInView);
  const displaySubmissions = useCountUp(stats.submissionCount, statsInView);
  const displayUsers = useCountUp(stats.userCount, statsInView);

  const displayTodayTokens = useCountUp(aiStats.todayTokens, statsInView);
  const displayTodayCalls = useCountUp(aiStats.todayCalls, statsInView);
  const displayTotalTokens = useCountUp(aiStats.totalTokens, statsInView);
  const displayTotalCalls = useCountUp(aiStats.totalMessages, statsInView);

  useEffect(() => {
    announcementApi.list({ pageSize: 5 }).then((res: any) => {
      setAnnouncements(res.items);
    }).catch(() => {});
    statsApi.getPlatform().then((res: any) => {
      setStats(res);
    }).catch(() => {});
    statsApi.getAiStats().then((res: any) => {
      setAiStats(res);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "96px 0" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 0.8fr",
        gap: "48px",
        alignItems: "center",
        marginBottom: 96
      }}>
        <div>
          <Title heading={1} style={{ fontSize: 56, lineHeight: 1.1, marginBottom: 24 }}>
            让算法学习<br />从未如此简单
          </Title>
          <Paragraph style={{ fontSize: 18, color: "var(--color-muted)", marginBottom: 32, lineHeight: 1.6, maxWidth: 540 }}>
            ETLOJ 专注于 <strong>Easy To Learn</strong> 体验。通过 AI 智能引导解题与沉浸式算法可视化，打破枯燥的刷题模式，带你直观领悟算法精髓。
          </Paragraph>
          <Space size="large">
            <Button type="primary" style={{ padding: "0 20px", height: 40, fontSize: 14, borderRadius: 8 }} onClick={() => navigate("/problems")}>
              开始刷题
            </Button>
            <Button style={{ padding: "0 20px", height: 40, fontSize: 14, borderRadius: 8 }} onClick={() => navigate("/ranking")}>
              查看排名 <IconArrowRight style={{ marginLeft: 8 }} />
            </Button>
          </Space>
        </div>

        <div style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-hairline)",
          borderRadius: "var(--rounded-xl, 16px)",
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Solution.cpp</span>
            <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>Accepted</span>
          </div>
          <div style={{
            fontFamily: "Consolas, monospace",
            fontSize: 13,
            background: "var(--color-canvas)",
            border: "1px solid var(--color-hairline)",
            padding: 16,
            borderRadius: 8,
            overflowX: "auto",
            lineHeight: 1.5,
            whiteSpace: "pre"
          }}><span style={{ color: "#AF00DB" }}>#include</span> <span style={{ color: "#A31515" }}>&lt;bits/stdc++.h&gt;</span>
{"\n"}<span style={{ color: "#0000FF" }}>using namespace</span> <span style={{ color: "#001080" }}>std</span>;
{"\n\n"}<span style={{ color: "#0000FF" }}>int</span> <span style={{ color: "#795E26" }}>main</span>() {"{"}
{"\n"}    <span style={{ color: "#008000" }}>// ETL -&gt; Easy To Learn</span>
{"\n"}    <span style={{ color: "#001080" }}>cout</span> &lt;&lt; <span style={{ color: "#A31515" }}>"Hello ETLOJ!"</span> &lt;&lt; <span style={{ color: "#001080" }}>endl</span>;
{"\n"}    <span style={{ color: "#0000FF" }}>return</span> 0;
{"\n"}{"}"}</div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <IconClockCircle /> 运行时间: 2ms
            </div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <IconDashboard /> 内存占用: 1.2MB
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "32px",
        marginBottom: 96,
        overflow: "hidden",
      }}>
        <div style={{
          background: "var(--color-surface-soft)",
          borderRadius: "var(--rounded-lg, 12px)",
          padding: "48px 32px",
          border: "1px solid var(--color-hairline)",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <Title heading={3} style={{ fontSize: 24, marginBottom: 8, marginTop: 0 }}>平台实时数据</Title>
          <Paragraph style={{ color: "var(--color-muted)", fontSize: 14, marginBottom: 32 }}>
            记录每一次进步
          </Paragraph>
          <div ref={statsRef} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center" }}>
            {[
              { label: "题目总数", value: displayProblems },
              { label: "提交总数", value: displaySubmissions },
              { label: "用户总数", value: displayUsers },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                  {value.toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: "var(--color-surface-soft)",
          borderRadius: "var(--rounded-lg, 12px)",
          padding: "32px",
          border: "1px solid var(--color-hairline)",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <IconNotification style={{ fontSize: 22, color: "var(--color-primary-6)" }} />
            <Title heading={3} style={{ fontSize: 24, margin: 0 }}>公告栏</Title>
          </div>
          {announcements.length === 0 ? (
            <div style={{ color: "var(--color-muted)", fontSize: 14, textAlign: "center", padding: "32px 0", flex: 1 }}>暂无公告</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {announcements.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/announcements?id=${item.id}`)}
                  style={{
                    padding: "12px 16px",
                    background: "var(--color-canvas)",
                    borderRadius: 10,
                    border: "1px solid var(--color-hairline)",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-ink)", display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.isPinned && <span style={{ color: "var(--color-warning-6)" }}>📌</span>}
                      {item.title}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--color-muted)", flexShrink: 0 }}>
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {item.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div
            onClick={() => navigate("/announcements")}
            style={{
              marginTop: 16,
              textAlign: "center",
              fontSize: 14,
              color: "var(--color-primary-6)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            查看更多 →
          </div>
        </div>
      </div>

      {/* 平台 AI 实时交互数据 */}
      <div style={{
        background: "var(--color-surface-soft)",
        borderRadius: "var(--rounded-lg, 12px)",
        padding: "32px",
        border: "1px solid var(--color-hairline)",
        marginBottom: 96
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", textAlign: "center" }}>
          {[
            { label: "今日 Tokens 数", value: displayTodayTokens },
            { label: "今日请求数", value: displayTodayCalls },
            { label: "总 Tokens 数", value: displayTotalTokens },
            { label: "总请求数", value: displayTotalCalls },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                {value.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
