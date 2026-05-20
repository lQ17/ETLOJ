
import { Typography, Button, Tag, Space, Divider } from "@arco-design/web-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CopyButton, parseSamples } from "./utils";
import DifficultyTag from "../../../components/DifficultyTag";

interface ProblemContentProps {
  markdown: string;
  problem: any;
  codeCollapsed: boolean;
  onExpandIDE: () => void;
}

export default function ProblemContent({ markdown, problem, codeCollapsed, onExpandIDE }: ProblemContentProps) {
  const samples = parseSamples(markdown);

  const sampleRegex = /(?:^|\n)(?:##\s*输入输出样例|###\s*输入\s*#1)[\s\S]*?(?=\n##\s+(?!输入输出样例)|$)/;
  const parts = markdown.split(sampleRegex);
  const markdownBefore = parts[0]?.trim() || "";
  const markdownAfter = parts[1]?.trim() || "";

  return (
    <>
      {codeCollapsed && (
        <Button
          type="outline"
          size="mini"
          onClick={onExpandIDE}
          style={{ position: "sticky", top: 0, float: "right", zIndex: 1, marginBottom: 8 }}
        >
          打开IDE
        </Button>
      )}
      {markdownBefore && (
        <div className="problem-markdown" style={{ fontSize: 16 }}>
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              h1: ({ children }) => (
                <div style={{ marginBottom: 20 }}>
                  <Typography.Title heading={1} style={{ marginTop: 0, marginBottom: 8 }}>
                    {children}
                  </Typography.Title>
                  <Space>
                    <DifficultyTag difficulty={problem.difficulty} />
                    {problem.score != null && problem.score > 0 && (
                      <Tag color="purple" size="small">{problem.score}分</Tag>
                    )}
                    <span style={{ color: "var(--color-text-3)", fontSize: 14 }}>
                      时间限制: {problem.timeLimit}ms | 内存限制: {problem.memoryLimit}MB
                    </span>
                  </Space>
                  <Divider style={{ margin: "16px 0" }} />
                </div>
              )
            }}
          >
            {markdownBefore}
          </ReactMarkdown>
        </div>
      )}

      {/* 样例横排展示 */}
      {samples.length > 0 && (
        <div style={{ marginTop: 24 }} className="problem-markdown">
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>输入输出样例</h2>
          {samples.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                background: "var(--color-fill-1)",
                borderRadius: 6,
                padding: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-2)", fontSize: 14 }}>输入 #{i + 1}</span>
                  <CopyButton text={s.input} />
                </div>
                <pre style={{
                  background: "var(--color-bg-2)",
                  borderRadius: 4,
                  padding: "10px 14px",
                  margin: 0,
                  fontSize: 14,
                  fontFamily: "Consolas, monospace",
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                  maxHeight: 200,
                }}>{s.input}</pre>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-2)", fontSize: 14 }}>输出 #{i + 1}</span>
                  <CopyButton text={s.output} />
                </div>
                <pre style={{
                  background: "var(--color-bg-2)",
                  borderRadius: 4,
                  padding: "10px 14px",
                  margin: 0,
                  fontSize: 14,
                  fontFamily: "Consolas, monospace",
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                  maxHeight: 200,
                }}>{s.output}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 样例之后的 Markdown（如 说明/提示） */}
      {markdownAfter && (
        <div className="problem-markdown" style={{ fontSize: 16, marginTop: 24 }}>
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {markdownAfter}
          </ReactMarkdown>
        </div>
      )}
    </>
  );
}
