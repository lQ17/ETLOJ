import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Input, Button, Space, Typography, Card, Message } from "@arco-design/web-react";
import { IconLoop } from "@arco-design/web-react/icon";
import BarChart from "../../components/visual-engine/BarChart";
import GridChart from "../../components/visual-engine/GridChart";
import PlaybackController from "../../components/visual-engine/PlaybackController";
import StepInfo from "../../components/visual-engine/StepInfo";
import CodeViewer from "../../components/visual-engine/CodeViewer";
import type { VisualStep, AlgorithmDef, AlgorithmCategory } from "../../algorithms/types";
import { getAllAlgorithms, getAlgorithmsByCategory } from "../../algorithms/registry";

// Import all algorithms to trigger registration
import "../../algorithms/sorting/bubble";
import "../../algorithms/sorting/selection";
import "../../algorithms/sorting/insertion";
import "../../algorithms/sorting/merge";
import "../../algorithms/sorting/quick";
import "../../algorithms/searching/binary-search";
import "../../algorithms/searching/lower-bound";
import "../../algorithms/searching/upper-bound";
import "../../algorithms/prefix-diff/prefix-sum-1d";
import "../../algorithms/prefix-diff/diff-array-1d";
import "../../algorithms/prefix-diff/prefix-sum-2d";
import "../../algorithms/prefix-diff/diff-array-2d";

const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  sorting: "排序",
  graph: "图论",
  string: "字符串",
  "data-structure": "数据结构",
  searching: "查找",
  "prefix-diff": "前缀和与差分",
};

const BASE_INTERVAL = 800;

function randomArray(): number[] {
  const len = 10 + Math.floor(Math.random() * 21); // 10~30
  return Array.from({ length: len }, () => 5 + Math.floor(Math.random() * 96));
}

function randomGrid(): number[][] {
  const rows = 3 + Math.floor(Math.random() * 4); // 3~6
  const cols = 3 + Math.floor(Math.random() * 4); // 3~6
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 1 + Math.floor(Math.random() * 50))
  );
}

