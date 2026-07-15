import { useRef, useState, useCallback, useEffect } from "react";
import { Select, Button, Space, Tag, Card, Popover, Radio, InputNumber, Message } from "@arco-design/web-react";
import { IconSettings, IconDown, IconRight } from "@arco-design/web-react/icon";
import Editor from "@monaco-editor/react";
import { langMap, statusLabel, statusColor } from "./constants";
import { submissionApi } from "../../../api/submission";
import { applyEditorTheme, registerMonacoExtras } from "../../../editor/register";
import { DEV_CPP_THEME_ID, DEV_CPP_THEME_LABEL } from "../../../editor/themes/dev-cpp";
import "../../../editor/themes/dev-cpp.css";
import TestArea from "./TestArea";

interface CodeEditorPanelProps {
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
  setActualOutput: (v: string) => void;
  onTest: () => void;
  onClear: () => void;
  isModalVisible: boolean;
  setIsModalVisible: (v: boolean) => void;
  codeCollapsed: boolean;
  onCollapse: (v: boolean) => void;
  editorFontSize: number;
  setEditorFontSize: (v: number) => void;
  editorTabSize: number;
  setEditorTabSize: (v: number) => void;
  editorTheme: string;
  setEditorTheme: (v: string) => void;
  codeCompletion: boolean;
  setCodeCompletion: (v: boolean) => void;
}

