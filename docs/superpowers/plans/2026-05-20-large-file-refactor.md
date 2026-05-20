# Large File Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split 4 oversized files (549-1031 lines) into smaller, focused components for better readability and maintainability.

**Architecture:** Each page gets a sub-directory with extracted sub-components. Parent files become thin orchestrators. Backend `AiService` splits into 3 focused services with a facade. All external APIs and imports remain unchanged.

**Tech Stack:** React 18, NestJS, Arco Design, Monaco Editor, Prisma 5, Redis

---

## Task 1: `detail.tsx` (1031 lines) → `detail/` directory

**Files:**
- Create: `client/src/pages/problems/detail/constants.ts`
- Create: `client/src/pages/problems/detail/utils.ts`
- Create: `client/src/pages/problems/detail/ProblemContent.tsx`
- Create: `client/src/pages/problems/detail/CodeEditorPanel.tsx`
- Create: `client/src/pages/problems/detail/TestArea.tsx`
- Create: `client/src/pages/problems/detail/SolutionsTab.tsx`
- Modify: `client/src/pages/problems/detail.tsx` → move to `client/src/pages/problems/detail/index.tsx`
- Modify: `client/src/App.tsx:9` (update import path)

### Step 1.1: Create `constants.ts`

```typescript
// client/src/pages/problems/detail/constants.ts

export const langMap: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  java: "java",
  python: "python",
};

export const statusLabel: Record<string, string> = {
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

export const statusColor: Record<string, string> = {
  PENDING: "gray", JUDGING: "blue", AC: "green",
  WA: "red", TLE: "orange", MLE: "orange",
  RE: "red", CE: "orange", SE: "red",
};

export const defaultCode: Record<string, string> = {
  c: "",
  cpp: "",
  java: "",
  python: "",
};
```

### Step 1.2: Create `utils.ts`

Extract `CopyButton` and `parseSamples` from detail.tsx lines 56-106.

```typescript
// client/src/pages/problems/detail/utils.ts
import { useState } from "react";
import { Button, Message } from "@arco-design/web-react";
import { IconCopy, IconCheck } from "@arco-design/web-react/icon";

export function CopyButton({ text }: { text: string }) {
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
      style={{ fontSize: 12, height: 24, padding: "0 8px", borderRadius: 4 }}
    >
      {copied ? "已复制" : "复制"}
    </Button>
  );
}

export function parseSamples(md: string): { input: string; output: string }[] {
  const samples: { input: string; output: string }[] = [];
  const inputRegex = /###\s*输入\s*#\d+[\s\S]*?```[a-zA-Z0-9]*(?:\r?\n)([\s\S]*?)```/g;
  const outputRegex = /###\s*输出\s*#\d+[\s\S]*?```[a-zA-Z0-9]*(?:\r?\n)([\s\S]*?)```/g;

  const inputs: string[] = [];
  const outputs: string[] = [];

  let m;
  while ((m = inputRegex.exec(md)) !== null) inputs.push(m[1].trimEnd());
  while ((m = outputRegex.exec(md)) !== null) outputs.push(m[1].trimEnd());

  const len = Math.min(inputs.length, outputs.length);
  for (let i = 0; i < len; i++) samples.push({ input: inputs[i], output: outputs[i] });
  return samples;
}
```

### Step 1.3: Create `ProblemContent.tsx`

Extract detail.tsx lines 452-563 (problem body rendering: markdown + samples + markdownAfter).

Props: `markdown: string`, `problem: any`, `codeCollapsed: boolean`, `onExpandIDE: () => void`

```typescript
// client/src/pages/problems/detail/ProblemContent.tsx
import { Typography, Space, Tag, Divider, Button } from "@arco-design/web-react";
import { IconExpand } from "@arco-design/web-react/icon";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import DifficultyTag from "../../../components/DifficultyTag";
import { CopyButton, parseSamples } from "./utils";

interface Props {
  markdown: string;
  problem: any;
  codeCollapsed: boolean;
  onExpandIDE: () => void;
}

export default function ProblemContent({ markdown, problem, codeCollapsed, onExpandIDE }: Props) {
  const samples = parseSamples(markdown);
  const sampleRegex = /(?:^|\n)(?:##\s*输入输出样例|###\s*输入\s*#1)[\s\S]*?(?=\n##\s+(?!输入输出样例)|$)/;
  const parts = markdown.split(sampleRegex);
  const markdownBefore = parts[0]?.trim() || "";
  const markdownAfter = parts[1]?.trim() || "";

  return (
    <div style={{ display: "block", flex: 1, overflow: "auto" }}>
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

      {samples.length > 0 && (
        <div style={{ marginTop: 24 }} className="problem-markdown">
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>输入输出样例</h2>
          {samples.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex", gap: 16, marginBottom: 16,
                background: "var(--color-fill-1)", borderRadius: 6, padding: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-2)", fontSize: 14 }}>输入 #{i + 1}</span>
                  <CopyButton text={s.input} />
                </div>
                <pre style={{ background: "var(--color-bg-2)", borderRadius: 4, padding: "10px 14px", margin: 0, fontSize: 14, fontFamily: "Consolas, monospace", whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 200 }}>{s.input}</pre>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-2)", fontSize: 14 }}>输出 #{i + 1}</span>
                  <CopyButton text={s.output} />
                </div>
                <pre style={{ background: "var(--color-bg-2)", borderRadius: 4, padding: "10px 14px", margin: 0, fontSize: 14, fontFamily: "Consolas, monospace", whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 200 }}>{s.output}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {markdownAfter && (
        <div className="problem-markdown" style={{ fontSize: 16, marginTop: 24 }}>
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {markdownAfter}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

### Step 1.4: Create `TestArea.tsx`

Extract the duplicated test area (detail.tsx lines 746-811 inline + 813-874 modal). Both share the same 3-column layout — merge into one component with `mode: "inline" | "modal"`.

Props: `testInput`, `setTestInput`, `testOutput`, `setTestOutput`, `actualOutput`, `testing`, `onTest`, `isModalVisible`, `setIsModalVisible`

```typescript
// client/src/pages/problems/detail/TestArea.tsx
import { Button, Input, Modal, Space } from "@arco-design/web-react";
import { IconPlayArrow, IconExpand, IconShrink } from "@arco-design/web-react/icon";

interface Props {
  testInput: string;
  setTestInput: (v: string) => void;
  testOutput: string;
  setTestOutput: (v: string) => void;
  actualOutput: string;
  testing: boolean;
  onTest: () => void;
  isModalVisible: boolean;
  setIsModalVisible: (v: boolean) => void;
}

function TestColumns({ testInput, setTestInput, testOutput, setTestOutput, actualOutput, testing, onTest, compact }: {
  testInput: string; setTestInput: (v: string) => void;
  testOutput: string; setTestOutput: (v: string) => void;
  actualOutput: string; testing: boolean; onTest: () => void; compact: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: compact ? 12 : 32, flex: 1, minHeight: compact ? 120 : 400, padding: compact ? 0 : "10px 0" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: compact ? 4 : 8 }}>自测输入</span>
        <Input.TextArea value={testInput} onChange={setTestInput} placeholder="输入测试数据..." style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14 }} />
        <Button type="primary" status="success" icon={<IconPlayArrow />} onClick={onTest} loading={testing} style={{ marginTop: compact ? 8 : 12 }} long>测试运行</Button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: compact ? 4 : 8 }}>期望输出</span>
        <Input.TextArea value={testOutput} onChange={setTestOutput} placeholder="填写期望输出以便对比..." style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14 }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: compact ? 4 : 8 }}>实际输出</span>
        <Input.TextArea value={actualOutput} placeholder='点击"测试运行"后显示结果...' readOnly style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14, background: "var(--color-fill-2)", color: actualOutput.startsWith("[") ? "var(--color-error)" : undefined }} />
      </div>
    </div>
  );
}

