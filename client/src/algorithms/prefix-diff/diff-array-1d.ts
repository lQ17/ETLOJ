import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 构建差分数组（下标从1开始）
int d[MAXN];
d[0] = 0;
for (int i = 1; i <= n; i++)
    d[i] = a[i] - a[i-1];
// 区间 [l, r] 加 val
void rangeAdd(int l, int r, int val) {
    d[l] += val;
    d[r+1] -= val;
}
// 还原数组
void restore() {
    for (int i = 1; i <= n; i++)
        d[i] += d[i-1];
}`;

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const n = input.length;
  const steps: VisualStep[] = [];

  if (n === 0) {
    return { steps: [{ array: [], highlights: {}, message: "数组为空" }] };
  }

  // 1-indexed
  const a = [0, ...input];
  const d = new Array(n + 1).fill(0);

  steps.push({
    array: a.slice(),
    highlights: {
      grid: [a.slice(), d.slice()],
    },
    message: `初始化: d[0] = 0, 数组 a[1..${n}] 已就绪`,
    line: 2,
    variables: { n },
  });

  for (let i = 1; i <= n; i++) {
    d[i] = a[i] - a[i - 1];
    steps.push({
      array: a.slice(),
      highlights: {
        grid: [a.slice(), d.slice()],
        current: [1, i],
        related: [[0, i], [0, i - 1]],
      },
      message: `d[${i}] = a[${i}] - a[${i - 1}] = ${a[i]} - ${a[i - 1]} = ${d[i]}`,
      line: 4,
      variables: { i, "a[i]": a[i], "a[i-1]": a[i - 1], "d[i]": d[i] },
    });
  }

  // Final step: clean result
  steps.push({
    array: a.slice(),
    highlights: { grid: [a.slice(), d.slice()] },
    message: "构建完成！差分数组已就绪，可使用下方交互操作进行区间加或还原",
    line: 5,
  });

  return {
    steps,
    state: { original: a, diff: [...d], n },
  };
}

function executeRangeAdd(state: unknown, params: Record<string, number>): VisualStep[] {
  const { original, diff, n } = state as { original: number[]; diff: number[]; n: number };
  const d = [...diff];
  let l = Math.max(1, Math.min(Math.floor(params.l), n));
  let r = Math.max(1, Math.min(Math.floor(params.r), n));
  if (l > r) [l, r] = [r, l];
  const val = Math.floor(params.val);

  const steps: VisualStep[] = [];

  d[l] += val;
  steps.push({
    array: original.slice(),
    highlights: { grid: [original.slice(), d.slice()], current: [1, l], updated: [[1, l]] },
    message: `区间 [${l}, ${r}] 加 ${val}: d[${l}] += ${val} → ${d[l]}`,
    line: 7,
    variables: { l, r, val, "d[l]": d[l] },
  });

  if (r + 1 <= n) {
    d[r + 1] -= val;
    steps.push({
      array: original.slice(),
      highlights: { grid: [original.slice(), d.slice()], current: [1, r + 1], updated: [[1, l], [1, r + 1]] },
      message: `d[${r + 1}] -= ${val} → ${d[r + 1]}`,
      line: 8,
      variables: { l, r, val, "d[r+1]": d[r + 1] },
    });
  }

  (state as { diff: number[] }).diff = d;

  return steps;
}

function executeRestore(state: unknown): VisualStep[] {
  const { original, diff, n } = state as { original: number[]; diff: number[]; n: number };
  const restored = [...diff];
  for (let i = 1; i <= n; i++) {
    restored[i] += restored[i - 1];
  }

  (state as { diff: number[] }).diff = restored;

  return [{
    array: original.slice(),
    highlights: {
      grid: [original.slice(), restored.slice()],
      updated: Array.from({ length: n + 1 }, (_, i) => [1, i] as [number, number]),
    },
    message: "还原数组: 通过前缀和还原差分数组",
    line: 11,
    variables: {},
  }];
}

const diffArray1d: AlgorithmDef = {
  id: "diff-array-1d",
  name: "一维差分",
  category: "prefix-diff",
  description: "构建一维差分数组（下标从1开始），支持 O(1) 区间加操作。",
  timeComplexity: "O(n)",
  spaceComplexity: "O(n)",
  defaultInput: [1, 3, 5, 7, 9, 2, 4, 6, 8, 10],
  sourceCode: SOURCE_CODE,
  generateSteps,
  interactive: [
    {
      name: "区间加",
      inputs: [
        { name: "l", label: "左端点 l", type: "number", default: 2, min: 1 },
        { name: "r", label: "右端点 r", type: "number", default: 5, min: 1 },
        { name: "val", label: "加值 val", type: "number", default: 10 },
      ],
      execute: executeRangeAdd,
    },
    {
      name: "还原数组",
      inputs: [],
      execute: executeRestore,
    },
  ],
};

registerAlgorithm(diffArray1d);
export default diffArray1d;
