import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 构建前缀和
int s[MAXN];
s[0] = a[0];
for (int i = 1; i < n; i++)
    s[i] = s[i-1] + a[i];
// 查询 [l, r] 区间和
int query(int l, int r) {
    if (l == 0) return s[r];
    return s[r] - s[l-1];
}`;

function generateSteps(input: number[]): VisualStep[] {
  const a = [...input];
  const n = a.length;
  const steps: VisualStep[] = [];

  if (n === 0) {
    steps.push({ array: [], highlights: {}, message: "数组为空" });
    return steps;
  }

  const s = new Array(n).fill(0);
  s[0] = a[0];

  // Initial step
  steps.push({
    array: [...a],
    highlights: {
      grid: [a.slice(), s.slice()],
      current: [1, 0],
      related: [[0, 0]],
    },
    message: `初始化: s[0] = a[0] = ${a[0]}`,
    line: 3,
    variables: { i: 0, "a[0]": a[0], "s[0]": s[0] },
  });

  // Build prefix sum
  for (let i = 1; i < n; i++) {
    s[i] = s[i - 1] + a[i];
    steps.push({
      array: [...a],
      highlights: {
        grid: [a.slice(), s.slice()],
        current: [1, i],
        related: [[0, i], [1, i - 1]],
      },
      message: `s[${i}] = s[${i - 1}] + a[${i}] = ${s[i - 1]} + ${a[i]} = ${s[i]}`,
      line: 5,
      variables: { i, "a[i]": a[i], "s[i-1]": s[i - 1], "s[i]": s[i] },
    });
  }

  // Query demo: sum of entire array
  const queryL = Math.floor(n / 4);
  const queryR = n - 1 - Math.floor(n / 4);
  const queryResult = queryL === 0 ? s[queryR] : s[queryR] - s[queryL - 1];

  steps.push({
    array: [...a],
    highlights: {
      grid: [a.slice(), s.slice()],
      related: queryL === 0
        ? [[1, queryR]]
        : [[1, queryR], [1, queryL - 1]],
    },
    message: `查询 [${queryL}, ${queryR}]: ${queryL === 0 ? `s[${queryR}]` : `s[${queryR}] - s[${queryL - 1}]`} = ${queryResult}`,
    line: queryL === 0 ? 8 : 9,
    variables: { l: queryL, r: queryR, result: queryResult },
  });

  return steps;
}

const prefixSum1d: AlgorithmDef = {
  id: "prefix-sum-1d",
  name: "一维前缀和",
  category: "prefix-diff",
  description: "构建一维前缀和数组，支持 O(1) 区间和查询。",
  timeComplexity: "O(n)",
  spaceComplexity: "O(n)",
  defaultInput: [1, 3, 5, 7, 9, 2, 4, 6, 8, 10],
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(prefixSum1d);
export default prefixSum1d;
