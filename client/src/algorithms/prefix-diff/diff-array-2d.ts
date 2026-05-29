import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 二维差分（下标从1开始）
// 子矩阵 (r1,c1)-(r2,c2) 加 val
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

function padMatrix(flat: number[]): { a: number[][]; R: number; C: number } {
  const n = flat.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const a: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      a[i + 1][j + 1] = flat[i * cols + j] ?? 0;
    }
  }
  return { a, R: rows, C: cols };
}

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const { a, R, C } = padMatrix(input);
  const steps: VisualStep[] = [];
  const d: number[][] = a.map((r) => [...r]);

  steps.push({
    array: [...input],
    highlights: {
      grids: [
        { grid: a.map((r) => [...r]), label: "原始数组 a" },
        { grid: d.map((r) => [...r]), label: "差分数组 d" },
      ],
    },
    message: `初始化: 矩阵 (${R}×${C}), 下标从1开始, d = a 的拷贝`,
    line: 1,
    variables: { n: R, m: C },
  });

  return {
    steps,
    state: { original: a, diff: d.map((r) => [...r]), rows: R, cols: C },
  };
}

function executeRangeAdd(state: unknown, params: Record<string, number>): VisualStep[] {
  const { original, diff, rows: R, cols: C } = state as { original: number[][]; diff: number[][]; rows: number; cols: number };
  const d = diff;
  let r1 = Math.max(1, Math.min(Math.floor(params.r1), R));
  let c1 = Math.max(1, Math.min(Math.floor(params.c1), C));
  let r2 = Math.max(1, Math.min(Math.floor(params.r2), R));
  let c2 = Math.max(1, Math.min(Math.floor(params.c2), C));
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
    if (cr <= R && cc <= C) {
      d[cr][cc] += delta;
      steps.push({
        array: original.flat(),
        highlights: {
          grids: [
            { grid: original.map((r) => [...r]), label: "原始数组 a" },
            { grid: d.map((r) => [...r]), label: "差分数组 d", highlights: { current: [cr, cc], updated: [[cr, cc]] } },
          ],
        },
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
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= C; j++) {
      restored[i][j] += restored[i - 1][j] + restored[i][j - 1] - restored[i - 1][j - 1];
    }
  }

  (state as { diff: number[][] }).diff = restored;

  const updated: [number, number][] = [];
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= C; j++) {
      updated.push([i, j]);
    }
  }

  return [{
    array: original.flat(),
    highlights: {
      grids: [
        { grid: original.map((r) => [...r]), label: "原始数组 a" },
        { grid: restored.map((r) => [...r]), label: "还原结果", highlights: { updated } },
      ],
    },
    message: "还原矩阵: 通过二维前缀和还原",
    line: 10,
    variables: {},
  }];
}

const diffArray2d: AlgorithmDef = {
  id: "diff-array-2d",
  name: "二维差分",
  category: "prefix-diff",
  description: "二维差分数组（下标从1开始），支持 O(1) 子矩阵区间加操作。",
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
        { name: "r1", label: "左上行 r1", type: "number", default: 1, min: 1 },
        { name: "c1", label: "左上列 c1", type: "number", default: 1, min: 1 },
        { name: "r2", label: "右下行 r2", type: "number", default: 2, min: 1 },
        { name: "c2", label: "右下列 c2", type: "number", default: 2, min: 1 },
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
