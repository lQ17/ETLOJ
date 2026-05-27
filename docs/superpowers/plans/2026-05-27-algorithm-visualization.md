# Algorithm Visualization Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an algorithm visualization page to ETLOJ with a step-based engine, starting with 5 sorting algorithms and bar chart animation.

**Architecture:** Self-built step-based visualization engine where each algorithm exports a `generateSteps()` generator function. The engine handles playback (play/pause/step/speed), and Framer Motion renders bar chart transitions. Algorithms register in a central registry — adding new algorithms requires only creating a file and registering one line.

**Tech Stack:** React 18, Arco Design, Framer Motion, TypeScript

---

## File Structure

```
client/src/
├── algorithms/                        # NEW — algorithm definitions
│   ├── types.ts                       # VisualStep, AlgorithmDef types
│   ├── registry.ts                    # Algorithm registry + lookup
│   └── sorting/
│       ├── bubble.ts                  # 冒泡排序
│       ├── selection.ts               # 选择排序
│       ├── insertion.ts               # 插入排序
│       ├── merge.ts                   # 归并排序
│       └── quick.ts                   # 快速排序
├── components/
│   └── visual-engine/                 # NEW — visualization engine
│       ├── BarChart.tsx               # Bar chart renderer (Framer Motion)
│       ├── PlaybackController.tsx     # Play/pause/step/speed/progress controls
│       └── StepInfo.tsx               # Step description text
├── pages/
│   └── visualization/
│       └── index.tsx                  # NEW — page component
├── App.tsx                            # MODIFY — add route
└── components/
    └── AppHeader.tsx                  # MODIFY — add nav item
```

---

### Task 1: Install framer-motion

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd D:\ETLOJ_Project\client && npm install framer-motion
```

- [ ] **Step 2: Verify installation**

```bash
cd D:\ETLOJ_Project\client && node -e "const fm = require('framer-motion'); console.log('framer-motion version:', fm.motion ? 'ok' : 'fail')"
```

Expected: `framer-motion version: ok`

- [ ] **Step 3: Commit**

```bash
cd D:\ETLOJ_Project && git add client/package.json client/package-lock.json
git commit -m "deps: add framer-motion for algorithm visualization animations"
```

---

### Task 2: Create algorithm types and registry

**Files:**
- Create: `client/src/algorithms/types.ts`
- Create: `client/src/algorithms/registry.ts`

- [ ] **Step 1: Create types.ts**

Create `client/src/algorithms/types.ts`:

```ts
export interface VisualStep {
  array: number[];
  highlights: {
    comparing?: number[];
    swapping?: number[];
    sorted?: number[];
    pivot?: number;
    active?: number[];
  };
  message?: string;
}

export type AlgorithmCategory = "sorting" | "graph" | "string" | "data-structure";

export interface AlgorithmDef {
  id: string;
  name: string;
  category: AlgorithmCategory;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  defaultInput: number[];
  generateSteps(input: number[]): VisualStep[];
}
```

- [ ] **Step 2: Create registry.ts**

Create `client/src/algorithms/registry.ts`:

```ts
import type { AlgorithmDef } from "./types";

const algorithms: AlgorithmDef[] = [];

export function registerAlgorithm(algo: AlgorithmDef) {
  algorithms.push(algo);
}

export function getAllAlgorithms(): AlgorithmDef[] {
  return algorithms;
}

export function getAlgorithmsByCategory(category: string): AlgorithmDef[] {
  return algorithms.filter((a) => a.category === category);
}

export function getAlgorithmById(id: string): AlgorithmDef | undefined {
  return algorithms.find((a) => a.id === id);
}

export function getCategories(): string[] {
  return [...new Set(algorithms.map((a) => a.category))];
}
```

- [ ] **Step 3: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/algorithms/types.ts client/src/algorithms/registry.ts
git commit -m "feat: add algorithm types and registry"
```

---

### Task 3: Implement 5 sorting algorithms

**Files:**
- Create: `client/src/algorithms/sorting/bubble.ts`
- Create: `client/src/algorithms/sorting/selection.ts`
- Create: `client/src/algorithms/sorting/insertion.ts`
- Create: `client/src/algorithms/sorting/merge.ts`
- Create: `client/src/algorithms/sorting/quick.ts`

- [ ] **Step 1: Create bubble.ts**

Create `client/src/algorithms/sorting/bubble.ts`:

