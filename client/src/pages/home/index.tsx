import { useState, useEffect } from "react";
import { Typography, Button, Space } from "@arco-design/web-react";
import { IconArrowRight, IconClockCircle, IconDashboard, IconNotification } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router-dom";
import { announcementApi } from "../../api/announcement";

const { Title, Paragraph } = Typography;

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

  useEffect(() => {
    announcementApi.list({ pageSize: 5 }).then((res: any) => {
      setAnnouncements(res.items);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "64px 0" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 0.8fr",
        gap: "48px",
        alignItems: "center",
        marginBottom: 64
      }}>
        <div>
          <Title heading={1} style={{ fontSize: 56, lineHeight: 1.1, marginBottom: 24 }}>
            让算法学习<br />从未如此简单
          </Title>
          <Paragraph style={{ fontSize: 18, color: "var(--color-muted)", marginBottom: 32, lineHeight: 1.6, maxWidth: 540 }}>
            ETLOJ 专注于 <strong>Easy To Learn</strong> 体验。通过 AI 智能引导解题与沉浸式算法可视化，打破枯燥的刷题模式，带你直观领悟算法精髓。
          </Paragraph>
          <Space size="large">
            <Button type="primary" size="large" style={{ padding: "0 24px", height: 48, fontSize: 16 }} onClick={() => navigate("/problems")}>
              开始刷题
            </Button>
            <Button size="large" style={{ padding: "0 24px", height: 48, fontSize: 16 }} onClick={() => navigate("/ranking")}>
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
        marginBottom: 64
      }}>
        <div style={{
          background: "var(--color-surface-soft)",
          borderRadius: "var(--rounded-xl, 16px)",
          padding: "48px 32px",
          border: "1px solid var(--color-hairline)"
        }}>
          <Title heading={3} style={{ fontSize: 24, marginBottom: 8, marginTop: 0 }}>平台实时数据</Title>
          <Paragraph style={{ color: "var(--color-muted)", fontSize: 14, marginBottom: 32 }}>
            记录每一次进步
          </Paragraph>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            {["题目总数", "提交总数", "用户总数"].map((label) => (
              <div key={label}>
                <div
                  style={{
                    width: 60,
                    height: 32,
                    borderRadius: 4,
                    background: "var(--color-hairline)",
                    animation: "skeletonPulse 1.8s ease-in-out infinite",
                  }}
                />
                <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: "var(--color-surface-soft)",
          borderRadius: "var(--rounded-xl, 16px)",
          padding: "32px",
          border: "1px solid var(--color-hairline)",
          display: "flex",
          flexDirection: "column",
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
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-primary-6)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-hairline)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                      {item.isPinned && <span style={{ color: "var(--color-warning-6)" }}>📌</span>}
                      {item.title}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--color-muted)", flexShrink: 0 }}>
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
    </div>
  );
}
