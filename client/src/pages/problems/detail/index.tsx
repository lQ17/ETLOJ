import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Typography, Button, Spin, Message } from "@arco-design/web-react";
import {
  IconFile, IconEdit, IconRobot, IconLeft,
} from "@arco-design/web-react/icon";
import { problemApi } from "../../../api/problem";
import { submissionApi } from "../../../api/submission";
import { useAuthStore } from "../../../stores/auth";
import confetti from "canvas-confetti";
import ChatPanel from "../../../components/ChatPanel";
import { defaultCode } from "./constants";
import ProblemContent from "./ProblemContent";
import CodeEditorPanel from "./CodeEditorPanel";
import SolutionsTab from "./SolutionsTab";

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backToListParams = searchParams.get("back") || undefined;
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
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const wsRef = useRef<WebSocket | null>(null);
  const submitTimesRef = useRef<number[]>([]);

  const [editorFontSize, setEditorFontSize] = useState(() => {
    const saved = localStorage.getItem("oj_editor_fontSize");
    const v = saved ? Number(saved) : 16;
    return Math.min(48, Math.max(12, v));
  });
  const [editorTabSize, setEditorTabSize] = useState(() => {
    const saved = localStorage.getItem("oj_editor_tabSize");
    return saved ? Number(saved) : 4;
  });
  const [editorTheme, setEditorTheme] = useState(() => {
    return localStorage.getItem("oj_editor_theme") || "vs";
  });
  const [codeCompletion, setCodeCompletion] = useState(() => {
    return localStorage.getItem("oj_editor_codeCompletion") === "true";
  });
  const [codeCollapsed, setCodeCollapsed] = useState(false);

  // 二级导航
  const [activeTab, setActiveTab] = useState<"detail" | "solutions" | "ai">(() => {
    const tab = searchParams.get("tab");
    return tab === "solutions" || tab === "ai" ? tab : "detail";
  });

  // 题解编辑 deep-link
  const editId = searchParams.get("edit");
  const handleEditHandled = () => {
    searchParams.delete("edit");
    navigate(`/problems/${id}?${searchParams.toString()}`, { replace: true });
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p: any = await problemApi.getOne(id);
        setProblem(p);
        setMarkdown(p.markdown || "");
        // 恢复浏览器本地保存的代码
        const uid = user?.id || "anon";
        const saved = localStorage.getItem(`oj_code_${p.id}_${uid}`);
        if (saved != null) {
          setCode(saved);
        }
      } catch {
        Message.error("加载题目失败");
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!user) {
      Message.warning("请先登录后再提交");
      navigate("/login");
      return;
    }
    if (!code.trim()) {
      Message.warning("请先编写代码");
      return;
    }

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
      const res: any = await submissionApi.create({
        problemId: problem.id,
        code,
        language,
      });
      submitTimesRef.current.push(Date.now());
      watchResult(res.id);
    } catch (err: any) {
      Message.error(err?.message || "提交失败");
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!user) {
      Message.warning("请先登录后再测试");
      navigate("/login");
      return;
    }
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

  const handleTestSample = (input: string, output: string) => {
    setTestInput(input);
    setTestOutput(output);
    setActualOutput("");
    // 需要等状态更新后再运行测试
    setTimeout(() => {
      if (!code.trim()) {
        Message.warning("请先编写代码");
        return;
      }
      setTesting(true);
      setActualOutput("");
      submissionApi.run({ problemId: problem.id, code, language, input }).then((res: any) => {
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
      }).catch((err: any) => {
        setActualOutput(`[请求失败] ${err?.message || "未知错误"}`);
      }).finally(() => {
        setTesting(false);
      });
    }, 0);
  };

  const handleClear = () => {
    setTestInput("");
    setTestOutput("");
    setActualOutput("");
  };

  const startPollingFallback = (submissionId: number) => {
    if (pollRef.current) return;
    console.warn("WebSocket 连接不可用，正在自动降级到 HTTP 短轮询模式...");
    pollRef.current = setInterval(async () => {
      try {
        const sub: any = await submissionApi.getOne(submissionId);
        setResult(sub);
        if (sub.status !== "PENDING" && sub.status !== "JUDGING") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = undefined;
          }
          setSubmitting(false);
        }
      } catch {
        // ignore
      }
    }, 1500);
  };

  const watchResult = (submissionId: number) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/submissions`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let isFinished = false;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("WebSocket 连接建立超时，启动短轮询降级...");
          ws.close();
          startPollingFallback(submissionId);
        }
      }, 3500);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        ws.send(JSON.stringify({ event: "subscribe", data: { submissionId } }));
      };

      ws.onmessage = (event) => {
        try {
          const { event: type, data } = JSON.parse(event.data);
          if (type === "update" && data.id === submissionId) {
            setResult(data);
            if (data.status !== "PENDING" && data.status !== "JUDGING") {
              isFinished = true;
              ws.close();
              setSubmitting(false);
            }
          }
        } catch (e) {
          console.error("解析 WebSocket 消息失败", e);
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        if (!isFinished) {
          startPollingFallback(submissionId);
        }
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        if (!isFinished) {
          startPollingFallback(submissionId);
        }
      };
    } catch (err) {
      console.error("创建 WebSocket 实例失败，直接降级至短轮询", err);
      startPollingFallback(submissionId);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // 提交通过后删除浏览器本地保存的代码
  useEffect(() => {
    if (result?.status === "AC" && problem) {
      const uid = user?.id || "anon";
      localStorage.removeItem(`oj_code_${problem.id}_${uid}`);
    }
  }, [result?.status]);

  // 满分通过时播放五彩纸屑特效
  useEffect(() => {
    if (result?.status === "AC" && result?.score === 100) {
      // 基于 1080p (1920px) 的比例缩放，适配任意分辨率
      const scale = window.innerWidth / 1536;
      const count = Math.round(100 * scale);
      const spread = Math.round(55 * scale);
      confetti({
        particleCount: count,
        angle: 60,
        spread,
        origin: { x: 0, y: 0.6 },
      });
      confetti({
        particleCount: count,
        angle: 120,
        spread,
        origin: { x: 1, y: 0.6 },
      });
    }
  }, [result?.score, result?.status]);

  if (!problem) {
    return <div style={{ textAlign: "center", paddingTop: 80 }}><Spin /></div>;
  }

  const navItems = [
    { key: "detail" as const, icon: <IconFile />, label: "题目详情" },
    { key: "solutions" as const, icon: <IconEdit />, label: "查看题解" },
    { key: "ai" as const, icon: <IconRobot />, label: "问问AI" },
  ];

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 140px)", fontSize: 16 }}>
      {/* 最左侧：二级导航 */}
      <div style={{
        width: 120,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        padding: "12px 8px",
        gap: 4,
        borderRight: "1px solid var(--color-border)",
      }}>
        {navItems.map((item) => (
          <Button
            key={item.key}
            type={activeTab === item.key ? "primary" : "text"}
            size="small"
            icon={item.icon}
            onClick={() => setActiveTab(item.key)}
            style={{
              justifyContent: "flex-start",
              paddingLeft: 12,
              height: 36,
              borderRadius: 8,
            }}
          >
            {item.label}
          </Button>
        ))}
        <div style={{ flex: 1 }} />
        <Button
          type="text"
          size="small"
          icon={<IconLeft />}
          onClick={() => navigate(backToListParams ? `/problems?${backToListParams}` : "/problems")}
          style={{
            justifyContent: "flex-start",
            paddingLeft: 12,
            height: 36,
            borderRadius: 8,
            color: "var(--color-text-3)",
          }}
        >
          返回题库
        </Button>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", marginLeft: 16 }}>
        {/* 题目详情与问问AI（左右分栏共用代码编辑器） */}
        {(activeTab === "detail" || activeTab === "ai") && (
          <div style={{ display: "flex", gap: 24, width: "100%" }}>
            {/* 左侧：动态内容（题面 或 AI） */}
            <div style={{
              flex: codeCollapsed ? 1 : "0 0 50%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              paddingRight: 8,
              transition: "flex 0.3s ease",
            }}>
              {/* 题面区域 */}
              <div style={{
                display: activeTab === "detail" ? "block" : "none",
                flex: 1,
                overflow: "auto",
              }}>
                <ProblemContent
                  markdown={markdown}
                  problem={problem}
                  codeCollapsed={codeCollapsed}
                  onExpandIDE={() => setCodeCollapsed(false)}
                  onTestSample={handleTestSample}
                />
              </div>

              {/* 问问AI 区域 — 放在左侧，使用 display 控制保留对话状态 */}
              <div style={{
                display: activeTab === "ai" ? "flex" : "none",
                flex: 1,
                flexDirection: "column",
                overflow: "hidden",
              }}>
                {!user ? (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center",
                    justifyContent: "center", flexDirection: "column", gap: 16,
                    color: "var(--color-text-3)",
                  }}>
                    <IconRobot style={{ fontSize: 48 }} />
                    <Typography.Title heading={5} style={{ margin: 0 }}>AI 助手</Typography.Title>
                    <Typography.Paragraph style={{ color: "var(--color-text-3)" }}>
                      登录后即可使用 AI 助手
                    </Typography.Paragraph>
                    <Button type="primary" onClick={() => navigate("/login")}>去登录</Button>
                  </div>
                ) : (
                  <ChatPanel
                    problemId={problem.id}
                    currentCode={code}
                    problemTitle={problem.title}
                    problemDifficulty={problem.difficulty}
                    currentLanguage={language}
                  />
                )}
              </div>
            </div>

            {/* 右侧：代码编辑器 + 测试区 */}
            <CodeEditorPanel
              code={code}
              setCode={setCode}
              language={language}
              setLanguage={setLanguage}
              problem={problem}
              user={user}
              result={result}
              submitting={submitting}
              onSubmit={handleSubmit}
              testing={testing}
              testInput={testInput}
              setTestInput={setTestInput}
              testOutput={testOutput}
              setTestOutput={setTestOutput}
              actualOutput={actualOutput}
              setActualOutput={setActualOutput}
              onTest={handleTest}
              onClear={handleClear}
              isModalVisible={isModalVisible}
              setIsModalVisible={setIsModalVisible}
              codeCollapsed={codeCollapsed}
              onCollapse={setCodeCollapsed}
              editorFontSize={editorFontSize}
              setEditorFontSize={setEditorFontSize}
              editorTabSize={editorTabSize}
              setEditorTabSize={setEditorTabSize}
              editorTheme={editorTheme}
              setEditorTheme={setEditorTheme}
              codeCompletion={codeCompletion}
              setCodeCompletion={setCodeCompletion}
            />
          </div>
        )}

        {/* 查看题解 */}
        {activeTab === "solutions" && (
          <SolutionsTab
            user={user}
            authLoading={authLoading}
            problemId={problem.id}
            navigate={navigate}
            editId={editId}
            onEditHandled={handleEditHandled}
          />
        )}
      </div>
    </div>
  );
}
