import { Typography, Button, Space } from "@arco-design/web-react";
import { IconArrowRight, IconClockCircle, IconDashboard } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router-dom";

const { Title, Paragraph } = Typography;

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "64px 0" }}>
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
        background: "var(--color-surface-soft)",
        borderRadius: "var(--rounded-xl, 16px)",
        padding: "64px 32px",
        textAlign: "center",
        border: "1px solid var(--color-hairline)"
      }}>
        <Title heading={2} style={{ fontSize: 36, marginBottom: 24 }}>平台实时数据</Title>
        <Paragraph style={{ maxWidth: 600, margin: "0 auto 48px", color: "var(--color-muted)", fontSize: 16 }}>
          基于分布式评测集群，为竞赛者提供极速反馈
        </Paragraph>
        <div style={{ display: "flex", justifyContent: "center", gap: 96, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 48, fontWeight: 600, color: "var(--color-ink)", letterSpacing: "-0.04em" }}>0</div>
            <div style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8 }}>题目总数</div>
          </div>
          <div>
            <div style={{ fontSize: 48, fontWeight: 600, color: "var(--color-ink)", letterSpacing: "-0.04em" }}>0</div>
            <div style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8 }}>提交总数</div>
          </div>
          <div>
            <div style={{ fontSize: 48, fontWeight: 600, color: "var(--color-ink)", letterSpacing: "-0.04em" }}>0</div>
            <div style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8 }}>用户总数</div>
          </div>
        </div>
      </div>
    </div>
  );
}