```ts
import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组" });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [j, j + 1], sorted: [...sorted] },
        message: `比较 arr[${j}]=${arr[j]} 和 arr[${j + 1}]=${arr[j + 1]}`,
      });

      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        steps.push({
          array: [...arr],
          highlights: { swapping: [j, j + 1], sorted: [...sorted] },
          message: `交换 arr[${j}] 和 arr[${j + 1}]`,
        });
      }
    }
    sorted.unshift(n - 1 - i);
  }

  sorted.unshift(0);
  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const bubbleSort: AlgorithmDef = {
  id: "bubble",
  name: "冒泡排序",
  category: "sorting",
  description: "重复遍历数组，比较相邻元素并交换顺序错误的元素，直到无需交换。",
  timeComplexity: "O(n²)",
  spaceComplexity: "O(1)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(bubbleSort);
export default bubbleSort;
```

- [ ] **Step 2: Create selection.ts**

Create `client/src/algorithms/sorting/selection.ts`:

```ts
import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组" });

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    steps.push({
      array: [...arr],
      highlights: { active: [i], sorted: [...sorted] },
      message: `从位置 ${i} 开始寻找最小值`,
    });

    for (let j = i + 1; j < n; j++) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [minIdx, j], active: [i], sorted: [...sorted] },
        message: `比较 arr[${minIdx}]=${arr[minIdx]} 和 arr[${j}]=${arr[j]}`,
      });

      if (arr[j] < arr[minIdx]) {
        minIdx = j;
      }
    }

    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      steps.push({
        array: [...arr],
        highlights: { swapping: [i, minIdx], sorted: [...sorted] },
        message: `交换 arr[${i}] 和 arr[${minIdx}]`,
      });
    }

    sorted.push(i);
  }

  sorted.push(n - 1);
  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const selectionSort: AlgorithmDef = {
  id: "selection",
  name: "选择排序",
  category: "sorting",
  description: "每次从未排序区间选出最小元素，放到已排序区间的末尾。",
  timeComplexity: "O(n²)",
  spaceComplexity: "O(1)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(selectionSort);
export default selectionSort;
```

- [ ] **Step 3: Create insertion.ts**

Create `client/src/algorithms/sorting/insertion.ts`:

```ts
import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [0];

  steps.push({
    array: [...arr],
    highlights: { sorted: [0] },
    message: "初始数组，第一个元素视为已排序",
  });

  for (let i = 1; i < n; i++) {
    const key = arr[i];
    let j = i - 1;

    steps.push({
      array: [...arr],
      highlights: { active: [i], sorted: [...sorted] },
      message: `取出 arr[${i}]=${key}，准备插入已排序区间`,
    });

    while (j >= 0 && arr[j] > key) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [j, j + 1], sorted: [...sorted] },
        message: `arr[${j}]=${arr[j]} > ${key}，右移`,
      });

      arr[j + 1] = arr[j];
      j--;

      steps.push({
        array: [...arr],
        highlights: { swapping: [j + 1, j + 2], sorted: [...sorted] },
        message: `右移完成`,
      });
    }

    arr[j + 1] = key;
    sorted.push(i);

    steps.push({
      array: [...arr],
      highlights: { sorted: [...sorted] },
      message: `将 ${key} 插入到位置 ${j + 1}`,
    });
  }

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const insertionSort: AlgorithmDef = {
  id: "insertion",
  name: "插入排序",
  category: "sorting",
  description: "将每个元素插入到已排序区间的正确位置，类似整理扑克牌。",
  timeComplexity: "O(n²)",
  spaceComplexity: "O(1)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(insertionSort);
export default insertionSort;
```

- [ ] **Step 4: Create merge.ts**

Create `client/src/algorithms/sorting/merge.ts`:

```ts
import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组" });

  function mergeSort(left: number, right: number) {
    if (left >= right) return;

    const mid = Math.floor((left + right) / 2);

    steps.push({
      array: [...arr],
      highlights: { active: Array.from({ length: right - left + 1 }, (_, i) => left + i), sorted: [...sorted] },
      message: `分治：排序区间 [${left}, ${right}]`,
    });

    mergeSort(left, mid);
    mergeSort(mid + 1, right);

    // Merge
    const temp: number[] = [];
    let i = left, j = mid + 1;

    while (i <= mid && j <= right) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [i, j], sorted: [...sorted] },
        message: `比较 arr[${i}]=${arr[i]} 和 arr[${j}]=${arr[j]}`,
      });

      if (arr[i] <= arr[j]) {
        temp.push(arr[i++]);
      } else {
        temp.push(arr[j++]);
      }
    }

    while (i <= mid) temp.push(arr[i++]);
    while (j <= right) temp.push(arr[j++]);

    for (let k = 0; k < temp.length; k++) {
      arr[left + k] = temp[k];
    }

    if (left === 0 && right === n - 1) {
      for (let k = 0; k < n; k++) sorted.push(k);
    }

    steps.push({
      array: [...arr],
      highlights: { active: Array.from({ length: right - left + 1 }, (_, i) => left + i), sorted: [...sorted] },
      message: `合并完成：[${left}, ${right}]`,
    });
  }

  mergeSort(0, n - 1);

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const mergeSort: AlgorithmDef = {
  id: "merge",
  name: "归并排序",
  category: "sorting",
  description: "分治法：将数组分成两半分别排序，再合并两个有序数组。稳定排序。",
  timeComplexity: "O(n log n)",
  spaceComplexity: "O(n)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(mergeSort);
export default mergeSort;
```

