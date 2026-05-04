import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Typography, Select, Button, Space, Tag, Spin, Message, Card, Input, Divider, Modal,
} from "@arco-design/web-react";
import { IconCopy, IconCheck, IconPlayArrow, IconExpand, IconShrink } from "@arco-design/web-react/icon";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { problemApi } from "../../api/problem";
import { submissionApi } from "../../api/submission";

const langMap: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  java: "java",
  python: "python",
};

const difficultyLabel: Record<string, string> = {
  EASY: "简单", MEDIUM: "中等", HARD: "困难",
};
const difficultyColor: Record<string, string> = {
  EASY: "green", MEDIUM: "orange", HARD: "red",
};

const statusLabel: Record<string, string> = {
  PENDING: "等待中",
  JUDGING: "判题中",
  AC: "通过",
  WA: "答案错误",
  TLE: "超时",
  MLE: "内存超限",
  RE: "运行错误",
  CE: "编译错误",
  SE: "系统错误",
};
const statusColor: Record<string, string> = {
  PENDING: "gray", JUDGING: "blue", AC: "green",
  WA: "red", TLE: "orange", MLE: "orange",
  RE: "red", CE: "orange", SE: "red",
};

const defaultCode: Record<string, string> = {
  c: `#include <stdio.h>\n\nint main() {\n    // your code here\n    return 0;\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        // your code here\n    }\n}\n`,
  python: `# your code here\n`,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      Message.success("复制成功");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button
      type="secondary"
      size="mini"
      icon={copied ? <IconCheck /> : <IconCopy />}
      onClick={handleCopy}
      style={{ 
        fontSize: 12, 
        height: 24, 
        padding: "0 8px",
        borderRadius: 4,
      }}
    >
      {copied ? "已复制" : "复制"}
    </Button>
  );
}

