import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Input, Button, Space, Typography, Card, Message } from "@arco-design/web-react";
import { IconLoop, IconHome } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import BarChart from "../../components/visual-engine/BarChart";
import GridChart from "../../components/visual-engine/GridChart";
import PlaybackController from "../../components/visual-engine/PlaybackController";
import StepInfo from "../../components/visual-engine/StepInfo";
import CodeViewer from "../../components/visual-engine/CodeViewer";
import type { VisualStep, AlgorithmDef, AlgorithmCategory, InteractiveOp } from "../../algorithms/types";
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
import "../../algorithms/graph/bfs-grid";
import "../../algorithms/graph/dfs-grid";

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

function InteractiveOpControl({ op, algoState, onExecute }: { op: InteractiveOp; algoState: unknown; onExecute: (steps: VisualStep[]) => void }) {
  const [params, setParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const inp of op.inputs) {
      initial[inp.name] = String(inp.default ?? 0);
    }
    return initial;
  });

  const handleExecute = () => {
    const numericParams: Record<string, number> = {};
    for (const inp of op.inputs) {
      numericParams[inp.name] = Number(params[inp.name]) || 0;
    }
    const newSteps = op.execute(algoState, numericParams);
    if (newSteps.length > 0) {
      onExecute(newSteps);
    }
  };

  return (
    <div style={{ background: "var(--color-fill-1)", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-text-2)" }}>{op.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {op.inputs.map((inp) => (
          <label key={inp.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-text-3)" }}>
            {inp.label}
            <input
              type="number"
              value={params[inp.name] ?? ""}
              onChange={(e) => setParams((prev) => ({ ...prev, [inp.name]: e.target.value }))}
              style={{ width: 60, fontFamily: "monospace", fontSize: 12, padding: "2px 6px", border: "1px solid var(--color-border)", borderRadius: 4 }}
            />
          </label>
        ))}
        <Button type="primary" size="mini" onClick={handleExecute}>
          执行
        </Button>
      </div>
    </div>
  );
}

export default function VisualizationPage() {
  const { isTablet } = useMediaQuery();
  const navigate = useNavigate();

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
  const [algoState, setAlgoState] = useState<unknown>(null);
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

    const result = selectedAlgo.generateSteps(nums, target);
    setSteps(result.steps);
    setAlgoState(result.state ?? null);
    setCurrentStep(0);
    setStatus("idle");
  }, [inputText, targetText, selectedAlgo]);

  const handleRandom = useCallback(() => {
    let arr: number[];
    if (selectedAlgo.randomInput) {
      arr = selectedAlgo.randomInput();
      if (selectedAlgo.inputDimension === "2d") {
        const C = Math.ceil(Math.sqrt(arr.length));
        const R = Math.ceil(arr.length / C);
        const grid: number[][] = [];
        for (let i = 0; i < R; i++) {
          grid.push(arr.slice(i * C, (i + 1) * C));
        }
        setInputText(grid.map((row) => row.join(", ")).join("; "));
      } else {
        setInputText(arr.join(", "));
      }
    } else if (selectedAlgo.inputDimension === "2d") {
      const grid = randomGrid();
      setInputText(grid.map((row) => row.join(", ")).join("; "));
      arr = grid.flat();
    } else {
      arr = randomArray();
      if (selectedAlgo.category === "searching") {
        arr.sort((a, b) => a - b);
      }
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

    const result = selectedAlgo.generateSteps(arr, target);
    setSteps(result.steps);
    setAlgoState(result.state ?? null);
    setCurrentStep(0);
    setStatus("idle");
  }, [selectedAlgo]);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSteps([]);
    setCurrentStep(0);
    setStatus("idle");
    setAlgoState(null);
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

  if (isTablet) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 200px)",
        padding: "40px 24px",
        textAlign: "center",
      }}>
        {/* 精美科技感插图 */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          {/* 背景光晕 */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 180,
            height: 180,
            background: "radial-gradient(circle, rgba(78, 89, 255, 0.2) 0%, rgba(78, 89, 255, 0) 70%)",
            borderRadius: "50%",
            filter: "blur(20px)",
            pointerEvents: "none",
            animation: "pulse 3s infinite ease-in-out"
          }} />
          
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="screen-grad" x1="10" y1="10" x2="110" y2="90" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4E59FF" />
                <stop offset="100%" stopColor="#00D2FF" />
              </linearGradient>
              <filter id="shadow" x="0" y="0" width="120" height="120" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#4E59FF" floodOpacity="0.15" />
              </filter>
            </defs>
            {/* Monitor outline */}
            <rect x="15" y="15" width="90" height="60" rx="6" stroke="url(#screen-grad)" strokeWidth="3" filter="url(#shadow)" />
            {/* Screen inner details - code lines representation */}
            <path d="M25 28 H75 M25 38 H60 M25 48 H85 M25 58 H45" stroke="var(--color-text-4)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
            <circle cx="85" cy="58" r="4" fill="#00D2FF" />
            <circle cx="73" cy="38" r="3" fill="#4E59FF" />
            {/* Stand */}
            <path d="M50 75 L45 95 H75 L70 75 Z" fill="url(#screen-grad)" opacity="0.8" />
            <path d="M35 95 H85" stroke="url(#screen-grad)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <Typography.Title heading={4} style={{
          margin: "0 0 12px",
          background: "linear-gradient(90deg, #4E59FF 0%, #00D2FF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: 700,
          letterSpacing: "0.5px"
        }}>
          算法可视化引擎
        </Typography.Title>
        
        <Typography.Paragraph style={{
          maxWidth: 400,
          margin: "0 0 32px",
          fontSize: 14,
          color: "var(--color-text-2)",
          lineHeight: "1.6",
        }}>
          为保障最佳的视觉呈现与完整的交互操作体验，请使用电脑端设备（屏幕宽度 ≥ 1024px）访问此页面。
        </Typography.Paragraph>

        <Button 
          type="primary" 
          icon={<IconHome />} 
          size="large"
          onClick={() => navigate("/")}
          style={{
            borderRadius: 24,
            padding: "0 28px",
            background: "linear-gradient(90deg, #4E59FF 0%, #00C6FF 100%)",
            border: "none",
            boxShadow: "0 8px 16px rgba(78, 89, 255, 0.25)",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          返回首页
        </Button>

        {/* CSS Keyframes for animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.5; }
            50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.5; }
          }
        `}} />
      </div>
    );
  }

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

            {selectedAlgo.interactive && selectedAlgo.interactive.length > 0 && algoState !== null && (
              <div>
                <div style={{ marginBottom: 8, fontSize: 13, color: "var(--color-text-3)", fontWeight: 600 }}>交互操作</div>
                <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  {selectedAlgo.interactive.map((op) => (
                    <InteractiveOpControl key={op.name} op={op} algoState={algoState} onExecute={(newSteps) => {
                      setSteps((prev) => [...prev, ...newSteps]);
                      setCurrentStep(steps.length + newSteps.length - 1);
                    }} />
                  ))}
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
              currentVisual.highlights.grids ? (
                <GridChart grids={currentVisual.highlights.grids as import("../../components/visual-engine/GridChart").GridData[]} />
              ) : currentVisual.highlights.grid ? (
                <GridChart grids={[{ grid: currentVisual.highlights.grid, highlights: currentVisual.highlights }]} />
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
