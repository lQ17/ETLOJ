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

  // Initial: show original matrix
  steps.push({
    array: [...input],
    highlights: { grid: a.map((r) => [...r]) },
    message: `原始矩阵 (${R}×${C})`,
    line: 1,
    variables: { n: R, m: C },
  });

  // Build difference matrix (copy of a initially)
  const d: number[][] = a.map((r) => [...r]);

  // Show initial diff matrix
  steps.push({
    array: [...input],
    highlights: { grid: d.map((r) => [...r]) },
    message: "差分矩阵初始化（与原矩阵相同）",
    line: 1,
    variables: {},
  });

  // Range update demo: add val to sub-matrix
  const r1 = 0, c1 = 0, r2 = Math.min(1, R - 1), c2 = Math.min(1, C - 1), val = 5;

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
        array: [...input],
        highlights: {
          grid: d.map((r) => [...r]),
          current: [cr, cc],
          updated: [[cr, cc]],
        },
        message: `子矩阵 (${r1},${c1})-(${r2},${c2}) 加 ${val}: ${desc} = ${d[cr][cc]}`,
        line: 3,
        variables: { r1, c1, r2, c2, val, row: cr, col: cc, delta, "d[cr][cc]": d[cr][cc] },
      });
    }
  }

  // Restore via 2D prefix sum
  const restored = d.map((r) => [...r]);
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      if (i > 0) restored[i][j] += restored[i - 1][j];
      if (j > 0) restored[i][j] += restored[i][j - 1];
      if (i > 0 && j > 0) restored[i][j] -= restored[i - 1][j - 1];
    }
  }

  steps.push({
    array: [...input],
    highlights: {
      grid: restored.map((r) => [...r]),
      updated: Array.from({ length: R }, (_, i) =>
        Array.from({ length: C }, (_, j) => [i, j] as [number, number])
      ).flat(),
    },
    message: `还原矩阵: 子矩阵 (${r1},${c1})-(${r2},${c2}) 已加 ${val}`,
    line: 9,
    variables: { r1, c1, r2, c2, val },
  });

  return { steps };
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
};

registerAlgorithm(diffArray2d);
export default diffArray2d;
