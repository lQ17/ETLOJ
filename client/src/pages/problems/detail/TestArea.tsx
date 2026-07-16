import { Button, Input, Modal } from "@arco-design/web-react";
import { IconPlayArrow, IconExpand, IconShrink, IconDelete } from "@arco-design/web-react/icon";

interface TestAreaProps {
  testInput: string;
  setTestInput: (v: string) => void;
  testOutput: string;
  setTestOutput: (v: string) => void;
  actualOutput: string;
  testing: boolean;
  onTest: () => void;
  onClear: () => void;
  isModalVisible: boolean;
  setIsModalVisible: (v: boolean) => void;
  /** 填满父容器高度（用于可拖动分栏） */
  fillHeight?: boolean;
}

function normalizeOutput(s: string) {
  return (s || "").trim().replace(/\r\n/g, "\n").split("\n").map(l => l.trimEnd()).join("\n");
}

function getActualOutputBg(testOutput: string, actualOutput: string) {
  if (!actualOutput) return "var(--color-fill-2)";
  if (actualOutput.startsWith("[")) return "var(--color-fill-2)";
  if (!testOutput) return "var(--color-fill-2)";
  return normalizeOutput(actualOutput) === normalizeOutput(testOutput)
    ? "rgba(0,180,80,0.12)"
    : "rgba(220,50,50,0.12)";
}

function TestColumns({
  testInput,
  setTestInput,
  testOutput,
  setTestOutput,
  actualOutput,
  testing,
  onTest,
  onClear,
  gap,
  labelMargin,
  buttonMargin,
  minHeight = 120,
}: {
  testInput: string;
  setTestInput: (v: string) => void;
  testOutput: string;
  setTestOutput: (v: string) => void;
  actualOutput: string;
  testing: boolean;
  onTest: () => void;
  onClear: () => void;
  gap: number;
  labelMargin: number;
  buttonMargin: number;
  minHeight?: number;
}) {
  return (
    <div className="test-area-columns" style={{ display: "flex", gap, flex: 1, minHeight, minWidth: 0, overflow: "hidden" }}>
      <div className="test-area-col" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: labelMargin, flexShrink: 0 }}>
          自测输入
        </span>
        <Input.TextArea
          value={testInput}
          onChange={setTestInput}
          placeholder="输入测试数据..."
          className="test-area-textarea"
          style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14, minHeight: 0 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: buttonMargin, flexShrink: 0 }}>
          <Button
            type="primary"
            status="success"
            icon={<IconPlayArrow />}
            onClick={onTest}
            loading={testing}
            style={{ flex: 1 }}
          >
            测试运行
          </Button>
          <Button
            type="outline"
            status="danger"
            icon={<IconDelete />}
            onClick={onClear}
          >
            清除
          </Button>
        </div>
      </div>
      <div className="test-area-col" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: labelMargin, flexShrink: 0 }}>
          期望输出
        </span>
        <Input.TextArea
          value={testOutput}
          onChange={setTestOutput}
          placeholder="填写期望输出以便对比..."
          className="test-area-textarea"
          style={{ flex: 1, resize: "none", fontFamily: "Consolas, monospace", fontSize: 14, minHeight: 0 }}
        />
      </div>
      <div className="test-area-col" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: labelMargin, flexShrink: 0 }}>
          实际输出
        </span>
        <Input.TextArea
          value={actualOutput}
          placeholder='点击"测试运行"后显示结果...'
          readOnly
          className="test-area-textarea"
          style={{
            flex: 1,
            resize: "none",
            fontFamily: "Consolas, monospace",
            fontSize: 14,
            minHeight: 0,
            background: getActualOutputBg(testOutput, actualOutput),
            color: actualOutput.startsWith("[") ? "var(--color-error)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

export default function TestArea({
  testInput,
  setTestInput,
  testOutput,
  setTestOutput,
  actualOutput,
  testing,
  onTest,
  onClear,
  isModalVisible,
  setIsModalVisible,
  fillHeight = false,
}: TestAreaProps) {
  return (
    <div
      style={{
        position: "relative",
        ...(fillHeight
          ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }
          : { marginTop: 12 }),
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4, flexShrink: 0 }}>
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
      <TestColumns
        testInput={testInput}
        setTestInput={setTestInput}
        testOutput={testOutput}
        setTestOutput={setTestOutput}
        actualOutput={actualOutput}
        testing={testing}
        onTest={onTest}
        onClear={onClear}
        gap={12}
        labelMargin={4}
        buttonMargin={8}
        minHeight={fillHeight ? 0 : 120}
      />

      <Modal
        title="测试运行详情"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        style={{ width: "80%", top: "20px" }}
        closeIcon={<IconShrink />}
      >
        <div style={{ height: "calc(100vh - 160px)", display: "flex", flexDirection: "column", padding: "10px 0" }}>
          <TestColumns
            testInput={testInput}
            setTestInput={setTestInput}
            testOutput={testOutput}
            setTestOutput={setTestOutput}
            actualOutput={actualOutput}
            testing={testing}
            onTest={onTest}
            onClear={onClear}
            gap={32}
            labelMargin={8}
            buttonMargin={12}
          />
        </div>
      </Modal>
    </div>
  );
}