export default function TestArea(props: Props) {
  const { isModalVisible, setIsModalVisible } = props;
  return (
    <div style={{ position: "relative", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <Button type="text" size="mini" icon={<IconExpand />} onClick={() => setIsModalVisible(true)} style={{ color: "var(--color-text-3)" }}>展开</Button>
      </div>
      <TestColumns {...props} compact />

      <Modal title="测试运行详情" visible={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null} style={{ width: '80%', top: '20px' }} closeIcon={<IconShrink />}>
        <TestColumns {...props} compact={false} />
      </Modal>
    </div>
  );
}
```

### Step 1.5: Create `CodeEditorPanel.tsx`

Extract detail.tsx lines 598-811 (right panel: toolbar + editor + test area). This component includes the toolbar card, Monaco editor, and test area.

Props: `code`, `setCode`, `language`, `setLanguage`, `problem`, `user`, `result`, `submitting`, `onSubmit`, `testing`, `testInput`, `setTestInput`, `testOutput`, `setTestOutput`, `actualOutput`, `onTest`, `isModalVisible`, `setIsModalVisible`, `codeCollapsed`, `onCollapse`, editor settings (fontSize, tabSize, theme, codeCompletion + their setters)

```typescript
// client/src/pages/problems/detail/CodeEditorPanel.tsx
import { useRef } from "react";
import { Select, Button, Space, Tag, Card, Popover, Radio } from "@arco-design/web-react";
import { IconSettings } from "@arco-design/web-react/icon";
import Editor from "@monaco-editor/react";
import { Message } from "@arco-design/web-react";
import { langMap, statusLabel, statusColor } from "./constants";
import TestArea from "./TestArea";

interface Props {
  code: string;
  setCode: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  problem: any;
  user: any;
  result: any;
  submitting: boolean;
  onSubmit: () => void;
  testing: boolean;
  testInput: string;
  setTestInput: (v: string) => void;
  testOutput: string;
  setTestOutput: (v: string) => void;
  actualOutput: string;
  onTest: () => void;
  isModalVisible: boolean;
  setIsModalVisible: (v: boolean) => void;
  codeCollapsed: boolean;
  onCollapse: () => void;
  editorFontSize: number;
  setEditorFontSize: (v: number) => void;
  editorTabSize: number;
  setEditorTabSize: (v: number) => void;
  editorTheme: string;
  setEditorTheme: (v: string) => void;
  codeCompletion: boolean;
  setCodeCompletion: (v: boolean) => void;
}

export default function CodeEditorPanel(props: Props) {
  const {
    code, setCode, language, setLanguage, problem, user, result, submitting, onSubmit,
    codeCollapsed, onCollapse,
    editorFontSize, setEditorFontSize, editorTabSize, setEditorTabSize,
    editorTheme, setEditorTheme, codeCompletion, setCodeCompletion,
    ...testProps
  } = props;

  const editorRef = useRef<any>(null);

  return (
    <div style={{
      flex: codeCollapsed ? "0 0 0px" : 1,
      display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
      opacity: codeCollapsed ? 0 : 1, pointerEvents: codeCollapsed ? "none" : "auto",
      transition: "flex 0.3s ease, opacity 0.3s ease",
    }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Select value={language} onChange={setLanguage} style={{ width: 120 }}>
            <Select.Option value="c">C</Select.Option>
            <Select.Option value="cpp">C++</Select.Option>
            <Select.Option value="java">Java</Select.Option>
            <Select.Option value="python">Python</Select.Option>
          </Select>
          <Button type="primary" onClick={onSubmit} loading={submitting} disabled={submitting}>提交</Button>
          {result && (
            <Space size="small">
              <Tag color={statusColor[result.status]} style={{ fontSize: 13 }}>{statusLabel[result.status] || result.status}</Tag>
              {result.score != null && <span style={{ fontWeight: 600, fontSize: 13 }}>{result.score}分</span>}
              {result.timeUsed != null && <span style={{ color: "var(--color-text-3)", fontSize: 12 }}>{result.timeUsed}ms / {result.memoryUsed}KB</span>}
            </Space>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="mini" onClick={onCollapse}>收起IDE</Button>
            <Popover trigger="click" position="br" content={
              <div style={{ width: 200 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>字体大小</div>
                  <Select value={editorFontSize} onChange={(v) => { setEditorFontSize(v); localStorage.setItem("oj_editor_fontSize", String(v)); }} style={{ width: "100%" }} size="small">
                    {[12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((s) => <Select.Option key={s} value={s}>{s}px</Select.Option>)}
                  </Select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>Tab 大小</div>
                  <Select value={editorTabSize} onChange={(v) => { setEditorTabSize(v); localStorage.setItem("oj_editor_tabSize", String(v)); }} style={{ width: "100%" }} size="small">
                    {[2, 4, 8].map((s) => <Select.Option key={s} value={s}>{s} 个空格</Select.Option>)}
                  </Select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>编辑器主题</div>
                  <Radio.Group value={editorTheme} onChange={(v) => { setEditorTheme(v); localStorage.setItem("oj_editor_theme", v); }} size="small">
                    <Radio value="vs">亮色</Radio>
                    <Radio value="vs-dark">暗色</Radio>
                    <Radio value="hc-black">跟随网站</Radio>
                  </Radio.Group>
                </div>
                <div>
                  <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>代码补全</div>
                  <Radio.Group value={codeCompletion} onChange={(v) => { setCodeCompletion(v); localStorage.setItem("oj_editor_codeCompletion", String(v)); }} size="small">
                    <Radio value={false}>关闭</Radio>
                    <Radio value={true}>开启</Radio>
                  </Radio.Group>
                </div>
              </div>
            }>
              <Button type="text" size="mini" icon={<IconSettings />} style={{ color: "var(--color-text-3)" }} />
            </Popover>
          </div>
        </div>
      </Card>

      <div style={{ flex: 2, border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden", minHeight: 0 }}>
        <Editor
          height="100%"
          language={langMap[language]}
          value={code}
          onChange={(v) => setCode(v || "")}
          theme={editorTheme}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              if (!problem) return;
              const codeValue = editor.getValue();
              if (codeValue.length > 1024 * 1024) { Message.warning("代码过大，无法保存到浏览器本地"); return; }
              const uid = user?.id || "anon";
              localStorage.setItem(`oj_code_${problem.id}_${uid}`, codeValue);
              Message.success("代码已保存到浏览器本地");
            });
          }}
          options={{
            fontSize: editorFontSize, minimap: { enabled: false }, scrollBeyondLastLine: false,
            automaticLayout: true, tabSize: editorTabSize,
            quickSuggestions: codeCompletion, suggestOnTriggerCharacters: codeCompletion, wordBasedSuggestions: codeCompletion,
          }}
        />
      </div>

      <TestArea {...testProps} />
    </div>
  );
}
```

### Step 1.6: Create `SolutionsTab.tsx`

Extract detail.tsx lines 880-1027 (solutions list + detail + write modal). This is entirely self-contained.

Props: `user`, `authLoading`, `problemId`, `navigate`

```typescript
// client/src/pages/problems/detail/SolutionsTab.tsx
import { useState, useEffect } from "react";
import { Typography, Button, Space, Card, Spin, Avatar, Tag, Modal } from "@arco-design/web-react";
import { IconPen } from "@arco-design/web-react/icon";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import MDEditor from "@uiw/react-md-editor";
import { solutionApi } from "../../../api/solution";

interface Props {
  user: any;
  authLoading: boolean;
  problemId: number;
  navigate: (path: string) => void;
  editId?: string | null;
  onEditHandled?: () => void;
}

export default function SolutionsTab({ user, authLoading, problemId, navigate, editId, onEditHandled }: Props) {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [solutionsLoading, setSolutionsLoading] = useState(false);
  const [selectedSolution, setSelectedSolution] = useState<any>(null);
  const [solutionContent, setSolutionContent] = useState("");
  const [submittingSolution, setSubmittingSolution] = useState(false);
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [editingSolutionId, setEditingSolutionId] = useState<number | null>(null);

  const loadSolutions = async () => {
    setSolutionsLoading(true);
    try {
      const data: any = await solutionApi.list(problemId);
      setSolutions(data);
      if (data.length > 0 && !selectedSolution) setSelectedSolution(data[0]);
    } catch { /* ignore */ } finally { setSolutionsLoading(false); }
  };

  useEffect(() => { if (problemId) loadSolutions(); }, [problemId]);

  useEffect(() => {
    if (!editId) return;
    solutionApi.getOne(Number(editId)).then((sol: any) => {
      setEditingSolutionId(sol.id);
      setSolutionContent(sol.content);
      setWriteModalVisible(true);
    }).catch(() => {}).finally(() => { onEditHandled?.(); });
  }, [editId]);

  const handleSubmitSolution = async () => {
    if (!solutionContent.trim()) return;
    setSubmittingSolution(true);
    try {
      if (editingSolutionId) {
        await solutionApi.update(editingSolutionId, solutionContent);
      } else {
        await solutionApi.create({ problemId, content: solutionContent });
      }
      setSolutionContent("");
      setEditingSolutionId(null);
      setWriteModalVisible(false);
      loadSolutions();
    } catch { /* ignore */ } finally { setSubmittingSolution(false); }
  };

  // Not logged in
  if (!authLoading && !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <Typography.Title heading={5} style={{ marginBottom: 8 }}>查看题解</Typography.Title>
          <Typography.Paragraph style={{ color: "var(--color-muted)", marginBottom: 24 }}>登录后即可查看和编写题解</Typography.Paragraph>
          <Button type="primary" size="large" onClick={() => navigate("/login")}>去登录</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 24, width: "100%", overflow: "hidden" }}>
        {/* Left: solution list */}
        <div style={{ flex: "0 0 35%", overflow: "auto", paddingRight: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Typography.Title heading={5} style={{ margin: 0 }}>题解列表</Typography.Title>
            <Button type="primary" size="small" icon={<IconPen />} onClick={() => { setEditingSolutionId(null); setSolutionContent(""); setWriteModalVisible(true); }}>写题解</Button>
          </div>
          {solutionsLoading ? <div style={{ textAlign: "center", paddingTop: 40 }}><Spin /></div>
           : solutions.length === 0 ? <div style={{ textAlign: "center", color: "var(--color-text-3)", paddingTop: 40 }}>暂无题解，快来写第一篇吧</div>
           : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {solutions.map((sol: any) => (
                <Card key={sol.id} size="small" hoverable style={{ cursor: "pointer", borderLeft: selectedSolution?.id === sol.id ? "3px solid var(--color-primary)" : "3px solid transparent", background: selectedSolution?.id === sol.id ? "var(--color-fill-1)" : undefined }} onClick={() => setSelectedSolution(sol)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Avatar size={24} style={{ backgroundColor: "var(--color-primary)", flexShrink: 0 }}>
                      {sol.author.avatar ? <img src={sol.author.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : sol.author.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{sol.author.username}</span>
                    <span style={{ color: "var(--color-text-3)", fontSize: 12, marginLeft: "auto" }}>{new Date(sol.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sol.content.replace(/[#*`>\-\[\]()]/g, "").split("\n").find((l: string) => l.trim()) || ""}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-text-3)", flexShrink: 0 }}>点击在右侧查看</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right: solution detail */}
        <div style={{ flex: 1, overflow: "auto", minWidth: 0, borderLeft: "1px solid var(--color-border)", paddingLeft: 24 }}>
          {selectedSolution ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--color-border)" }}>
                <Avatar size={36} style={{ backgroundColor: "var(--color-primary)" }}>
                  {selectedSolution.author.avatar ? <img src={selectedSolution.author.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : selectedSolution.author.username?.[0]?.toUpperCase()}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSolution.author.username}</div>
                  <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>发布于 {new Date(selectedSolution.createdAt).toLocaleString("zh-CN")}</div>
                </div>
              </div>
              <div className="problem-markdown" style={{ fontSize: 15, lineHeight: 1.8 }}>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedSolution.content}</ReactMarkdown>
              </div>
            </>
          ) : <div style={{ textAlign: "center", color: "var(--color-text-3)", paddingTop: 80 }}>请选择一篇题解查看</div>}
        </div>
      </div>

      <Modal title={editingSolutionId ? "编辑题解" : "写题解"} visible={writeModalVisible} onCancel={() => { setWriteModalVisible(false); setEditingSolutionId(null); }} footer={null} style={{ width: "80%", top: 40 }} unmountOnExit={false}>
        <div data-color-mode="light" style={{ marginBottom: 12 }}>
          <MDEditor value={solutionContent} onChange={(val) => setSolutionContent(val || "")} preview="live" height={500} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button onClick={() => { setWriteModalVisible(false); setEditingSolutionId(null); }}>取消</Button>
          <Button type="primary" loading={submittingSolution} onClick={handleSubmitSolution}>{editingSolutionId ? "更新题解" : "发布题解"}</Button>
        </div>
      </Modal>
    </>
  );
}
```

### Step 1.7: Create `detail/index.tsx` — the main orchestrator

Move the original `detail.tsx` content here, replacing all extracted sections with component imports. This file becomes the thin orchestrator (~200 lines) managing:
- Tab state (`activeTab`)
- Problem data fetching
- Code/language state
- Submission polling
- Editor settings state
- Layout (left nav + content area)

```typescript
// client/src/pages/problems/detail/index.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button, Spin, Message } from "@arco-design/web-react";
import { IconFile, IconEdit, IconRobot, IconLeft } from "@arco-design/web-react/icon";
import confetti from "canvas-confetti";
import { problemApi } from "../../../api/problem";
import { submissionApi } from "../../../api/submission";
import { useAuthStore } from "../../../stores/auth";
import { defaultCode } from "./constants";
import ProblemContent from "./ProblemContent";
import CodeEditorPanel from "./CodeEditorPanel";
import SolutionsTab from "./SolutionsTab";
import ChatPanel from "../../../components/ChatPanel";
import { Typography } from "@arco-design/web-react";

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const backToListParams = (location.state as any)?.listParams as string | undefined;
  const { user } = useAuthStore();
  const authLoading = useAuthStore((s) => s.loading);

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
  const [codeCollapsed, setCodeCollapsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const submitTimesRef = useRef<number[]>([]);

  const [editorFontSize, setEditorFontSize] = useState(() => { const s = localStorage.getItem("oj_editor_fontSize"); return s ? Number(s) : 16; });
  const [editorTabSize, setEditorTabSize] = useState(() => { const s = localStorage.getItem("oj_editor_tabSize"); return s ? Number(s) : 4; });
  const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem("oj_editor_theme") || "vs");
  const [codeCompletion, setCodeCompletion] = useState(() => localStorage.getItem("oj_editor_codeCompletion") === "true");

  const [activeTab, setActiveTab] = useState<"detail" | "solutions" | "ai">(() => {
    const tab = searchParams.get("tab");
    return tab === "solutions" || tab === "ai" ? tab : "detail";
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p: any = await problemApi.getOne(id);
        setProblem(p);
        setMarkdown(p.markdown || "");
        const uid = user?.id || "anon";
        const saved = localStorage.getItem(`oj_code_${p.id}_${uid}`);
        if (saved != null) setCode(saved);
      } catch { Message.error("加载题目失败"); }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!user) { Message.warning("请先登录后再提交"); navigate("/login"); return; }
    if (!code.trim()) { Message.warning("请先编写代码"); return; }
    const now = Date.now();
    submitTimesRef.current = submitTimesRef.current.filter((t) => now - t < 60000);
    if (submitTimesRef.current.length >= 3) {
      const waitSec = Math.ceil((60000 - (now - submitTimesRef.current[0])) / 1000);
      Message.warning(`提交过于频繁，请 ${waitSec} 秒后再试`);
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res: any = await submissionApi.create({ problemId: problem.id, code, language });
      submitTimesRef.current.push(Date.now());
      pollResult(res.id);
    } catch (err: any) { Message.error(err?.message || "提交失败"); setSubmitting(false); }
  };

  const handleTest = async () => {
    if (!user) { Message.warning("请先登录后再测试"); navigate("/login"); return; }
    if (!code.trim()) { Message.warning("请先编写代码"); return; }
    setTesting(true);
    setActualOutput("");
    try {
      const res: any = await submissionApi.run({ problemId: problem.id, code, language, input: testInput });
      if (res.status === "CE") setActualOutput(`[编译错误]\n${res.stderr}`);
      else if (res.status === "RE") setActualOutput(`[运行错误]\n${res.stderr || res.stdout}`);
      else if (res.status === "TLE") setActualOutput("[超时]");
      else if (res.status === "SE") setActualOutput(`[系统错误]\n${res.stderr}`);
      else setActualOutput(res.stdout || "");
    } catch (err: any) { setActualOutput(`[请求失败] ${err?.message || "未知错误"}`); } finally { setTesting(false); }
  };

  const pollResult = (submissionId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const sub: any = await submissionApi.getOne(submissionId);
        setResult(sub);
        if (sub.status !== "PENDING" && sub.status !== "JUDGING") {
          if (pollRef.current) clearInterval(pollRef.current);
          setSubmitting(false);
        }
      } catch { /* ignore */ }
    }, 1500);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { if (result?.status === "AC" && problem) { const uid = user?.id || "anon"; localStorage.removeItem(`oj_code_${problem.id}_${uid}`); } }, [result?.status]);
  useEffect(() => {
    if (result?.status === "AC" && result?.score === 100) {
      const scale = window.innerWidth / 1536;
      const count = Math.round(100 * scale);
      const spread = Math.round(55 * scale);
      confetti({ particleCount: count, angle: 60, spread, origin: { x: 0, y: 0.6 } });
      confetti({ particleCount: count, angle: 120, spread, origin: { x: 1, y: 0.6 } });
    }
  }, [result?.score, result?.status]);

  if (!problem) return <div style={{ textAlign: "center", paddingTop: 80 }}><Spin /></div>;

  const navItems = [
    { key: "detail" as const, icon: <IconFile />, label: "题目详情" },
    { key: "solutions" as const, icon: <IconEdit />, label: "查看题解" },
    { key: "ai" as const, icon: <IconRobot />, label: "问问AI" },
  ];

  const editId = searchParams.get("edit");
  const handleEditHandled = () => {
    searchParams.delete("edit");
    navigate(`/problems/${id}?${searchParams.toString()}`, { replace: true });
  };

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 140px)", fontSize: 16 }}>
      {/* Left nav */}
      <div style={{ width: 120, flexShrink: 0, display: "flex", flexDirection: "column", padding: "12px 8px", gap: 4, borderRight: "1px solid var(--color-border)" }}>
        {navItems.map((item) => (
          <Button key={item.key} type={activeTab === item.key ? "primary" : "text"} size="small" icon={item.icon} onClick={() => setActiveTab(item.key)} style={{ justifyContent: "flex-start", paddingLeft: 12, height: 36, borderRadius: 8 }}>{item.label}</Button>
        ))}
        <div style={{ flex: 1 }} />
        <Button type="text" size="small" icon={<IconLeft />} onClick={() => navigate(backToListParams ? `/problems?${backToListParams}` : "/problems")} style={{ justifyContent: "flex-start", paddingLeft: 12, height: 36, borderRadius: 8, color: "var(--color-text-3)" }}>返回题库</Button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", marginLeft: 16 }}>
        {(activeTab === "detail" || activeTab === "ai") && (
          <div style={{ display: "flex", gap: 24, width: "100%" }}>
            {/* Left panel */}
            <div style={{ flex: codeCollapsed ? 1 : "0 0 50%", display: "flex", flexDirection: "column", overflow: "hidden", paddingRight: 8, transition: "flex 0.3s ease" }}>
              {activeTab === "detail" && (
                <ProblemContent markdown={markdown} problem={problem} codeCollapsed={codeCollapsed} onExpandIDE={() => setCodeCollapsed(false)} />
              )}
              <div style={{ display: activeTab === "ai" ? "flex" : "none", flex: 1, flexDirection: "column", overflow: "hidden" }}>
                {!user ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "var(--color-text-3)" }}>
                    <IconRobot style={{ fontSize: 48 }} />
                    <Typography.Title heading={5} style={{ margin: 0 }}>AI 助手</Typography.Title>
                    <Typography.Paragraph style={{ color: "var(--color-text-3)" }}>登录后即可使用 AI 助手</Typography.Paragraph>
                    <Button type="primary" onClick={() => navigate("/login")}>去登录</Button>
                  </div>
                ) : (
                  <ChatPanel problemId={problem.id} currentCode={code} problemTitle={problem.title} problemDifficulty={problem.difficulty} currentLanguage={language} />
                )}
              </div>
            </div>

            {/* Right panel */}
            <CodeEditorPanel
              code={code} setCode={setCode} language={language} setLanguage={setLanguage}
              problem={problem} user={user} result={result} submitting={submitting} onSubmit={handleSubmit}
              testing={testing} testInput={testInput} setTestInput={setTestInput}
              testOutput={testOutput} setTestOutput={setTestOutput} actualOutput={actualOutput} onTest={handleTest}
              isModalVisible={isModalVisible} setIsModalVisible={setIsModalVisible}
              codeCollapsed={codeCollapsed} onCollapse={() => setCodeCollapsed(true)}
              editorFontSize={editorFontSize} setEditorFontSize={setEditorFontSize}
              editorTabSize={editorTabSize} setEditorTabSize={setEditorTabSize}
              editorTheme={editorTheme} setEditorTheme={setEditorTheme}
              codeCompletion={codeCompletion} setCodeCompletion={setCodeCompletion}
            />
          </div>
        )}

        {activeTab === "solutions" && (
          <SolutionsTab user={user} authLoading={authLoading} problemId={problem.id} navigate={navigate} editId={editId} onEditHandled={handleEditHandled} />
        )}
      </div>
    </div>
  );
}
```

### Step 1.8: Update App.tsx import path

Change line 9 in `client/src/App.tsx`:
```diff
- import ProblemDetailPage from "./pages/problems/detail";
+ import ProblemDetailPage from "./pages/problems/detail/index";
```

### Step 1.9: Delete old `detail.tsx`

Remove the original `client/src/pages/problems/detail.tsx` after verifying the new structure works.

### Step 1.10: Verify

Run: `cd client && npm run dev` — navigate to a problem detail page, verify all 3 tabs work (detail, solutions, AI), code editor, submit, test run, settings popover, collapse/expand IDE.

---

## Task 2: `CreateProblem.tsx` (581 lines) → `create/` directory

**Files:**
- Create: `client/src/pages/admin/problems/create/constants.ts`
- Create: `client/src/pages/admin/problems/create/TestCaseManager.tsx`
- Create: `client/src/pages/admin/problems/create/BatchUploadModal.tsx`
- Create: `client/src/pages/admin/problems/create/TagSelectorModal.tsx`
- Modify: `client/src/pages/admin/problems/CreateProblem.tsx` → rewrite as thin orchestrator
- No import changes needed in `client/src/pages/admin/problems/index.tsx` (still imports from `./CreateProblem`)

### Step 2.1: Create `create/constants.ts`

```typescript
// client/src/pages/admin/problems/create/constants.ts
export const DEFAULT_MARKDOWN = `## 题目描述\n\n输入两个整数 $a$ 和 $b$，输出它们的和。\n\n## 输入格式\n\n一行两个整数 $a, b$。\n\n## 输出格式\n\n一行一个整数。\n\n## 输入输出样例 #1\n\n### 输入 #1\n\n\`\`\`\n1 2\n\`\`\`\n\n### 输出 #1\n\n\`\`\`\n3\n\`\`\`\n\n## 说明/提示\n\n$-10^9 \\leq a, b \\leq 10^9$\n`;

export interface TestCase {
  id: string;
  name: string;
  input: string;
  output: string;
}
```

### Step 2.2: Create `create/BatchUploadModal.tsx`

Extract lines 97-207 (readFileAsText, processBatchFiles, handleBatchUploadConfirm) + lines 471-526 (batch upload modal JSX).

Props: `visible`, `onClose`, `onConfirm(cases: TestCase[])`

```typescript
// client/src/pages/admin/problems/create/BatchUploadModal.tsx
import { useState } from "react";
import { Modal, Upload, Button, Typography, Message } from "@arco-design/web-react";
import type { TestCase } from "./constants";

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (cases: TestCase[]) => void;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.readAsText(file);
  });
}

export default function BatchUploadModal({ visible, onClose, onConfirm }: Props) {
  const [batchFiles, setBatchFiles] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    const files = batchFiles.map(f => f.originFile).filter(Boolean) as File[];
    if (files.length === 0) { Message.warning("请选择或拖入文件"); return; }
    if (files.length > 200) { Message.error("单次最多上传200个文件 (即 100 组 .in/.out)"); return; }

    const MAX_SIZE = 30 * 1024 * 1024;
    const seenNames = new Set<string>();
    for (const file of files) {
      if (file.size > MAX_SIZE) { Message.error(`文件 ${file.name} 超过 30MB 限制`); return; }
      if (seenNames.has(file.name)) { Message.error(`检测到重复的文件名: ${file.name}，请检查后重新上传`); return; }
      seenNames.add(file.name);
    }

    const filePairs = new Map<number, { num: number, in?: File, out?: File }>();
    files.forEach(file => {
      const match = file.name.match(/^(\d+)\.(in|out)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const type = match[2].toLowerCase() as "in" | "out";
        if (!filePairs.has(num)) filePairs.set(num, { num });
        filePairs.get(num)![type] = file;
      }
    });

    const parsedList = Array.from(filePairs.values()).sort((a, b) => a.num - b.num);
    if (parsedList.length === 0) { Message.error("没有找到符合命名的文件 (如 1.in, 1.out)"); return; }
    if (parsedList.length > 100) { Message.error("单次最多导入 100 个测试节点"); return; }

    let isContinuous = true;
    for (let i = 0; i < parsedList.length; i++) {
      if (parsedList[i].num !== i + 1) { isContinuous = false; break; }
    }

    const doProcess = async (autoSort: boolean) => {
      setProcessing(true);
      try {
        const newCases: TestCase[] = [];
        for (let i = 0; i < parsedList.length; i++) {
          const item = parsedList[i];
          const index = autoSort ? i + 1 : item.num;
          newCases.push({
            id: Date.now().toString() + "_" + index,
            name: `测试点 ${index}`,
            input: item.in ? await readFileAsText(item.in) : "",
            output: item.out ? await readFileAsText(item.out) : "",
          });
        }
        onConfirm(newCases);
        Message.success(`成功导入 ${newCases.length} 个测试节点`);
        onClose();
      } finally { setProcessing(false); }
    };

    if (!isContinuous) {
      Modal.confirm({
        title: "节点标号不连续",
        content: "节点标号不连续，系统可自动重命名排序，但可能会与题面效果不一致。是否自动重命名并重新排序？",
        okText: "自动排序", cancelText: "取消",
        onOk: () => doProcess(true),
      });
    } else {
      doProcess(false);
    }
  };

  return (
    <Modal title="一键导入测试数据" visible={visible} onOk={handleConfirm} onCancel={() => { onClose(); setBatchFiles([]); }} confirmLoading={processing}>
      <Upload drag multiple autoUpload={false} showUploadList={false} fileList={batchFiles} onChange={(fileList) => setBatchFiles(fileList)}
        tip={<div style={{ whiteSpace: 'normal', wordBreak: 'break-word', marginTop: 8, color: 'var(--color-text-3)' }}>一键导入测试数据可批量上传文件，文件命名需要从1.in, 1.out开始，单个文件大小不大于30MB，单次最多上传200个文件(1.in/1.out到100.in/100.out)</div>}
      />
      {batchFiles.length > 0 && (
        <div style={{ marginTop: 16, maxHeight: 200, overflow: 'auto' }}>
          {batchFiles.map((file) => (
            <div key={file.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-fill-2)', borderRadius: 4, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', maxWidth: '85%', overflow: 'hidden' }}>
                <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8, color: '#52c41a', flexShrink: 0, display: 'block' }}>
                  <path d="M43 11L16.875 37L5 25.1818" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <Typography.Text ellipsis style={{ margin: 0, lineHeight: '14px', display: 'block' }}>{file.name}</Typography.Text>
              </div>
              <Button type="text" size="mini" status="danger" icon={<svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10V44H39V10H9Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/><path d="M20 20V33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M28 20V33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 10H44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 10L19.289 4H28.711L32 10H16Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/></svg>} onClick={() => setBatchFiles(prev => prev.filter(item => item.uid !== file.uid))} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
```

### Step 2.3: Create `create/TagSelectorModal.tsx`

Extract lines 529-578 (tag selector modal JSX).

Props: `visible`, `onClose`, `allTags`, `selectedTagIds`, `onUpdate(ids: number[])`

```typescript
// client/src/pages/admin/problems/create/TagSelectorModal.tsx
import { useState } from "react";
import { Modal, Input, Button, Space, Typography, Checkbox, Tag } from "@arco-design/web-react";

interface Props {
  visible: boolean;
  onClose: () => void;
  allTags: any[];
  selectedTagIds: number[];
  onUpdate: (ids: number[]) => void;
}

export default function TagSelectorModal({ visible, onClose, allTags, selectedTagIds, onUpdate }: Props) {
  const [keyword, setKeyword] = useState("");

  const filtered = allTags
    .filter(t => !keyword || t.name.includes(keyword))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));

  return (
    <Modal title="选择标签" visible={visible} onCancel={onClose} style={{ width: 500 }}
      footer={<Space><Button onClick={() => onUpdate([])}>清空</Button><Button type="primary" onClick={onClose}>确定</Button></Space>}
    >
      <Input.Search placeholder="搜索标签..." value={keyword} onChange={setKeyword} style={{ marginBottom: 16 }} allowClear />
      <div style={{ maxHeight: 400, overflow: "auto" }}>
        {filtered.length === 0 ? <Typography.Text type="secondary">暂无标签，请先在标签管理中创建</Typography.Text> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px" }}>
            {filtered.map(tag => (
              <div key={tag.id}>
                <Checkbox checked={selectedTagIds.includes(tag.id)} onChange={(checked) => {
                  if (checked) onUpdate([...selectedTagIds, tag.id]);
                  else onUpdate(selectedTagIds.filter(id => id !== tag.id));
                }}>
                  <Tag style={{ marginRight: 4 }}>{tag.name}</Tag>
                </Checkbox>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

### Step 2.4: Create `create/TestCaseManager.tsx`

Extract lines 255-334 (CRUD handlers + columns) + lines 411-469 (toolbar + table + edit modal).

Props: `testCases`, `setTestCases`

```typescript
// client/src/pages/admin/problems/create/TestCaseManager.tsx
import { useState } from "react";
import { Button, Space, Table, Modal, Upload, Typography, Input, Message } from "@arco-design/web-react";
import Editor from "@monaco-editor/react";
import type { TestCase } from "./constants";

interface Props {
  testCases: TestCase[];
  setTestCases: React.Dispatch<React.SetStateAction<TestCase[]>>;
}

export default function TestCaseManager({ testCases, setTestCases }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);

  const handleAdd = () => {
    setTestCases(prev => [...prev, { id: Date.now().toString(), name: `测试点 ${prev.length + 1}`, input: "", output: "" }]);
  };

  const handleDelete = (id: string) => setTestCases(prev => prev.filter(t => t.id !== id));

  const handleUpload = (file: File, id: string, type: "input" | "output") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setTestCases(prev => prev.map(t => t.id === id ? { ...t, [type]: text } : t));
      Message.success(`${file.name} 上传成功`);
    };
    reader.readAsText(file);
    return false;
  };

  const openEditModal = (record: TestCase) => { setEditingTestCase(record); setModalVisible(true); };

  const saveEditModal = () => {
    if (editingTestCase) setTestCases(prev => prev.map(t => t.id === editingTestCase.id ? editingTestCase : t));
    setModalVisible(false);
  };

  const columns = [
    { title: "测试点名称", dataIndex: "name" },
    {
      title: "输入",
      render: (_: any, record: TestCase) => (
        <Space>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 100 }}>{record.input ? "已上传" : "未上传"}</Typography.Text>
          <Upload autoUpload={false} showUploadList={false} accept=".in" beforeUpload={(file) => handleUpload(file, record.id, "input")}><Button size="small">上传 .in</Button></Upload>
        </Space>
      )
    },
    {
      title: "输出",
      render: (_: any, record: TestCase) => (
        <Space>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 100 }}>{record.output ? "已上传" : "未上传"}</Typography.Text>
          <Upload autoUpload={false} showUploadList={false} accept=".out" beforeUpload={(file) => handleUpload(file, record.id, "output")}><Button size="small">上传 .out</Button></Upload>
        </Space>
      )
    },
    {
      title: "操作",
      render: (_: any, record: TestCase) => (
        <Space>
          <Button type="text" onClick={() => openEditModal(record)}>修改</Button>
          <Button type="text" status="danger" onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button onClick={handleAdd} type="outline">添加测试节点</Button>
        </Space>
        <Table data={testCases} columns={columns} pagination={false} rowKey="id" />
      </div>

      <Modal title="修改测试节点" visible={modalVisible} onOk={saveEditModal} onCancel={() => setModalVisible(false)} autoFocus={false} focusLock={true} style={{ width: 800 }}>
        {editingTestCase && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Typography.Text bold>输入</Typography.Text>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, marginTop: 8 }}>
                <Editor height="300px" language="plaintext" value={editingTestCase.input} onChange={(val: string | undefined) => setEditingTestCase({ ...editingTestCase, input: val || "" })} options={{ minimap: { enabled: false }, wordWrap: "on" }} />
              </div>
            </div>
            <div>
              <Typography.Text bold>输出</Typography.Text>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, marginTop: 8 }}>
                <Editor height="300px" language="plaintext" value={editingTestCase.output} onChange={(val: string | undefined) => setEditingTestCase({ ...editingTestCase, output: val || "" })} options={{ minimap: { enabled: false }, wordWrap: "on" }} />
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </>
  );
}
```

### Step 2.5: Rewrite `CreateProblem.tsx` as thin orchestrator

The file becomes ~150 lines: form fields + markdown editor + submit logic + imports of sub-components.

```typescript
// client/src/pages/admin/problems/CreateProblem.tsx
import { useState, useEffect } from "react";
import { Form, Input, Select, Button, Card, Message, Space, InputNumber, Grid, Typography, Tag } from "@arco-design/web-react";
import MDEditor from "@uiw/react-md-editor";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { problemApi } from "../../../api/problem";
import { tagApi } from "../../../api/tag";
import { DIFFICULTY_VALUES, DIFFICULTY_CONFIG } from "../../../constants/difficulty";
import { DEFAULT_MARKDOWN } from "./create/constants";
import TestCaseManager from "./create/TestCaseManager";
import BatchUploadModal from "./create/BatchUploadModal";
import TagSelectorModal from "./create/TagSelectorModal";

const { Row, Col } = Grid;

interface CreateProblemProps {
  problemId?: number | null;
  onFinish?: () => void;
}

export default function CreateProblem({ problemId, onFinish }: CreateProblemProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [batchUploadVisible, setBatchUploadVisible] = useState(false);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);

  useEffect(() => { tagApi.list().then((res: any) => setAllTags(res || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (problemId) {
      const load = async () => {
        setLoading(true);
        try {
          const res: any = await problemApi.getOne(problemId);
          form.setFieldsValue({ slug: res.slug, title: res.title, difficulty: res.difficulty, timeLimit: res.timeLimit, memoryLimit: res.memoryLimit, score: res.score });
          setSelectedTagIds(res.tagIds || []);
          setMarkdown((res.markdown || "").replace(/^#[^\n]*\n?/, ""));
          const tcRes: any = await problemApi.getTestcases(problemId);
          if (tcRes && tcRes.length > 0) {
            setTestCases(tcRes.map((tc: any, i: number) => ({ id: Date.now().toString() + "_" + i, name: `测试点 ${i + 1}`, input: tc.input || "", output: tc.expectedOutput || tc.output || "" })));
          } else { setTestCases([]); }
        } catch { Message.error("加载题目信息失败"); } finally { setLoading(false); }
      };
      load();
    } else { form.resetFields(); setMarkdown(DEFAULT_MARKDOWN); setTestCases([]); }
  }, [problemId, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload: Record<string, any> = { title: values.title, difficulty: values.difficulty, timeLimit: values.timeLimit, memoryLimit: values.memoryLimit, tagIds: selectedTagIds, markdown };
      if (values.score != null && values.score !== "") payload.score = values.score;

      if (problemId) {
        await problemApi.update(problemId, payload);
        if (testCases.length > 0) await problemApi.saveTestcases(problemId, testCases.map((tc: any) => ({ input: tc.input, output: tc.output })));
        Message.success("题目及测试节点修改成功");
        if (onFinish) onFinish();
      } else {
        await problemApi.create({ ...payload, slug: values.slug } as any);
        if (testCases.length > 0) await problemApi.saveTestcases(values.slug, testCases.map((tc: any) => ({ input: tc.input, output: tc.output })));
        Message.success("题目及测试节点创建成功");
        form.resetFields(); setMarkdown(""); setTestCases([]); setSelectedTagIds([]);
      }
    } catch (err: any) { Message.error(err?.message || "操作失败"); } finally { setLoading(false); }
  };

  return (
    <Card>
      <Form form={form} layout="vertical" onSubmit={handleSubmit}>
        <Row gutter={16}>
          <Col span={8}><Form.Item field="slug" label="题号" rules={[{ required: true }]}><Input placeholder="如 P1001" disabled={!!problemId} /></Form.Item></Col>
          <Col span={8}><Form.Item field="title" label="标题" rules={[{ required: true }]}><Input placeholder="题目标题" /></Form.Item></Col>
          <Col span={8}><Form.Item field="difficulty" label="难度" initialValue="IRON"><Select>{DIFFICULTY_VALUES.map(d => <Select.Option key={d} value={d}>{DIFFICULTY_CONFIG[d].label}</Select.Option>)}</Select></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}><Form.Item field="score" label="分数" extra="留空则按难度自动计算"><InputNumber placeholder="自动" min={0} max={270} style={{ width: "100%" }} /></Form.Item></Col>
          <Col span={6}><Form.Item field="timeLimit" label="时间限制 (ms)" initialValue={1000}><InputNumber min={100} max={10000} /></Form.Item></Col>
          <Col span={6}><Form.Item field="memoryLimit" label="内存限制 (MB)" initialValue={256}><InputNumber min={16} max={1024} /></Form.Item></Col>
          <Col span={6}>
            <Form.Item label="标签">
              <div>
                <Button type="outline" onClick={() => setTagModalVisible(true)}>选择标签 {selectedTagIds.length > 0 ? `（已选 ${selectedTagIds.length} 个）` : ""}</Button>
                {selectedTagIds.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {allTags.filter(t => selectedTagIds.includes(t.id)).map(t => <Tag key={t.id} style={{ marginRight: 4, marginBottom: 4 }}>{t.name}</Tag>)}
                  </div>
                )}
              </div>
            </Form.Item>
          </Col>
        </Row>

        <div data-color-mode="light" style={{ marginBottom: 24 }}>
          <Typography.Text bold style={{ display: "block", marginBottom: 8 }}>题面内容</Typography.Text>
          <MDEditor value={markdown} onChange={(val) => setMarkdown(val || "")} preview="live" height={500} previewOptions={{ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }} />
        </div>

        <Typography.Title heading={6}>测试节点</Typography.Title>
        <div style={{ marginBottom: 16 }}>
          <Button onClick={() => setBatchUploadVisible(true)} type="primary" style={{ marginBottom: 16 }}>一键导入测试数据</Button>
        </div>
        <TestCaseManager testCases={testCases} setTestCases={setTestCases} />

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">{problemId ? "确认修改" : "确认并创建题目"}</Button>
          {problemId && <Button style={{ marginLeft: 16 }} size="large" onClick={onFinish}>取消</Button>}
        </Form.Item>
      </Form>

      <BatchUploadModal visible={batchUploadVisible} onClose={() => setBatchUploadVisible(false)} onConfirm={(cases) => setTestCases(prev => [...prev, ...cases])} />
      <TagSelectorModal visible={tagModalVisible} onClose={() => setTagModalVisible(false)} allTags={allTags} selectedTagIds={selectedTagIds} onUpdate={setSelectedTagIds} />
    </Card>
  );
}
```

### Step 2.6: Verify

Run: `cd client && npm run dev` — navigate to admin problems, create a new problem, edit an existing problem, test batch upload, test tag selector, test test case CRUD.

---

## Task 3: `profile/index.tsx` (549 lines) → `profile/` directory

**Files:**
- Create: `client/src/pages/profile/constants.ts`
- Create: `client/src/pages/profile/HeatmapChart.tsx`
- Create: `client/src/pages/profile/PieChart.tsx`
- Create: `client/src/pages/profile/WordCloudChart.tsx`
- Create: `client/src/pages/profile/ProblemWall.tsx`
- Create: `client/src/pages/profile/MySolutions.tsx`
- Modify: `client/src/pages/profile/index.tsx` — thin orchestrator

### Step 3.1: Create `profile/constants.ts`

```typescript
// client/src/pages/profile/constants.ts
export const COLORS = {
  ac: "#00b42a", wa: "#f53f3f", tle: "#ff7d00", mle: "#7816ff",
  re: "#b37feb", ce: "#ffb470", se: "#c9cdd4",
};

export const STATUS_COLOR_MAP: Record<string, string> = {
  AC: COLORS.ac, WA: COLORS.wa, TLE: COLORS.tle,
  MLE: COLORS.mle, RE: COLORS.re, CE: COLORS.ce, SE: COLORS.se,
};

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

export function getSafeAvatar(avatar: string | undefined): string | undefined {
  if (!avatar) return undefined;
  if (/^data:image\//.test(avatar) || /^https?:\/\//.test(avatar)) return avatar;
  return undefined;
}
```

### Step 3.2: Create `profile/HeatmapChart.tsx`

Move `HeatmapChart` component (lines 191-329) to its own file. It imports `ActivityCalendar` from `react-activity-calendar` and `Tooltip` from Arco.

Props: `data: [string, number][]`

### Step 3.3: Create `profile/PieChart.tsx`

Move `PieChart` component (lines 332-362) to its own file. Imports `ReactECharts`, `STATUS_COLOR_MAP`.

Props: `data: { name: string; value: number }[]`

### Step 3.4: Create `profile/WordCloudChart.tsx`

Move `WordCloudChart` component (lines 365-397) to its own file. Imports `ReactECharts`, `echarts-wordcloud`.

Props: `data: { name: string; value: number }[]`

### Step 3.5: Create `profile/ProblemWall.tsx`

Move `ProblemWall` component (lines 400-418) to its own file. Imports `DifficultyTag`, `getDifficultyHexColor`.

Props: `problems: { problem_id: number; slug: string; title: string; difficulty: string }[]`

### Step 3.6: Create `profile/MySolutions.tsx`

Move `MySolutions` component (lines 421-549) to its own file. Imports `solutionApi`, `useNavigate`, Arco components.

Props: `userId: number`

### Step 3.7: Rewrite `profile/index.tsx` as thin orchestrator

The file becomes ~80 lines: data fetching + layout + sub-component composition.

```typescript
// client/src/pages/profile/index.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Grid, Card, Typography, Space, Tabs, Spin, Empty, Avatar } from "@arco-design/web-react";
import { IconUser, IconCalendar, IconStar, IconThunderbolt } from "@arco-design/web-react/icon";
import { profileApi } from "../../api/profile";
import { useAuthStore } from "../../stores/auth";
import { getSafeAvatar, ProfileInfo, ProfileStats } from "./constants";
import HeatmapChart from "./HeatmapChart";
import PieChart from "./PieChart";
import WordCloudChart from "./WordCloudChart";
import ProblemWall from "./ProblemWall";
import MySolutions from "./MySolutions";
import "./profile.css";

const { Row, Col } = Grid;
const { Title, Text } = Typography;

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    Promise.all([profileApi.getProfile(username), profileApi.getStats(username)])
      .then(([p, s]: any) => { setProfile(p); setStats(s); })
      .catch(() => { setProfile(null); setStats(null); })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="profile-loading"><Spin size={40} /></div>;
  if (!profile) return <div className="profile-loading"><Empty description="用户不存在" /></div>;

  return (
    <div className="profile-page">
      <Row gutter={24}>
        <Col xs={24} md={7} lg={6}>
          <Card bordered={false} className="profile-card user-card">
            <div className="user-card-inner">
              <Avatar size={96} className="user-avatar" triggerIcon={null}>
                {getSafeAvatar(profile.avatar) ? <img src={getSafeAvatar(profile.avatar)} alt="avatar" /> : <IconUser style={{ fontSize: 48 }} />}
              </Avatar>
              <Title heading={5} className="user-name">{profile.username}</Title>
              <Text type="secondary" className="user-handle">@{profile.username}</Text>
              <div className="user-divider" />
              <Space direction="vertical" className="user-meta" size={8}>
                <div className="meta-row"><IconCalendar className="meta-icon" /><Text type="secondary">注册于 {new Date(profile.createdAt).toLocaleDateString("zh-CN")}</Text></div>
                <div className="meta-row"><IconStar className="meta-icon" /><Text type="secondary">{profile.signature || "这个人很懒，什么都没写~"}</Text></div>
              </Space>
              <div className="user-divider" />
              <Row className="stat-row">
                <Col span={8} className="stat-cell"><div className="stat-value">{profile.solvedCount}</div><div className="stat-label">已解题数</div></Col>
                <Col span={8} className="stat-cell"><div className="stat-value">{profile.totalSubmissions}</div><div className="stat-label">总提交数</div></Col>
                <Col span={8} className="stat-cell"><div className="stat-value">{profile.totalScore ?? 0}</div><div className="stat-label">总分数</div></Col>
              </Row>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={17} lg={18}>
          <Space direction="vertical" size={20} style={{ width: "100%" }}>
            <Card bordered={false} className="profile-card">
              <Title heading={6} className="card-title"><IconThunderbolt style={{ marginRight: 8 }} />活跃度</Title>
              <HeatmapChart data={stats?.heatmapData || []} />
            </Card>
            <Row gutter={16} style={{ display: 'flex', alignItems: 'stretch' }}>
              <Col xs={24} lg={12} style={{ display: 'flex', marginBottom: 16 }}>
                <Card bordered={false} className="profile-card" style={{ width: '100%', height: '100%' }}>
                  <Title heading={6} className="card-title">提交统计</Title>
                  <PieChart data={stats?.statusDistribution || []} />
                </Card>
              </Col>
              <Col xs={24} lg={12} style={{ display: 'flex', marginBottom: 16 }}>
                <Card bordered={false} className="profile-card" style={{ width: '100%', height: '100%' }}>
                  <Title heading={6} className="card-title">能力词云</Title>
                  <WordCloudChart data={stats?.wordCloudData || []} />
                </Card>
              </Col>
            </Row>
            <Card bordered={false} className="profile-card">
              <Tabs defaultActiveTab="ac" type="capsule">
                <Tabs.TabPane key="ac" title={`已通过 (${stats?.acProblems?.length || 0})`}><ProblemWall problems={stats?.acProblems || []} /></Tabs.TabPane>
                <Tabs.TabPane key="attempted" title={`尝试过 (${stats?.attemptedProblems?.length || 0})`}><ProblemWall problems={stats?.attemptedProblems || []} /></Tabs.TabPane>
              </Tabs>
            </Card>
            {currentUser && currentUser.username === username && <MySolutions userId={currentUser.id} />}
          </Space>
        </Col>
      </Row>
    </div>
  );
}
```

### Step 3.8: Verify

Run: `cd client && npm run dev` — navigate to a user profile page, verify heatmap, pie chart, word cloud, problem wall, and my solutions (for logged-in user's own profile).

---

## Task 4: `ai.service.ts` (610 lines) → 3 focused services

**Files:**
- Create: `server/src/ai/ai-provider.service.ts`
- Create: `server/src/ai/ai-conversation.service.ts`
- Create: `server/src/ai/ai-stats.service.ts`
- Modify: `server/src/ai/ai.service.ts` → facade delegating to sub-services
- Modify: `server/src/ai/ai.module.ts` → register new services

**Note:** `AiController` remains unchanged — it still injects only `AiService`.

### Step 4.1: Create `ai-provider.service.ts`

Extract provider CRUD + active provider + config methods.

```typescript
// server/src/ai/ai-provider.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiProviderService {
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redis = createClient({ url: this.config.get('REDIS_URL') });
    await this.redis.connect();
  }

  private async getConfigValue(key: string, envKey: string, defaultVal: string): Promise<string> {
    const redisVal = await this.redis.get(`ai:config:${key}`);
    return redisVal ?? this.config.get(envKey) ?? defaultVal;
  }

  async getProviders() {
    return this.prisma.aiProvider.findMany({ orderBy: { id: 'asc' } });
  }

  async addProvider(dto: { name: string; apiBase: string; apiKey: string; modelName: string; isActive?: boolean }) {
    if (dto.isActive) await this.prisma.aiProvider.updateMany({ data: { isActive: false } });
    return this.prisma.aiProvider.create({ data: dto });
  }

  async updateProvider(id: number, dto: { name?: string; apiBase?: string; apiKey?: string; modelName?: string; isActive?: boolean }) {
    if (dto.isActive) await this.prisma.aiProvider.updateMany({ data: { isActive: false } });
    return this.prisma.aiProvider.update({ where: { id }, data: dto });
  }

  async deleteProvider(id: number) {
    return this.prisma.aiProvider.delete({ where: { id } });
  }

  async activateProvider(id: number) {
    await this.prisma.aiProvider.updateMany({ data: { isActive: false } });
    return this.prisma.aiProvider.update({ where: { id }, data: { isActive: true } });
  }

  async fetchAvailableModels(apiBase: string, apiKey: string) {
    let baseUrl = apiBase.trim();
    if (baseUrl.endsWith('/chat/completions')) baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const url = `${baseUrl}/models`;
    try {
      const response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) { const text = await response.text(); throw new Error(text || `HTTP error ${response.status}`); }
      const data: any = await response.json();
      if (data && Array.isArray(data.data)) return data.data.map((m: any) => m.id);
      return [];
    } catch (err: any) { throw new ForbiddenException('获取模型列表失败: ' + err.message); }
  }

  async getActiveProvider() {
    const active = await this.prisma.aiProvider.findFirst({ where: { isActive: true } });
    if (active) return active;
    return {
      name: 'Default',
      apiBase: await this.getConfigValue('apiBase', 'AI_API_BASE', 'https://ai.ssdevops.com/v1'),
      apiKey: await this.getConfigValue('apiKey', 'AI_API_KEY', ''),
      modelName: await this.getConfigValue('model', 'AI_MODEL', 'glm-5-fp8'),
    };
  }

  async getGlobalLimit() {
    return Number(await this.getConfigValue('dailyLimit', 'AI_DAILY_LIMIT', '100'));
  }

  async setGlobalLimit(dailyLimit: number) {
    await this.redis.set('ai:config:dailyLimit', String(dailyLimit));
    return { success: true };
  }
}
```

### Step 4.2: Create `ai-conversation.service.ts`

Extract conversation/chat methods (getHistory, clearHistory, chat, buildSystemPrompt). This is the largest piece (~250 lines).

```typescript
// server/src/ai/ai-conversation.service.ts
import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private providerService: AiProviderService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redis = createClient({ url: this.config.get('REDIS_URL') });
    await this.redis.connect();
  }

  private async getUserLimit(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { aiDailyLimit: true } });
    if (user?.aiDailyLimit !== null && user?.aiDailyLimit !== undefined) return user.aiDailyLimit;
    return this.providerService.getGlobalLimit();
  }

  async getRemainingUses(userId: number, role: string): Promise<{ remaining: number; limit: number; unlimited: boolean }> {
    if (role === 'ADMIN' || role === 'TEACHER') return { remaining: -1, limit: -1, unlimited: true };
    const limit = await this.getUserLimit(userId);
    const today = new Date().toISOString().slice(0, 10);
    const used = Number(await this.redis.get(`ai:usage:${userId}:${today}`) || '0');
    return { remaining: Math.max(0, limit - used), limit, unlimited: false };
  }

  private async checkAndIncrementUsage(userId: number, role: string) {
    if (role === 'ADMIN' || role === 'TEACHER') return;
    const limit = await this.getUserLimit(userId);
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${userId}:${today}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 86400);
    if (count > limit) throw new ForbiddenException(`今日 AI 使用次数已达上限 (${limit} 次)，明天再来吧`);
  }

  async getHistory(userId: number, problemId: number) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { userId_problemId: { userId, problemId } },
      include: { messages: { orderBy: { id: 'asc' }, select: { role: true, content: true } } },
    });
    return conversation?.messages || [];
  }

  async clearHistory(userId: number, problemId: number) {
    await this.prisma.aiConversation.deleteMany({ where: { userId, problemId } });
    return { success: true };
  }

  async chat(user: { id: number; role: string }, dto: { messages: any[]; problemId: number; currentCode?: string; language?: string }, res: any) {
    await this.checkAndIncrementUsage(user.id, user.role);

    const [problem, submissions] = await Promise.all([
      this.prisma.problem.findUnique({ where: { id: dto.problemId } }),
      this.prisma.submission.findMany({ where: { userId: user.id, problemId: dto.problemId }, orderBy: { createdAt: 'desc' }, take: 10, select: { status: true, score: true, createdAt: true } }),
    ]);

    if (!problem) { res.status(404).json({ message: '题目不存在' }); return; }

    let markdown = '';
    try { const fs = require('fs'); markdown = fs.readFileSync(problem.filePath, 'utf-8'); } catch { markdown = problem.title; }

    const systemPrompt = this.buildSystemPrompt({ title: problem.title, difficulty: problem.difficulty, markdown, currentCode: dto.currentCode, submissions, language: dto.language });

    const extractText = (msg: any): string => {
      if (msg.parts && Array.isArray(msg.parts)) return msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      return msg.content || '';
    };

    const recentMessages = dto.messages.slice(-20).map((m) => ({ ...m, content: (m.content || '').slice(0, 5000) }));

    const provider = await this.providerService.getActiveProvider();

    let conversation = await this.prisma.aiConversation.findUnique({ where: { userId_problemId: { userId: user.id, problemId: dto.problemId } } });
    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({ data: { userId: user.id, problemId: dto.problemId } });
    } else {
      await this.prisma.aiMessage.deleteMany({ where: { conversationId: conversation.id } });
    }

    if (recentMessages.length > 0) {
      await this.prisma.aiMessage.createMany({ data: recentMessages.map((m) => ({ conversationId: conversation!.id, role: m.role, content: extractText(m) })) });
    }

    try {
      const llmMessages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.filter((m) => extractText(m).trim()).map((m) => ({ role: m.role, content: extractText(m) })),
      ];

      const fetchResp = await fetch(`${provider.apiBase}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
        body: JSON.stringify({ model: provider.modelName, messages: llmMessages, stream: true, stream_options: { include_usage: true }, temperature: 0.7, max_tokens: 4096 }),
      });

      if (!fetchResp.ok) { const errText = await fetchResp.text(); this.logger.error(`LLM API error ${fetchResp.status}: ${errText}`); res.status(502).json({ message: 'AI 模型服务返回错误' }); return; }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const reader = fetchResp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiResponseContent = '';
      let totalTokens = 0, inputTokens = 0, outputTokens = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.usage) { totalTokens = json.usage.total_tokens || 0; inputTokens = json.usage.prompt_tokens || 0; outputTokens = json.usage.completion_tokens || 0; }
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) { res.write(delta.content); aiResponseContent += delta.content; }
          } catch { /* ignore */ }
        }
      }
      res.end();

      try {
        const today = new Date().toISOString().slice(0, 10);
        await this.redis.incr(`ai:stats:${today}:calls:${provider.modelName}`);
        if (!totalTokens) { const promptLength = JSON.stringify(llmMessages).length; inputTokens = Math.ceil(promptLength / 1.5); outputTokens = Math.ceil(aiResponseContent.length / 1.5); totalTokens = inputTokens + outputTokens; }
        await this.redis.incrBy(`ai:stats:${today}:tokens:${provider.modelName}`, totalTokens);
        await this.prisma.aiUsageLog.create({ data: { userId: user.id, providerName: (provider as any).name || 'Unknown', modelName: provider.modelName, inputTokens, outputTokens, totalTokens, cost: 0, timeUsedMs: Date.now() - startTime, status: fetchResp.status, source: 'chat' } });
      } catch (statErr) { this.logger.warn('Failed to save AI stats: ' + statErr); }

      if (aiResponseContent) await this.prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: aiResponseContent } });
    } catch (err: any) {
      this.logger.error('AI chat error', err?.message || err);
      if (!res.headersSent) res.status(500).json({ message: 'AI 服务暂时不可用，请稍后重试' });
      else res.end();
    }
  }

  private buildSystemPrompt(ctx: { title: string; difficulty: string; markdown: string; currentCode?: string; submissions: { status: string; score: number | null; createdAt: Date }[]; language?: string }): string {
    // ... exact same content as original lines 513-609 ...
  }
}
```

### Step 4.3: Create `ai-stats.service.ts`

Extract getStats, getUsageLogs, getUsersQuotas, updateUserQuota.

```typescript
// server/src/ai/ai-stats.service.ts
import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiStatsService {
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private providerService: AiProviderService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redis = createClient({ url: this.config.get('REDIS_URL') });
    await this.redis.connect();
  }

  async getStats() {
    // Copy verbatim from server/src/ai/ai.service.ts lines 177-234
    // Method uses this.redis (SCAN pattern) + this.prisma to aggregate stats
  }

  async getUsageLogs(page: number, pageSize: number, filters?: { provider?: string, model?: string, startDate?: string, endDate?: string }) {
    // Copy verbatim from server/src/ai/ai.service.ts lines 236-257
  }

  async getUsersQuotas(page = 1, pageSize = 20, username?: string) {
    // Copy verbatim from server/src/ai/ai.service.ts lines 144-167
    // Uses this.prisma.user + this.redis for today's usage
  }

  async updateUserQuota(userId: number, aiDailyLimit: number | null) {
    return this.prisma.user.update({ where: { id: userId }, data: { aiDailyLimit } });
  }
}
```

### Step 4.4: Rewrite `ai.service.ts` as facade

```typescript
// server/src/ai/ai.service.ts
import { Injectable } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiConversationService } from './ai-conversation.service';
import { AiStatsService } from './ai-stats.service';