export default function VisualizationPage() {
  const allAlgos = getAllAlgorithms();
  const categories = [...new Set(allAlgos.map((a) => a.category))] as AlgorithmCategory[];

  const [category, setCategory] = useState<AlgorithmCategory>(categories[0] || "sorting");
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmDef>(allAlgos[0]);
  const [inputText, setInputText] = useState(selectedAlgo.defaultInput.join(", "));
  const [steps, setSteps] = useState<VisualStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [speed, setSpeed] = useState(1);
  const [targetText, setTargetText] = useState(String(selectedAlgo.defaultTarget ?? ""));
  const timerRef = useRef<number | null>(null);

  const categoryAlgos = getAlgorithmsByCategory(category);

  // Reset when algorithm changes
  useEffect(() => {
    handleReset();
    if (selectedAlgo.inputDimension === "2d") {
      const defaultGrid = selectedAlgo.defaultInput;
      const cols = Math.ceil(Math.sqrt(defaultGrid.length));
      const rows = Math.ceil(defaultGrid.length / cols);
      const grid: number[][] = [];
      for (let i = 0; i < rows; i++) {
        grid.push(defaultGrid.slice(i * cols, (i + 1) * cols));
      }
      setInputText(grid.map((row) => row.join(", ")).join("; "));
    } else {
      setInputText(selectedAlgo.defaultInput.join(", "));
    }
    setTargetText(String(selectedAlgo.defaultTarget ?? ""));
  }, [selectedAlgo]);

  // Auto-play timer
  useEffect(() => {
    if (status === "playing") {
      timerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setStatus("paused");
            return prev;
          }
          return prev + 1;
        });
      }, BASE_INTERVAL / speed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, speed, steps.length]);

  // Stop at last step
  useEffect(() => {
    if (currentStep >= steps.length - 1 && status === "playing") {
      setStatus("paused");
    }
  }, [currentStep, steps.length, status]);

  const handleApply = useCallback(() => {
    let nums: number[] = [];

    if (selectedAlgo.inputDimension === "2d") {
      const rows = inputText.split(";").map((s) => s.trim()).filter((s) => s !== "");
      if (rows.length === 0) {
        Message.warning("请输入矩阵数据，如: 1,2,3;4,5,6;7,8,9");
        return;
      }
      for (const row of rows) {
        const parts = row.split(",").map((s) => s.trim());
        for (const p of parts) {
          if (p === "") continue;
          const n = Number(p);
          if (isNaN(n)) {
            Message.warning("输入包含非数字字符");
            return;
          }
          nums.push(n);
        }
      }
    } else {
      const parts = inputText.split(",").map((s) => s.trim());
      for (const p of parts) {
        if (p === "") continue;
        const n = Number(p);
        if (isNaN(n)) {
          Message.warning("输入包含非数字字符，请用逗号分隔数字");
          return;
        }
        nums.push(n);
      }
    }

    if (nums.length === 0) {
      Message.warning("请输入至少一个数字");
      return;
    }
    if (nums.length > 50) {
      Message.warning("最多支持 50 个元素");
      return;
    }

    const target = selectedAlgo.needTarget ? Number(targetText) : undefined;
    if (selectedAlgo.needTarget && isNaN(target as number)) {
      Message.warning("请输入目标值");
      return;
    }

    const { steps: newSteps } = selectedAlgo.generateSteps(nums, target);
    setSteps(newSteps);
    setCurrentStep(0);
    setStatus("idle");
  }, [inputText, targetText, selectedAlgo]);

  const handleRandom = useCallback(() => {
    let arr: number[];
    if (selectedAlgo.inputDimension === "2d") {
      const grid = randomGrid();
      setInputText(grid.map((row) => row.join(", ")).join("; "));
      arr = grid.flat();
    } else {
      arr = randomArray();
      arr.sort((a, b) => a - b);
      setInputText(arr.join(", "));
    }

    let target: number | undefined;
    if (selectedAlgo.needTarget) {
      if (Math.random() < 0.5) {
        target = arr[Math.floor(Math.random() * arr.length)];
      } else {
        target = 1 + Math.floor(Math.random() * 100);
      }
      setTargetText(String(target));
    }

    const { steps: newSteps } = selectedAlgo.generateSteps(arr, target);
    setSteps(newSteps);
    setCurrentStep(0);
    setStatus("idle");
  }, [selectedAlgo]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSteps([]);
    setCurrentStep(0);
    setStatus("idle");
  }, []);

  const handlePlay = useCallback(() => {
    if (steps.length === 0) {
      handleApply();
      return;
    }
    if (currentStep >= steps.length - 1) {
      setCurrentStep(0);
    }
    setStatus("playing");
  }, [steps, currentStep, handleApply]);

  const handlePause = useCallback(() => {
    setStatus("paused");
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
  }, [steps.length]);

  const handleSeek = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const currentVisual = steps[currentStep];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Category + Algorithm Selection */}
      <Card size="small">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Radio.Group
            type="button"
            value={category}
            onChange={(val) => {
              setCategory(val as AlgorithmCategory);
              const algos = getAlgorithmsByCategory(val as AlgorithmCategory);
              if (algos.length > 0) setSelectedAlgo(algos[0]);
            }}
          >
            {categories.map((cat) => (
              <Radio key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </Radio>
            ))}
          </Radio.Group>

          <Radio.Group
            type="button"
            value={selectedAlgo.id}
            onChange={(val) => {
              const algo = categoryAlgos.find((a) => a.id === val);
              if (algo) setSelectedAlgo(algo);
            }}
          >
            {categoryAlgos.map((algo) => (
              <Radio key={algo.id} value={algo.id}>
                {algo.name}
              </Radio>
            ))}
          </Radio.Group>
        </Space>
      </Card>

      {/* Main area: sidebar + chart */}
      <div style={{ display: "flex", gap: 20 }}>
        {/* Left panel */}
        <Card
          size="small"
          style={{ width: 500, flexShrink: 0 }}
          title="输入数据"
        >
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Input.TextArea
              value={inputText}
              onChange={setInputText}
              placeholder={selectedAlgo.inputDimension === "2d" ? "输入矩阵，如: 1,2,3;4,5,6;7,8,9" : "输入逗号分隔的数字，如: 5, 3, 8, 1, 9"}
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ fontFamily: "monospace" }}
            />
            <Space>
              <Button type="primary" size="small" onClick={handleApply}>
                应用
              </Button>
              <Button size="small" icon={<IconLoop />} onClick={handleRandom}>
                随机生成
              </Button>
            </Space>

            {selectedAlgo.needTarget && (
              <div>
                <div style={{ marginBottom: 4, fontSize: 13, color: "var(--color-text-3)" }}>目标值 (target)</div>
                <Space>
                  <Input
                    value={targetText}
                    onChange={setTargetText}
                    placeholder="输入目标数字"
                    style={{ width: 140, fontFamily: "monospace" }}
                    onPressEnter={handleApply}
                  />
                  <Button
                    size="small"
                    icon={<IconLoop />}
                    onClick={() => {
                      const arr = inputText.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n));
                      if (arr.length > 0) {
                        const t = arr[Math.floor(Math.random() * arr.length)];
                        setTargetText(String(t));
                      }
                    }}
                  >
                    随机
                  </Button>
                </Space>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
              <Typography.Title heading={6} style={{ margin: "0 0 8px" }}>
                {selectedAlgo.name}
              </Typography.Title>
              <Typography.Paragraph
                style={{ margin: 0, fontSize: 13, color: "var(--color-text-3)" }}
              >
                {selectedAlgo.description}
              </Typography.Paragraph>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-3)" }}>
                <div>时间复杂度：{selectedAlgo.timeComplexity}</div>
                <div>空间复杂度：{selectedAlgo.spaceComplexity}</div>
              </div>

              {selectedAlgo.sourceCode && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
                  <CodeViewer
                    sourceCode={selectedAlgo.sourceCode}
                    activeLine={currentVisual?.line}
                    variables={currentVisual?.variables}
                    array={currentVisual?.array}
                  />
                </div>
              )}
            </div>
          </Space>
        </Card>

        {/* Chart area */}
        <Card
          size="small"
          style={{ flex: 1 }}
          bodyStyle={{ padding: 0, height: "100%", display: "flex", flexDirection: "column" }}
        >
          <div style={{ flex: 1 }}>
            {currentVisual ? (
              currentVisual.highlights.grid ? (
                <GridChart grid={currentVisual.highlights.grid} highlights={currentVisual.highlights} />
              ) : (
                <BarChart step={currentVisual} bars={currentVisual.bars} />
              )
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-3)",
                  fontSize: 14,
                }}
              >
                点击"应用"或"随机生成"加载数据，然后点击播放
              </div>
            )}
          </div>
          {currentVisual && <StepInfo message={currentVisual.message} />}
        </Card>
      </div>

      {/* Playback controls */}
      <PlaybackController
        status={status}
        currentStep={currentStep}
        totalSteps={steps.length}
        speed={speed}
        onPlay={handlePlay}
        onPause={handlePause}
        onPrev={handlePrev}
        onNext={handleNext}
        onReset={handleReset}
        onSpeedChange={setSpeed}
        onSeek={handleSeek}
        disabled={steps.length === 0 && status === "idle"}
      />
    </div>
  );
}
