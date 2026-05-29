import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 构建二维前缀和
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

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  // Parse flat input as 2D: assume square-ish matrix
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

  // Build prefix sum (1-indexed internally, display 0-indexed)
  const s: number[][] = Array.from({ length: R }, () => new Array(C).fill(0));

  // Initial state
  steps.push({
    array: [...input],
    highlights: { grid: a.map((r) => [...r]) },
    message: `原始矩阵 (${R}×${C})`,
    line: 1,
    variables: { n: R, m: C },
  });

  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      const top = i > 0 ? s[i - 1][j] : 0;
      const left = j > 0 ? s[i][j - 1] : 0;
      const diag = i > 0 && j > 0 ? s[i - 1][j - 1] : 0;
      s[i][j] = top + left - diag + a[i][j];

      const related: [number, number][] = [];
      if (i > 0) related.push([i - 1, j]);
      if (j > 0) related.push([i, j - 1]);
      if (i > 0 && j > 0) related.push([i - 1, j - 1]);

      steps.push({
        array: [...input],
        highlights: {
          grid: s.map((r) => [...r]),
          current: [i, j],
          related,
        },
        message: `s[${i}][${j}] = ${top} + ${left} - ${diag} + ${a[i][j]} = ${s[i][j]}`,
        line: 5,
        variables: {
          i, j,
          "s[i-1][j]": top,
          "s[i][j-1]": left,
          "s[i-1][j-1]": diag,
          "a[i][j]": a[i][j],
          "s[i][j]": s[i][j],
        },
      });
    }
  }

  // Query demo
  const r1 = 0, c1 = 0, r2 = R - 1, c2 = C - 1;
  const qr2c2 = s[r2][c2];
  const qr1m1c2 = r1 > 0 ? s[r1 - 1][c2] : 0;
  const qr2c1m1 = c1 > 0 ? s[r2][c1 - 1] : 0;
  const qr1m1c1m1 = r1 > 0 && c1 > 0 ? s[r1 - 1][c1 - 1] : 0;
  const queryResult = qr2c2 - qr1m1c2 - qr2c1m1 + qr1m1c1m1;

  const queryRelated: [number, number][] = [[r2, c2]];
  if (r1 > 0) queryRelated.push([r1 - 1, c2]);
  if (c1 > 0) queryRelated.push([r2, c1 - 1]);
  if (r1 > 0 && c1 > 0) queryRelated.push([r1 - 1, c1 - 1]);

  steps.push({
    array: [...input],
    highlights: {
      grid: s.map((r) => [...r]),
      related: queryRelated,
    },
    message: `查询子矩阵 (${r1},${c1})-(${r2},${c2}): 矩阵总和 = ${queryResult}`,
    line: 8,
    variables: { r1, c1, r2, c2, result: queryResult },
  });

  return { steps };
}

const prefixSum2d: AlgorithmDef = {
  id: "prefix-sum-2d",
  name: "二维前缀和",
  category: "prefix-diff",
  description: "构建二维前缀和矩阵，支持 O(1) 子矩阵和查询。",
  timeComplexity: "O(n×m)",
  spaceComplexity: "O(n×m)",
  defaultInput: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  inputDimension: "2d",
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(prefixSum2d);
export default prefixSum2d;