@Injectable()
export class AiService {
  constructor(
    private providerService: AiProviderService,
    private conversationService: AiConversationService,
    private statsService: AiStatsService,
  ) {}

  // Provider management
  getProviders() { return this.providerService.getProviders(); }
  addProvider(dto: any) { return this.providerService.addProvider(dto); }
  updateProvider(id: number, dto: any) { return this.providerService.updateProvider(id, dto); }
  deleteProvider(id: number) { return this.providerService.deleteProvider(id); }
  activateProvider(id: number) { return this.providerService.activateProvider(id); }
  fetchAvailableModels(apiBase: string, apiKey: string) { return this.providerService.fetchAvailableModels(apiBase, apiKey); }
  getActiveProvider() { return this.providerService.getActiveProvider(); }
  getGlobalLimit() { return this.providerService.getGlobalLimit(); }
  setGlobalLimit(dailyLimit: number) { return this.providerService.setGlobalLimit(dailyLimit); }

  // Conversation / Chat
  getHistory(userId: number, problemId: number) { return this.conversationService.getHistory(userId, problemId); }
  clearHistory(userId: number, problemId: number) { return this.conversationService.clearHistory(userId, problemId); }
  chat(user: any, dto: any, res: any) { return this.conversationService.chat(user, dto, res); }
  getRemainingUses(userId: number, role: string) { return this.conversationService.getRemainingUses(userId, role); }

  // Stats
  getStats() { return this.statsService.getStats(); }
  getUsageLogs(page: number, pageSize: number, filters?: any) { return this.statsService.getUsageLogs(page, pageSize, filters); }
  getUsersQuotas(page?: number, pageSize?: number, username?: string) { return this.statsService.getUsersQuotas(page, pageSize, username); }
  updateUserQuota(userId: number, aiDailyLimit: number | null) { return this.statsService.updateUserQuota(userId, aiDailyLimit); }
}
```

### Step 4.5: Update `ai.module.ts`

Register the 3 new services as providers.

```typescript
// server/src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderService } from './ai-provider.service';
import { AiConversationService } from './ai-conversation.service';
import { AiStatsService } from './ai-stats.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiProviderService, AiConversationService, AiStatsService],
  exports: [AiService],
})
export class AiModule {}
```

### Step 4.6: Verify

Run: `cd server && npm run start:dev` — verify AI chat, provider management, stats, user quotas all work through the existing controller endpoints.

---

## Final Verification

After all 4 tasks:
1. `cd client && npm run dev` — verify all pages render correctly
2. `cd server && npm run start:dev` — verify server starts without errors
3. Test the full flow: create problem → solve problem → view solutions → AI chat → profile page
