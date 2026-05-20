import React from "react";
import { Button, Input, Modal } from "@arco-design/web-react";
import { IconPlayArrow, IconExpand, IconShrink } from "@arco-design/web-react/icon";

interface TestAreaProps {
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

function TestColumns({
  testInput,
  setTestInput,
  testOutput,
  setTestOutput,
  actualOutput,
  testing,
  onTest,
  gap,
  labelMargin,
  buttonMargin,
}: {
  testInput: string;
  setTestInput: (v: string) => void;
  testOutput: string;
  setTestOutput: (v: string) => void;
  actualOutput: string;
  testing: boolean;
  onTest: () => void;
  gap: number;
  labelMargin: number;
  buttonMargin: number;
}) {
  return (
    <div style={{ display: "flex", gap, flex: 1, minHeight: 120 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: labelMargin }}>
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
          onClick={onTest}
          loading={testing}
          style={{ marginTop: buttonMargin }}
          long
        >
          测试运行
        </Button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: labelMargin }}>
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
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-2)", marginBottom: labelMargin }}>
          实际输出
        </span>
        <Input.TextArea
          value={actualOutput}
          placeholder='点击"测试运行"后显示结果...'
          readOnly
          style={{
            flex: 1,
            resize: "none",
            fontFamily: "Consolas, monospace",
            fontSize: 14,
            background: "var(--color-fill-2)",
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
  isModalVisible,
  setIsModalVisible,
}: TestAreaProps) {
  return (
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
      <TestColumns
        testInput={testInput}
        setTestInput={setTestInput}
        testOutput={testOutput}
        setTestOutput={setTestOutput}
        actualOutput={actualOutput}
        testing={testing}
        onTest={onTest}
        gap={12}
        labelMargin={4}
        buttonMargin={8}
      />

      <Modal
        title="测试运行详情"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        style={{ width: '80%', top: '20px' }}
        closeIcon={<IconShrink />}
      >
        <div style={{ padding: "10px 0" }}>
          <TestColumns
            testInput={testInput}
            setTestInput={setTestInput}
            testOutput={testOutput}
            setTestOutput={setTestOutput}
            actualOutput={actualOutput}
            testing={testing}
            onTest={onTest}
            gap={32}
            labelMargin={8}
            buttonMargin={12}
          />
        </div>
      </Modal>
    </div>
  );
}
