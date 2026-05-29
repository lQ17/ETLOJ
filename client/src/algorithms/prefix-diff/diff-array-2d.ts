import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 二维差分：子矩阵 (r1,c1)-(r2,c2) 加 val
void rangeAdd(int r1, int c1, int r2, int c2, int val) {
    d[r1][c1]     += val;
    d[r1][c2+1]   -= val;
    d[r2+1][c1]   -= val;
    d[r2+1][c2+1] += val;
}
// 还原：二维前缀和
void restore() {
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            d[i][j] += d[i-1][j] + d[i][j-1]
                     - d[i-1][j-1];
}`;

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const n = input.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const a: number[][] = [];
  for (let i = 0; i < rows; i++) {
    a.push(input.slice(i * cols, (i + 1) * cols));
    while (a[i].length < cols) a[i].push(0);
  }

  const steps: VisualStep[] = [];
  const R = rows;
  const C = cols;

  steps.push({
    array: [...input],
    highlights: { grid: a.map((r) => [...r]) },
    message: `原始矩阵 (${R}×${C})`,
    line: 1,
    variables: { n: R, m: C },
  });

  const d: number[][] = a.map((r) => [...r]);

  steps.push({
    array: [...input],
    highlights: { grid: d.map((r) => [...r]) },
    message: "差分矩阵初始化（与原矩阵相同）",
    line: 1,
    variables: {},
  });

  return {
    steps,
    state: { original: a, diff: d.map((r) => [...r]), rows: R, cols: C },
  };
}

function executeRangeAdd(state: unknown, params: Record<string, number>): VisualStep[] {
  const { original, diff, rows: R, cols: C } = state as { original: number[][]; diff: number[][]; rows: number; cols: number };
  const d = diff;
  let r1 = Math.max(0, Math.min(Math.floor(params.r1), R - 1));
  let c1 = Math.max(0, Math.min(Math.floor(params.c1), C - 1));
  let r2 = Math.max(0, Math.min(Math.floor(params.r2), R - 1));
  let c2 = Math.max(0, Math.min(Math.floor(params.c2), C - 1));
  if (r1 > r2) [r1, r2] = [r2, r1];
  if (c1 > c2) [c1, c2] = [c2, c1];
  const val = Math.floor(params.val);

  const steps: VisualStep[] = [];
  const corners: [number, number, number, string][] = [
    [r1, c1, val, `d[${r1}][${c1}] += ${val}`],
    [r1, c2 + 1, -val, `d[${r1}][${c2 + 1}] -= ${val}`],
    [r2 + 1, c1, -val, `d[${r2 + 1}][${c1}] -= ${val}`],
    [r2 + 1, c2 + 1, val, `d[${r2 + 1}][${c2 + 1}] += ${val}`],
  ];

  for (const [cr, cc, delta, desc] of corners) {
    if (cr < R && cc < C) {
      d[cr][cc] += delta;
      steps.push({
        array: original.flat(),
        highlights: { grid: d.map((r) => [...r]), current: [cr, cc], updated: [[cr, cc]] },
        message: `子矩阵 (${r1},${c1})-(${r2},${c2}) 加 ${val}: ${desc} = ${d[cr][cc]}`,
        line: 3,
        variables: { r1, c1, r2, c2, val, row: cr, col: cc, delta, "d[cr][cc]": d[cr][cc] },
      });
    }
  }

  return steps;
}

function executeRestore(state: unknown): VisualStep[] {
  const { original, diff, rows: R, cols: C } = state as { original: number[][]; diff: number[][]; rows: number; cols: number };
  const restored = diff.map((r) => [...r]);
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      if (i > 0) restored[i][j] += restored[i - 1][j];
      if (j > 0) restored[i][j] += restored[i][j - 1];
      if (i > 0 && j > 0) restored[i][j] -= restored[i - 1][j - 1];
    }
  }

  // Update state
  (state as { diff: number[][] }).diff = restored;

  return [{
    array: original.flat(),
    highlights: {
      grid: restored.map((r) => [...r]),
      updated: Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => [i, j] as [number, number])).flat(),
    },
    message: "还原矩阵: 通过二维前缀和还原",
    line: 9,
    variables: {},
  }];
}

const diffArray2d: AlgorithmDef = {
  id: "diff-array-2d",
  name: "二维差分",
  category: "prefix-diff",
  description: "二维差分数组，支持 O(1) 子矩阵区间加操作。",
  timeComplexity: "O(n×m)",
  spaceComplexity: "O(n×m)",
  defaultInput: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  inputDimension: "2d",
  sourceCode: SOURCE_CODE,
  generateSteps,
  interactive: [
    {
      name: "子矩阵加",
      inputs: [
        { name: "r1", label: "左上行 r1", type: "number", default: 0, min: 0 },
        { name: "c1", label: "左上列 c1", type: "number", default: 0, min: 0 },
        { name: "r2", label: "右下行 r2", type: "number", default: 1, min: 0 },
        { name: "c2", label: "右下列 c2", type: "number", default: 1, min: 0 },
        { name: "val", label: "加值 val", type: "number", default: 5 },
      ],
      execute: executeRangeAdd,
    },
    {
      name: "还原矩阵",
      inputs: [],
      execute: executeRestore,
    },
  ],
};

registerAlgorithm(diffArray2d);
export default diffArray2d;
