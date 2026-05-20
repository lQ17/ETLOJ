import { useRef } from "react";
import { Select, Button, Space, Tag, Card, Popover, Radio, Message } from "@arco-design/web-react";
import { IconSettings } from "@arco-design/web-react/icon";
import Editor from "@monaco-editor/react";
import { langMap, statusLabel, statusColor } from "./constants";
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
  setActualOutput,
  onTest,
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
  const editorRef = useRef<any>(null);

  return (
    <div style={{
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
                <div style={{ width: 200 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: "var(--color-text-2)" }}>字体大小</div>
                    <Select
                      value={editorFontSize}
                      onChange={(v) => { setEditorFontSize(v); localStorage.setItem("oj_editor_fontSize", String(v)); }}
                      style={{ width: "100%" }}
                      size="small"
                    >
                      {[12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((s) => (
                        <Select.Option key={s} value={s}>{s}px</Select.Option>
                      ))}
                    </Select>
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
                    >
                      <Radio value="vs">亮色</Radio>
                      <Radio value="vs-dark">暗色</Radio>
                      <Radio value="hc-black">跟随网站</Radio>
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
      </Card>

      {/* 代码编辑器 */}
      <div style={{ flex: 2, border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden", minHeight: 0 }}>
        <Editor
          height="100%"
          language={langMap[language]}
          value={code}
          onChange={(v) => setCode(v || "")}
          theme={editorTheme}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            // Ctrl+S 保存代码到本地
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
              () => {
                if (!problem) return;
                const codeValue = editor.getValue();
                // 代码超过 1MB 则不存储，防止 localStorage 溢出
                if (codeValue.length > 1024 * 1024) {
                  Message.warning("代码过大，无法保存到浏览器本地");
                  return;
                }
                const uid = user?.id || "anon";
                localStorage.setItem(`oj_code_${problem.id}_${uid}`, codeValue);
                Message.success("代码已保存到浏览器本地");
              },
            );
          }}
          options={{
            fontSize: editorFontSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: editorTabSize,
            quickSuggestions: codeCompletion,
            suggestOnTriggerCharacters: codeCompletion,
            wordBasedSuggestions: codeCompletion,
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
        isModalVisible={isModalVisible}
        setIsModalVisible={setIsModalVisible}
      />
    </div>
  );
}