function parseSamples(md: string): { input: string; output: string }[] {
  const samples: { input: string; output: string }[] = [];
  // Match ### 输入 #N ... ### 输出 #N pattern
  const inputRegex = /###\s*输入\s*#\d+[\s\S]*?```[a-zA-Z0-9]*(?:\r?\n)([\s\S]*?)```/g;
  const outputRegex = /###\s*输出\s*#\d+[\s\S]*?```[a-zA-Z0-9]*(?:\r?\n)([\s\S]*?)```/g;

  const inputs: string[] = [];
  const outputs: string[] = [];

  let m;
  while ((m = inputRegex.exec(md)) !== null) {
    inputs.push(m[1].trimEnd());
  }
  while ((m = outputRegex.exec(md)) !== null) {
    outputs.push(m[1].trimEnd());
  }

  const len = Math.min(inputs.length, outputs.length);
  for (let i = 0; i < len; i++) {
    samples.push({ input: inputs[i], output: outputs[i] });
  }
  return samples;
}

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [problem, setProblem] = useState<any>(null);
  const [markdown, setMarkdown] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState(defaultCode.cpp);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [actualOutput, setActualOutput] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p: any = await problemApi.getOne(id);
        setProblem(p);
        setMarkdown(p.markdown || "");
      } catch {
        Message.error("加载题目失败");
      }
    })();
  }, [id]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(defaultCode[lang] || "");
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      Message.warning("请先编写代码");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res: any = await submissionApi.create({
        problemId: problem.id,
        code,
        language,
      });
      Message.success("提交成功，等待判题结果");
      pollResult(res.id);
    } catch (err: any) {
      Message.error(err?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!code.trim()) {
      Message.warning("请先编写代码");
      return;
    }
    setTesting(true);
    setActualOutput("");
    try {
      const res: any = await submissionApi.run({
        problemId: problem.id,
        code,
        language,
        input: testInput,
      });
      if (res.status === "CE") {
        setActualOutput(`[编译错误]\n${res.stderr}`);
      } else if (res.status === "RE") {
        setActualOutput(`[运行错误]\n${res.stderr || res.stdout}`);
      } else if (res.status === "TLE") {
        setActualOutput("[超时]");
      } else if (res.status === "SE") {
        setActualOutput(`[系统错误]\n${res.stderr}`);
      } else {
        setActualOutput(res.stdout || "");
      }
    } catch (err: any) {
      setActualOutput(`[请求失败] ${err?.message || "未知错误"}`);
    } finally {
      setTesting(false);
    }
  };

  const pollResult = (submissionId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const sub: any = await submissionApi.getOne(submissionId);
        setResult(sub);
        if (sub.status !== "PENDING" && sub.status !== "JUDGING") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // ignore
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!problem) {
    return <div style={{ textAlign: "center", paddingTop: 80 }}><Spin /></div>;
  }

  const samples = parseSamples(markdown);

  const sampleRegex = /(?:^|\n)(?:##\s*输入输出样例|###\s*输入\s*#1)[\s\S]*?(?=\n##\s+(?!输入输出样例)|$)/;
  const parts = markdown.split(sampleRegex);
  const markdownBefore = parts[0]?.trim() || "";
  const markdownAfter = parts[1]?.trim() || "";

  return (
    <div style={{ display: "flex", gap: 24, height: "calc(100vh - 140px)", fontSize: 16 }}>
      {/* 左侧：题面 */}
      <div style={{ flex: "0 0 60%", overflow: "auto", paddingRight: 8 }}>
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
                      <Tag color={difficultyColor[problem.difficulty]}>
                        {difficultyLabel[problem.difficulty]}
                      </Tag>
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
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>样例</h2>
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
      </div>

      {/* 右侧：代码编辑器 + 测试区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Card size="small" style={{ marginBottom: 12 }}>
          <Space>
            <Select value={language} onChange={handleLanguageChange} style={{ width: 120 }}>
              <Select.Option value="c">C</Select.Option>
              <Select.Option value="cpp">C++</Select.Option>
              <Select.Option value="java">Java</Select.Option>
              <Select.Option value="python">Python</Select.Option>
            </Select>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              提交
            </Button>
          </Space>
        </Card>

        {/* 代码编辑器 */}
        <div style={{ flex: 2, border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden", minHeight: 0 }}>
          <Editor
            height="100%"
            language={langMap[language]}
            value={code}
            onChange={(v) => setCode(v || "")}
            theme="vs"
            options={{
              fontSize: 16,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
            }}
          />
        </div>

        {/* 输入输出测试区 */}
        <div style={{ position: "relative", marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <Button
              type="text"
              size="mini"
              icon={<IconExpand />}
              onClick={() => setIsModalVisible(true)}
              style={{ color: "var(--color-text-3)" }}
            >
              展开
            </Button>
          </div>
          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 120 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: 4 }}>
              自测输入
            </span>
            <Input.TextArea
              value={testInput}
              onChange={setTestInput}
              placeholder="输入测试数据..."
              style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14 }}
            />
            <Button
              type="primary"
              status="success"
              icon={<IconPlayArrow />}
              onClick={handleTest}
              loading={testing}
              style={{ marginTop: 8 }}
              long
            >
              测试运行
            </Button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: 4 }}>
              期望输出
            </span>
            <Input.TextArea
              value={testOutput}
              onChange={setTestOutput}
              placeholder="填写期望输出以便对比..."
              style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14 }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: 4 }}>
              实际输出
            </span>
            <Input.TextArea
              value={actualOutput}
              placeholder="点击“测试运行”后显示结果..."
              readOnly
              style={{
                flex: 1,
                resize: "none",
                fontFamily: "Consolas, monospace",
                fontSize: 14,
                background: "var(--color-fill-2)",
                color: actualOutput.startsWith("[") ? "rgb(var(--danger-6))" : undefined,
              }}
            />
          </div>
        </div>
      </div>

      {/* 判题结果 */}
      {result && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Space>
            <Tag color={statusColor[result.status]} style={{ fontSize: 14 }}>
              {statusLabel[result.status] || result.status}
            </Tag>
            {result.score != null && (
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {result.score}分
              </span>
            )}
            {result.timeUsed != null && (
              <span style={{ color: "var(--color-text-3)", fontSize: 13 }}>
                {result.timeUsed}ms / {result.memoryUsed}KB
              </span>
            )}
          </Space>
        </Card>
      )}

      <Modal
        title="测试运行详情"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width="80%"
        style={{ width: '80%', top: '20px' }}
        closeIcon={<IconShrink />}
      >
        <div style={{ display: "flex", gap: 32, minHeight: 400, padding: "10px 0" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: 8 }}>
              自测输入
            </span>
            <Input.TextArea
              value={testInput}
              onChange={setTestInput}
              placeholder="输入测试数据..."
              style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14 }}
            />
            <Button
              type="primary"
              status="success"
              icon={<IconPlayArrow />}
              onClick={handleTest}
              loading={testing}
              style={{ marginTop: 12 }}
              long
            >
              测试运行
            </Button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: 8 }}>
              期望输出
            </span>
            <Input.TextArea
              value={testOutput}
              onChange={setTestOutput}
              placeholder="填写期望输出以便对比..."
              style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14 }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: 8 }}>
              实际输出
            </span>
            <Input.TextArea
              value={actualOutput}
              placeholder="点击“测试运行”后显示结果..."
              readOnly
              style={{
                flex: 1,
                resize: "none",
                fontFamily: "Consolas, monospace",
                fontSize: 14,
                background: "var(--color-fill-2)",
                color: actualOutput.startsWith("[") ? "rgb(var(--danger-6))" : undefined,
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  </div>
);
}