- [ ] **Step 5: Create quick.ts**

Create `client/src/algorithms/sorting/quick.ts`:

```ts
import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组" });

  function quickSort(low: number, high: number) {
    if (low >= high) {
      if (low === high) sorted.push(low);
      return;
    }

    const pivot = arr[high];
    let i = low;

    steps.push({
      array: [...arr],
      highlights: { pivot: high, active: Array.from({ length: high - low + 1 }, (_, k) => low + k), sorted: [...sorted] },
      message: `选择 pivot = arr[${high}]=${pivot}，分区 [${low}, ${high}]`,
    });

    for (let j = low; j < high; j++) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [j, high], pivot: high, sorted: [...sorted] },
        message: `比较 arr[${j}]=${arr[j]} 和 pivot=${pivot}`,
      });

      if (arr[j] < pivot) {
        if (i !== j) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          steps.push({
            array: [...arr],
            highlights: { swapping: [i, j], pivot: high, sorted: [...sorted] },
            message: `交换 arr[${i}] 和 arr[${j}]`,
          });
        }
        i++;
      }
    }

    if (i !== high) {
      [arr[i], arr[high]] = [arr[high], arr[i]];
      steps.push({
        array: [...arr],
        highlights: { swapping: [i, high], sorted: [...sorted] },
        message: `将 pivot 放到最终位置 ${i}`,
      });
    }

    sorted.push(i);

    quickSort(low, i - 1);
    quickSort(i + 1, high);
  }

  quickSort(0, n - 1);

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const quickSort: AlgorithmDef = {
  id: "quick",
  name: "快速排序",
  category: "sorting",
  description: "分治法：选一个基准值，将数组分为小于和大于基准的两部分，递归排序。",
  timeComplexity: "O(n log n) 平均",
  spaceComplexity: "O(log n)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(quickSort);
export default quickSort;
```

- [ ] **Step 6: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/algorithms/sorting/
git commit -m "feat: implement 5 sorting algorithms (bubble, selection, insertion, merge, quick)"
```

---

### Task 4: Create BarChart visualization component

**Files:**
- Create: `client/src/components/visual-engine/BarChart.tsx`

- [ ] **Step 1: Create BarChart.tsx**

Create `client/src/components/visual-engine/BarChart.tsx`:

```tsx
import { motion } from "framer-motion";
import type { VisualStep } from "../../algorithms/types";

interface BarChartProps {
  step: VisualStep;
}

const COLORS = {
  default: "#165DFF",
  comparing: "#FF7D00",
  swapping: "#F53F3F",
  sorted: "#00B42A",
  pivot: "#722ED1",
  active: "#86909C",
};

function getBarColor(index: number, highlights: VisualStep["highlights"]): string {
  if (highlights.sorted?.includes(index)) return COLORS.sorted;
  if (highlights.swapping?.includes(index)) return COLORS.swapping;
  if (highlights.comparing?.includes(index)) return COLORS.comparing;
  if (highlights.pivot === index) return COLORS.pivot;
  if (highlights.active?.includes(index)) return COLORS.active;
  return COLORS.default;
}

