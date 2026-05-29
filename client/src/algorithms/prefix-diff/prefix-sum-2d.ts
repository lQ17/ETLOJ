import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 构建二维前缀和（下标从1开始）
int s[MAXN][MAXN];
for (int i = 1; i <= n; i++)
    for (int j = 1; j <= m; j++)
        s[i][j] = s[i-1][j] + s[i][j-1]
                 - s[i-1][j-1] + a[i][j];
// 查询子矩阵 (r1,c1)-(r2,c2)
int query(int r1, int c1, int r2, int c2) {
    return s[r2][c2] - s[r1-1][c2]
         - s[r2][c1-1] + s[r1-1][c1-1];
}`;

function padMatrix(flat: number[]): { a: number[][]; R: number; C: number } {
  const n = flat.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  // Build 1-indexed matrix with dummy row 0 and col 0
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
  const s: number[][] = Array.from({ length: R + 1 }, () => new Array(C + 1).fill(0));

  steps.push({
    array: [...input],
    highlights: {
      grids: [
        { grid: a.map((r) => [...r]), label: "原始数组 a" },
        { grid: s.map((r) => [...r]), label: "前缀和 s" },
      ],
    },
    message: `初始化: 矩阵 (${R}×${C}), 下标从1开始, s[0][*] = s[*][0] = 0`,
    line: 1,
    variables: { n: R, m: C },
  });

  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= C; j++) {
      const top = s[i - 1][j];
      const left = s[i][j - 1];
      const diag = s[i - 1][j - 1];
      s[i][j] = top + left - diag + a[i][j];

      const related: [number, number][] = [[i - 1, j], [i, j - 1], [i - 1, j - 1]];

      steps.push({
        array: [...input],
        highlights: {
          grids: [
            { grid: a.map((r) => [...r]), label: "原始数组 a" },
            { grid: s.map((r) => [...r]), label: "前缀和 s", highlights: { current: [i, j], related } },
          ],
        },
        message: `s[${i}][${j}] = ${top} + ${left} - ${diag} + ${a[i][j]} = ${s[i][j]}`,
        line: 5,
        variables: { i, j, "s[i-1][j]": top, "s[i][j-1]": left, "s[i-1][j-1]": diag, "a[i][j]": a[i][j], "s[i][j]": s[i][j] },
      });
    }
  }

  // Final step: clean result
  steps.push({
    array: [...input],
    highlights: {
      grids: [
        { grid: a.map((r) => [...r]), label: "原始数组 a" },
        { grid: s.map((r) => [...r]), label: "前缀和 s" },
      ],
    },
    message: "构建完成！前缀和矩阵已就绪，可使用下方交互操作查询子矩阵和",
    line: 6,
  });

  return {
    steps,
    state: { original: a, prefixSum: s, rows: R, cols: C },
  };
}

function executeQuery(state: unknown, params: Record<string, number>): VisualStep[] {
  const { original, prefixSum, rows: R, cols: C } = state as { original: number[][]; prefixSum: number[][]; rows: number; cols: number };
  let r1 = Math.max(1, Math.min(Math.floor(params.r1), R));
  let c1 = Math.max(1, Math.min(Math.floor(params.c1), C));
  let r2 = Math.max(1, Math.min(Math.floor(params.r2), R));
  let c2 = Math.max(1, Math.min(Math.floor(params.c2), C));
  if (r1 > r2) [r1, r2] = [r2, r1];
  if (c1 > c2) [c1, c2] = [c2, c1];

  const result = prefixSum[r2][c2] - prefixSum[r1 - 1][c2] - prefixSum[r2][c1 - 1] + prefixSum[r1 - 1][c1 - 1];

  const related: [number, number][] = [[r2, c2], [r1 - 1, c2], [r2, c1 - 1], [r1 - 1, c1 - 1]];

  return [{
    array: original.flat(),
    highlights: {
      grids: [
        { grid: original.map((r) => [...r]), label: "原始数组 a" },
        { grid: prefixSum.map((r) => [...r]), label: "前缀和 s", highlights: { related } },
      ],
    },
    message: `查询 (${r1},${c1})-(${r2},${c2}): ${prefixSum[r2][c2]} - ${prefixSum[r1-1][c2]} - ${prefixSum[r2][c1-1]} + ${prefixSum[r1-1][c1-1]} = ${result}`,
    line: 9,
    variables: { r1, c1, r2, c2, result },
  }];
}

const prefixSum2d: AlgorithmDef = {
  id: "prefix-sum-2d",
  name: "二维前缀和",
  category: "prefix-diff",
  description: "构建二维前缀和矩阵（下标从1开始），支持 O(1) 子矩阵和查询。",
  timeComplexity: "O(n×m)",
  spaceComplexity: "O(n×m)",
  defaultInput: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  inputDimension: "2d",
  sourceCode: SOURCE_CODE,
  generateSteps,
  interactive: [
    {
      name: "子矩阵查询",
      inputs: [
        { name: "r1", label: "左上行 r1", type: "number", default: 1, min: 1 },
        { name: "c1", label: "左上列 c1", type: "number", default: 1, min: 1 },
        { name: "r2", label: "右下行 r2", type: "number", default: 2, min: 1 },
        { name: "c2", label: "右下列 c2", type: "number", default: 2, min: 1 },
      ],
      execute: executeQuery,
    },
  ],
};

registerAlgorithm(prefixSum2d);
export default prefixSum2d;
