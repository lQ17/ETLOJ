import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Spin,
  Result,
  Button,
  Typography,
  Input,
  Space,
  Message,
  Modal,
  Tag,
  Empty,
} from "@arco-design/web-react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import { feedbackApi } from "../../api/feedback";
import type { PublicSubmissionItem } from "../../api/feedback";
import PosterCard from "../admin/feedback/PosterCard";
import type {
  FeedbackPosterData,
  FeedbackItem,
  FeedbackLifetimeStats,
} from "../admin/feedback/types";

SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("c", c);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("python", python);

const { Title, Paragraph, Text } = Typography;

const statusColor: Record<string, string> = {
  PENDING: "gray",
  JUDGING: "blue",
  AC: "green",
  WA: "red",
  TLE: "orange",
  MLE: "orange",
  RE: "red",
  CE: "orange",
  SE: "red",
};

const langLabel: Record<string, string> = {
  c: "C",
  cpp: "C++",
  java: "Java",
  python: "Python",
};

function formatDateYmd(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function highlightLang(language: string): string {
  if (language === "cpp") return "cpp";
  if (language === "c") return "c";
  if (language === "java") return "java";
  if (language === "python") return "python";
  return "text";
}

export default function FeedbackPublicPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [activeItem, setActiveItem] = useState<FeedbackItem | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [submissions, setSubmissions] = useState<PublicSubmissionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setError("缺少短码");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    feedbackApi
      .getPublic(token)
      .then((data: any) => {
        if (!cancelled) setRaw(data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "反馈不存在或已删除");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const posterData: FeedbackPosterData | null = useMemo(() => {
    if (!raw) return null;
    const items = (raw.items as FeedbackItem[]) || [];
    const lifetime = raw.lifetime as FeedbackLifetimeStats | undefined;
    const createdAt = raw.createdAt as string | undefined;
    const rangeStart = raw.rangeStart as string | null | undefined;
    const displayDate = (raw.displayDate || raw.dateLabel) as string | undefined;
    return {
      title: String(raw.title || ""),
      dateLabel:
        (displayDate && String(displayDate)) ||
        formatDateYmd(rangeStart) ||
        formatDateYmd(createdAt),
      studentName: String(raw.studentName || ""),
      studentHandle: raw.studentHandle ? String(raw.studentHandle) : undefined,
      avatarUrl: raw.avatarUrl ? String(raw.avatarUrl) : undefined,
      note: raw.note ? String(raw.note) : undefined,
      items,
      lifetime,
      brand: raw.brand ? String(raw.brand) : "威科姆编程中心",
      publicToken: raw.publicToken ? String(raw.publicToken) : undefined,
      logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
    };
  }, [raw]);

  const selected = useMemo(
    () => submissions.find((s) => s.id === selectedId) || null,
    [submissions, selectedId],
  );

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setActiveItem(null);
    setSubmissions([]);
    setSelectedId(null);
    setSubsLoading(false);
  }, []);

  const openProblemSubmissions = useCallback(
    async (item: FeedbackItem) => {
      if (!token) return;
      setActiveItem(item);
      setModalVisible(true);
      setSubsLoading(true);
      setSubmissions([]);
      setSelectedId(null);
      try {
        const res = await feedbackApi.getPublicProblemSubmissions(token, item.problemId);
        const list = res.submissions || [];
        setSubmissions(list);
        // 后端已倒序：第一条即最后一次提交
        setSelectedId(list[0]?.id ?? null);
      } catch (err: any) {
        Message.error(err?.message || "加载提交记录失败");
      } finally {
        setSubsLoading(false);
      }
    },
    [token],
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin tip="加载中…" />
      </div>
    );
  }

  if (error || !posterData) {
    return (
      <Result
        status="404"
        title="未找到反馈"
        subTitle={error || "请检查链接或短码是否正确"}
        extra={
          <Space>
            <Link to="/f">
              <Button type="primary">输入短码打开</Button>
            </Link>
            <Link to="/">
              <Button>返回首页</Button>
            </Link>
          </Space>
        }
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        width: "100%",
        padding: "0 8px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <Title heading={5} style={{ margin: "0 0 4px" }}>
          课堂学习记录
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          公开分享 · 可查看本时段提交代码
        </Text>
      </div>
      <div
        style={{
          display: "block",
          width: "100%",
          padding: 12,
          background: "var(--color-fill-1)",
          borderRadius: 16,
          boxSizing: "border-box",
        }}
      >
        {/* 公开页不固定宽度：数据概况可随屏宽自动换行 */}
        <PosterCard
          data={posterData}
          interactive
          onAvatarClick={() => {
            if (posterData.studentHandle) {
              navigate(`/profile/${encodeURIComponent(posterData.studentHandle)}`);
            }
          }}
          onItemClick={openProblemSubmissions}
        />
      </div>
      <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12, textAlign: "center" }}>
        短码 {token}
      </Paragraph>

      <Modal
        title={
          activeItem
            ? `${activeItem.slug} ${activeItem.title}`
            : "提交代码"
        }
        visible={modalVisible}
        onCancel={closeModal}
        footer={
          <Button onClick={closeModal}>关闭</Button>
        }
        style={{ width: "min(920px, 96vw)" }}
        unmountOnExit
      >
        {subsLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin tip="加载提交记录…" />
          </div>
        ) : submissions.length === 0 ? (
          <Empty description="本时段该题暂无有效提交" />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minHeight: 360,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 160,
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 8,
                background: "var(--color-fill-1)",
              }}
            >
              {submissions.map((sub, idx) => {
                const active = sub.id === selectedId;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedId(sub.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      textAlign: "left",
                      border: active
                        ? "1px solid rgb(var(--primary-6))"
                        : "1px solid transparent",
                      background: active
                        ? "rgba(var(--primary-6), 0.08)"
                        : "var(--color-bg-2)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      cursor: "pointer",
                      font: "inherit",
                      color: "inherit",
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "var(--color-text-3)", minWidth: 28 }}>
                      #{submissions.length - idx}
                    </Text>
                    <Tag color={statusColor[sub.status] || "gray"} size="small">
                      {sub.status}
                    </Tag>
                    <Text style={{ fontSize: 12 }}>
                      {langLabel[sub.language] || sub.language}
                    </Text>
                    {sub.score != null && (
                      <Text style={{ fontSize: 12 }}>{sub.score} 分</Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: "auto" }}>
                      {formatDateTime(sub.createdAt)}
                      {idx === 0 ? " · 最新" : ""}
                    </Text>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "8px 12px",
                    background: "var(--color-fill-1)",
                    borderBottom: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                >
                  <span>
                    状态{" "}
                    <Tag color={statusColor[selected.status] || "gray"} size="small">
                      {selected.status}
                    </Tag>
                  </span>
                  <span>语言 {langLabel[selected.language] || selected.language}</span>
                  {selected.score != null && <span>得分 {selected.score}</span>}
                  {selected.timeUsed != null && <span>耗时 {selected.timeUsed}ms</span>}
                  {selected.memoryUsed != null && (
                    <span>
                      内存{" "}
                      {selected.memoryUsed >= 1024
                        ? `${(selected.memoryUsed / 1024).toFixed(1)}MB`
                        : `${selected.memoryUsed}KB`}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", color: "var(--color-text-3)" }}>
                    {formatDateTime(selected.createdAt)}
                  </span>
                </div>
                <SyntaxHighlighter
                  language={highlightLang(selected.language)}
                  style={vs}
                  showLineNumbers
                  wrapLongLines
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    maxHeight: 360,
                    overflow: "auto",
                    background: "#ffffff",
                    borderRadius: 0,
                    padding: "12px 16px",
                    fontSize: 14,
                  }}
                  codeTagProps={{
                    style: {
                      fontSize: 14,
                      fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                    },
                  }}
                  lineNumberStyle={{
                    minWidth: "2.5em",
                    paddingRight: 12,
                    color: "#999",
                    userSelect: "none",
                  }}
                >
                  {selected.code || ""}
                </SyntaxHighlighter>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 手输短码入口 /f */
export function FeedbackTokenEntryPage() {
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  const go = () => {
    const t = token.trim();
    if (!t) {
      Message.warning("请输入短码");
      return;
    }
    navigate(`/f/${encodeURIComponent(t)}`);
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
      <Title heading={5}>打开学习记录</Title>
      <Paragraph type="secondary">输入海报或链接中的短码查看详情</Paragraph>
      <Space>
        <Input
          placeholder="短码"
          value={token}
          onChange={setToken}
          onPressEnter={go}
          style={{ width: 220 }}
          allowClear
        />
        <Button type="primary" onClick={go}>
          打开
        </Button>
      </Space>
    </div>
  );
}