export default function BarChart({ step }: BarChartProps) {
  const { array, highlights } = step;
  const maxVal = Math.max(...array, 1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 2,
        height: "100%",
        padding: "20px 10px 0",
      }}
    >
      {array.map((value, index) => {
        const heightPct = (value / maxVal) * 100;
        const color = getBarColor(index, highlights);

        return (
          <motion.div
            key={index}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              width: `${Math.max(100 / array.length - 1, 2)}%`,
              maxWidth: 60,
              minWidth: 8,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {array.length <= 30 && (
              <motion.span
                animate={{ color }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: array.length <= 15 ? 12 : 10,
                  marginBottom: 4,
                  fontWeight: 500,
                  color: "var(--color-text-2)",
                }}
              >
                {value}
              </motion.span>
            )}
            <motion.div
              animate={{
                height: `${heightPct}%`,
                backgroundColor: color,
              }}
              transition={{ duration: 0.2 }}
              style={{
                width: "100%",
                borderRadius: "3px 3px 0 0",
                minHeight: 4,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/components/visual-engine/BarChart.tsx
git commit -m "feat: add BarChart visualization component with Framer Motion"
```

---

### Task 5: Create PlaybackController component

**Files:**
- Create: `client/src/components/visual-engine/PlaybackController.tsx`

- [ ] **Step 1: Create PlaybackController.tsx**

Create `client/src/components/visual-engine/PlaybackController.tsx`:

```tsx
import { Button, Select, Space, Slider, Message } from "@arco-design/web-react";
import {
  IconPlayArrow,
  IconPause,
  IconLeft,
  IconRight,
  IconRefresh,
} from "@arco-design/web-react/icon";

const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "2x", value: 2 },
  { label: "4x", value: 4 },
];

interface PlaybackControllerProps {
  status: "idle" | "playing" | "paused";
  currentStep: number;
  totalSteps: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (step: number) => void;
  disabled: boolean;
}

export default function PlaybackController({
  status,
  currentStep,
  totalSteps,
  speed,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
  onSpeedChange,
  onSeek,
  disabled,
}: PlaybackControllerProps) {
  const isIdle = status === "idle";
  const isPlaying = status === "playing";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        background: "var(--color-bg-2)",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
      }}
    >
      <Space>
        <Button
          size="small"
          icon={<IconRefresh />}
          onClick={onReset}
          disabled={disabled || isIdle}
        />
        <Button
          size="small"
          icon={<IconLeft />}
          onClick={onPrev}
          disabled={disabled || isIdle || currentStep === 0}
        />
        <Button
          type="primary"
          size="small"
          icon={isPlaying ? <IconPause /> : <IconPlayArrow />}
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled || (isIdle && totalSteps === 0)}
        />
        <Button
          size="small"
          icon={<IconRight />}
          onClick={onNext}
          disabled={disabled || isIdle || currentStep >= totalSteps - 1}
        />
      </Space>

      <div style={{ flex: 1, minWidth: 120 }}>
        <Slider
          value={totalSteps > 1 ? currentStep : 0}
          max={Math.max(totalSteps - 1, 1)}
          min={0}
          step={1}
          onChange={(val) => onSeek(val as number)}
          disabled={disabled || totalSteps <= 1}
          showInput={false}
          style={{ margin: 0 }}
        />
      </div>

      <span style={{ fontSize: 13, color: "var(--color-text-3)", minWidth: 70, textAlign: "center" }}>
        {totalSteps > 0 ? `${currentStep + 1} / ${totalSteps}` : "0 / 0"}
      </span>

      <Select
        size="small"
        style={{ width: 72 }}
        value={speed}
        options={SPEED_OPTIONS}
        onChange={(val) => onSpeedChange(val as number)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/components/visual-engine/PlaybackController.tsx
git commit -m "feat: add PlaybackController component"
```

---

### Task 6: Create StepInfo component

**Files:**
- Create: `client/src/components/visual-engine/StepInfo.tsx`

- [ ] **Step 1: Create StepInfo.tsx**

Create `client/src/components/visual-engine/StepInfo.tsx`:

```tsx
import { Typography } from "@arco-design/web-react";

interface StepInfoProps {
  message?: string;
}

export default function StepInfo({ message }: StepInfoProps) {
  if (!message) return null;

  return (
    <div
      style={{
        textAlign: "center",
        padding: "8px 16px",
        fontSize: 14,
        color: "var(--color-text-2)",
        minHeight: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography.Text style={{ color: "inherit" }}>{message}</Typography.Text>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/components/visual-engine/StepInfo.tsx
git commit -m "feat: add StepInfo component"
```

---

### Task 7: Create VisualizationPage

**Files:**
- Create: `client/src/pages/visualization/index.tsx`

- [ ] **Step 1: Create the page component**

Create `client/src/pages/visualization/index.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Input, Button, Space, Typography, Card, Message } from "@arco-design/web-react";
import { IconLoop } from "@arco-design/web-react/icon";
import BarChart from "../../components/visual-engine/BarChart";
import PlaybackController from "../../components/visual-engine/PlaybackController";
import StepInfo from "../../components/visual-engine/StepInfo";
import type { VisualStep, AlgorithmDef, AlgorithmCategory } from "../../algorithms/types";
import { getAllAlgorithms, getAlgorithmsByCategory } from "../../algorithms/registry";

// Import all algorithms to trigger registration
import "../../algorithms/sorting/bubble";
import "../../algorithms/sorting/selection";
import "../../algorithms/sorting/insertion";
import "../../algorithms/sorting/merge";
import "../../algorithms/sorting/quick";

const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  sorting: "排序",
  graph: "图论",
  string: "字符串",
  "data-structure": "数据结构",
};

const BASE_INTERVAL = 800;

function randomArray(): number[] {
  const len = 10 + Math.floor(Math.random() * 21); // 10~30
  return Array.from({ length: len }, () => 5 + Math.floor(Math.random() * 96));
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
  const timerRef = useRef<number | null>(null);

  const categoryAlgos = getAlgorithmsByCategory(category);

  // Reset when algorithm changes
  useEffect(() => {
    handleReset();
    setInputText(selectedAlgo.defaultInput.join(", "));
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
    const parts = inputText.split(",").map((s) => s.trim());
    const nums: number[] = [];
    for (const p of parts) {
      if (p === "") continue;
      const n = Number(p);
      if (isNaN(n)) {
        Message.warning("输入包含非数字字符，请用逗号分隔数字");
        return;
      }
      nums.push(n);
    }
    if (nums.length === 0) {
      Message.warning("请输入至少一个数字");
      return;
    }
    if (nums.length > 50) {
      Message.warning("最多支持 50 个元素");
      return;
    }

    const newSteps = selectedAlgo.generateSteps(nums);
    setSteps(newSteps);
    setCurrentStep(0);
    setStatus("idle");
  }, [inputText, selectedAlgo]);

  const handleRandom = useCallback(() => {
    const arr = randomArray();
    setInputText(arr.join(", "));
    const newSteps = selectedAlgo.generateSteps(arr);
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
      <div style={{ display: "flex", gap: 20, minHeight: 400 }}>
        {/* Left panel */}
        <Card
          size="small"
          style={{ width: 280, flexShrink: 0 }}
          title="输入数据"
        >
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Input.TextArea
              value={inputText}
              onChange={setInputText}
              placeholder="输入逗号分隔的数字，如: 5, 3, 8, 1, 9"
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
            </div>
          </Space>
        </Card>

        {/* Chart area */}
        <Card
          size="small"
          style={{ flex: 1 }}
          bodyStyle={{ padding: 0, height: "100%", display: "flex", flexDirection: "column" }}
        >
          <div style={{ flex: 1, minHeight: 300 }}>
            {currentVisual ? (
              <BarChart step={currentVisual} />
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
```

- [ ] **Step 2: Verify dev server starts**

```bash
cd D:\ETLOJ_Project\client && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors (or only unrelated pre-existing errors).

- [ ] **Step 3: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/pages/visualization/index.tsx
git commit -m "feat: add algorithm visualization page"
```

---

### Task 8: Wire up routing and navigation

**Files:**
- Modify: `client/src/components/AppHeader.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add nav item to AppHeader.tsx**

In `client/src/components/AppHeader.tsx`, add the new menu item after "排名":

```ts
const menuItems = [
  { key: "/", label: "首页" },
  { key: "/problems", label: "题库" },
  { key: "/lists", label: "题单" },
  { key: "/records", label: "评测记录" },
  { key: "/ranking", label: "排名" },
  { key: "/visualization", label: "可视化" },
];
```

- [ ] **Step 2: Add route to App.tsx**

In `client/src/App.tsx`, add the import and route:

Add import after the existing imports (around line 14):

```ts
import VisualizationPage from "./pages/visualization";
```

Add route after the ranking route (around line 77):

```ts
<Route path="/visualization" element={<VisualizationPage />} />
```

- [ ] **Step 3: Verify the page loads**

```bash
cd D:\ETLOJ_Project\client && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
cd D:\ETLOJ_Project && git add client/src/components/AppHeader.tsx client/src/App.tsx
git commit -m "feat: add visualization route and nav item"
```

---

### Task 9: Final verification and integration test

- [ ] **Step 1: Run full type check**

```bash
cd D:\ETLOJ_Project\client && npx tsc --noEmit --pretty
```

Expected: No errors related to the visualization feature.

- [ ] **Step 2: Start dev server and verify in browser**

```bash
cd D:\ETLOJ_Project\client && npm run dev
```

Open `http://localhost:5173/visualization` in browser. Verify:
1. Nav bar shows "可视化" after "排名"
2. Category tabs render (at least "排序")
3. Algorithm buttons render (5 sorting algorithms)
4. "随机生成" creates bars and shows animation
5. Play/pause/step controls work
6. Speed selector changes animation speed
7. Algorithm switch resets state
8. Input validation shows toast for invalid input

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
cd D:\ETLOJ_Project && git add -A && git commit -m "fix: polish algorithm visualization based on manual testing"
```