export default function CodeEditorPanel({
  code,
  setCode,
  language,
  setLanguage,
  problem,
  user,
  result,
  submitting,
  onSubmit,
  testing,
  testInput,
  setTestInput,
  testOutput,
  setTestOutput,
  actualOutput,
  onTest,
  onClear,
  isModalVisible,
  setIsModalVisible,
  codeCollapsed,
  onCollapse,
  editorFontSize,
  setEditorFontSize,
  editorTabSize,
  setEditorTabSize,
  editorTheme,
  setEditorTheme,
  codeCompletion,
  setCodeCompletion,
}: CodeEditorPanelProps) {
  const [systemTheme, setSystemTheme] = useState(() => {
    return document.body.getAttribute("arco-theme") === "dark" ? "vs-dark" : "vs";
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setSystemTheme(document.body.getAttribute("arco-theme") === "dark" ? "vs-dark" : "vs");
    };
    window.addEventListener("theme-change", handleThemeChange);
    return () => window.removeEventListener("theme-change", handleThemeChange);
  }, []);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const selDecoRef = useRef<string[]>([]);
  const fontSizeRef = useRef(editorFontSize);
  fontSizeRef.current = editorFontSize;

  const resolvedTheme = editorTheme === "auto" ? systemTheme : editorTheme;
  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;

  /** Dev-C++：用 decoration 把选中区间强制染成白字（Monaco selectionForeground 对 token 无效） */
  const syncSelectionWhiteFg = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (resolvedThemeRef.current !== DEV_CPP_THEME_ID) {
      if (selDecoRef.current.length) {
        selDecoRef.current = editor.deltaDecorations(selDecoRef.current, []);
      }
      return;
    }

    const selections = editor.getSelections?.() || [];
    const decos = selections
      .filter((s: any) => s && !s.isEmpty())
      .map((s: any) => ({
        range: s,
        options: {
          inlineClassName: "dev-cpp-sel-fg",
          stickiness: 1, // NeverGrowsWhenTypingAtEdges
        },
      }));
    selDecoRef.current = editor.deltaDecorations(selDecoRef.current, decos);
  }, []);

  // 主题切换或 defineTheme 更新后强制 setTheme，否则 Monaco 仍用旧 CSS
  useEffect(() => {
    if (!monacoRef.current) return;
    applyEditorTheme(monacoRef.current, resolvedTheme);
    syncSelectionWhiteFg();
  }, [resolvedTheme, syncSelectionWhiteFg]);

  // 供 CSS 选择器识别当前为 Dev-C++ 主题
  useEffect(() => {
    const root = document.documentElement;
    const on = resolvedTheme === DEV_CPP_THEME_ID;
    root.classList.toggle("monaco-theme-dev-cpp", on);
    return () => {
      root.classList.remove("monaco-theme-dev-cpp");
    };
  }, [resolvedTheme]);

  const clampFontSize = (v: number) => Math.min(48, Math.max(12, Math.round(v)));

  // 测试点详情面板状态
  const [tcExpanded, setTcExpanded] = useState(false);
  const [tcData, setTcData] = useState<any[] | null>(null);
  const [tcLoading, setTcLoading] = useState(false);
  const lastResultIdRef = useRef<number | null>(null);

  // 监听评测结果变化和展开状态，声明式管理测试点数据的加载与重置
  useEffect(() => {
    if (!result?.id) {
      setTcData(null);
      lastResultIdRef.current = null;
      return;
    }

    // 如果是新的提交 ID，重置测试点数据
    if (result.id !== lastResultIdRef.current) {
      setTcData(null);
      lastResultIdRef.current = result.id;
    }

    // 展开状态且没有数据时触发加载
    if (tcExpanded && !tcData && !tcLoading) {
      if (result.testcases?.length) {
        setTcData(result.testcases);
        return;
      }
      setTcLoading(true);
      submissionApi.getTestcases(result.id)
        .then((data: any) => {
          setTcData(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          setTcData([]);
        })
        .finally(() => {
          setTcLoading(false);
        });
    }
  }, [result?.id, tcExpanded, tcData, tcLoading, result?.testcases]);

  const formatMemory = (kb: number | null | undefined): string => {
    if (kb == null) return "-";
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)}MB`;
    return `${kb}KB`;
  };

  const toggleTestcases = useCallback(() => {
    setTcExpanded((prev) => !prev);
  }, []);

  return (
    <div id="code-editor-panel" className={`problem-split-right ${codeCollapsed ? 'is-collapsed' : ''}`} style={{
      flex: codeCollapsed ? "0 0 0px" : 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      overflow: "hidden",
      opacity: codeCollapsed ? 0 : 1,
      pointerEvents: codeCollapsed ? "none" : "auto",
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
          <Button type="primary" onClick={onSubmit} loading={submitting} disabled={submitting}>
            提交
          </Button>
          {result && (
            <Space size="small">
              <Tag color={statusColor[result.status]} style={{ fontSize: 13 }}>
                {statusLabel[result.status] || result.status}
              </Tag>
              {result.score != null && (
                <span style={{ fontWeight: 600, fontSize: 13 }}>{result.score}分</span>
              )}
              {result.timeUsed != null && (
                <span style={{ color: "var(--color-text-3)", fontSize: 12 }}>
                  {result.timeUsed}ms / {result.memoryUsed}KB
                </span>
              )}
            </Space>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            {result && result.status !== "PENDING" && result.status !== "JUDGING" && (
              <Button
                type="text"
                size="mini"
                onClick={toggleTestcases}
                style={{ fontSize: 12, color: "var(--color-text-3)" }}
              >
                {tcExpanded ? <IconDown /> : <IconRight />}
                {tcExpanded ? "收起测试点详情" : "查看测试点详情"}
              </Button>
            )}
            <Button
              type="text"
              size="mini"
              onClick={() => onCollapse(true)}
            >
              收起IDE
            </Button>
            <Popover
              trigger="click"
              position="br"
              content={
                <div style={{ width: 240 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>字体大小</div>
                    <InputNumber
                      value={editorFontSize}
                      min={12}
                      max={48}
                      step={1}
                      size="small"
                      style={{ width: "100%" }}
                      onChange={(v) => { const n = clampFontSize(v ?? 16); setEditorFontSize(n); localStorage.setItem("oj_editor_fontSize", String(n)); }}
                      suffix="px"
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>Tab 大小</div>
                    <Select
                      value={editorTabSize}
                      onChange={(v) => { setEditorTabSize(v); localStorage.setItem("oj_editor_tabSize", String(v)); }}
                      style={{ width: "100%" }}
                      size="small"
                    >
                      {[2, 4, 8].map((s) => (
                        <Select.Option key={s} value={s}>{s} 个空格</Select.Option>
                      ))}
                    </Select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>编辑器主题</div>
                    <Radio.Group
                      value={editorTheme}
                      onChange={(v) => { setEditorTheme(v); localStorage.setItem("oj_editor_theme", v); }}
                      size="small"
                      direction="vertical"
                    >
                      <Radio value="vs">亮色</Radio>
                      <Radio value="vs-dark">暗色</Radio>
                      <Radio value="auto">跟随网站</Radio>
                      <Radio value={DEV_CPP_THEME_ID}>{DEV_CPP_THEME_LABEL}</Radio>
                    </Radio.Group>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>代码补全</div>
                    <Radio.Group
                      value={codeCompletion}
                      onChange={(v) => { setCodeCompletion(v); localStorage.setItem("oj_editor_codeCompletion", String(v)); }}
                      size="small"
                    >
                      <Radio value={false}>关闭</Radio>
                      <Radio value={true}>开启</Radio>
                    </Radio.Group>
                  </div>
                </div>
              }
            >
              <Button type="text" size="mini" icon={<IconSettings />} style={{ color: "var(--color-text-3)" }} />
            </Popover>
          </div>
        </div>
        {/* 测试点详情列表，始终渲染以支持过渡动画 */}
        {result && result.status !== "PENDING" && result.status !== "JUDGING" && (
          <div style={{
            maxHeight: tcExpanded ? 380 : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease",
          }}>
            <div style={{
              marginTop: 8,
              padding: "8px 12px",
              background: "var(--color-fill-1)",
              borderRadius: 4,
              fontSize: 13,
              maxHeight: 380,
              overflowY: "auto",
            }}>
              {tcLoading ? (
                <span style={{ color: "var(--color-text-3)" }}>加载中...</span>
              ) : tcData && tcData.length > 0 ? (
                tcData.map((tc: any, i: number) => (
                  <div
                    key={tc.id || i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "4px 0",
                      borderBottom: i < tcData.length - 1 ? "1px solid var(--color-border)" : "none",
                    }}
                  >
                    <span style={{ color: "var(--color-text-3)", minWidth: 32 }}>#{i + 1}</span>
                    <Tag color={statusColor[tc.status]} size="small">
                      {statusLabel[tc.status] || tc.status}
                    </Tag>
                    <span style={{ color: "var(--color-text-3)", fontSize: 12, minWidth: 64 }}>
                      {tc.timeUsed != null ? `${tc.timeUsed}ms` : "-"}
                    </span>
                    <span style={{ color: "var(--color-text-3)", fontSize: 12 }}>
                      {formatMemory(tc.memoryUsed)}
                    </span>
                  </div>
                ))
              ) : (
                <span style={{ color: "var(--color-text-3)" }}>暂无测试点数据</span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 代码编辑器 */}
      <div style={{ flex: 2, border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden", minHeight: 0 }}>
        <Editor
          height="100%"
          language={langMap[language]}
          value={code}
          onChange={(v) => setCode(v || "")}
          theme={resolvedTheme}
          beforeMount={(monaco) => {
            registerMonacoExtras(monaco);
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            // 挂载时强制刷一次主题 + tokenizer（压过内置 cpp grammar）
            applyEditorTheme(monaco, resolvedTheme);

            // Dev-C++ 选中白字：监听选区变化，用 inline decoration 覆盖语法色
            const subSel = editor.onDidChangeCursorSelection(() => {
              syncSelectionWhiteFg();
            });
            syncSelectionWhiteFg();

            // Ctrl+S 保存代码到本地
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
              () => {
                if (!problem) return;
                const codeValue = editor.getValue();
                if (codeValue.length > 1024 * 1024) {
                  Message.warning("代码过大，无法保存到浏览器本地");
                  return;
                }
                const uid = user?.id || "anon";
                localStorage.setItem(`oj_code_${problem.id}_${uid}`, codeValue);
                Message.success("代码已保存到浏览器本地");
              },
            );
            // Ctrl+滚轮缩放字体
            const domNode = editor.getDomNode();
            if (domNode) {
              const handler = (e: WheelEvent) => {
                if (!e.ctrlKey && !e.metaKey) return;
                e.preventDefault();
                const delta = e.deltaY > 0 ? -1 : 1;
                const next = clampFontSize(fontSizeRef.current + delta);
                setEditorFontSize(next);
                localStorage.setItem("oj_editor_fontSize", String(next));
              };
              domNode.addEventListener("wheel", handler, { passive: false });
              editor.onDidDispose(() => {
                subSel.dispose();
                domNode.removeEventListener("wheel", handler);
                selDecoRef.current = [];
              });
            } else {
              editor.onDidDispose(() => {
                subSel.dispose();
                selDecoRef.current = [];
              });
            }
          }}
          options={{
            fontSize: editorFontSize,
            fontFamily: 'Consolas, "Courier New", monospace',
            fontLigatures: false,
            renderLineHighlight: "all",
            // 关闭选中时把空格渲染成中间点 ·
            renderWhitespace: "none",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: editorTabSize,
            quickSuggestions: codeCompletion,
            suggestOnTriggerCharacters: codeCompletion,
            wordBasedSuggestions: codeCompletion,
            // Dev-C++：关闭括号对着色，否则会盖掉 token 的 #FF0000
            bracketPairColorization: {
              enabled: resolvedTheme !== DEV_CPP_THEME_ID,
            },
            matchBrackets: resolvedTheme === DEV_CPP_THEME_ID ? "never" : "always",
            // Dev-C++：关闭「选中/光标所在词」的其它出现位置浅色高亮
            selectionHighlight: resolvedTheme !== DEV_CPP_THEME_ID,
            occurrencesHighlight: (resolvedTheme === DEV_CPP_THEME_ID ? false : true) as any,
          }}
        />
      </div>

      {/* 输入输出测试区 */}
      <TestArea
        testInput={testInput}
        setTestInput={setTestInput}
        testOutput={testOutput}
        setTestOutput={setTestOutput}
        actualOutput={actualOutput}
        testing={testing}
        onTest={onTest}
        onClear={onClear}
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
      />
    </div>
  );
}
