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

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const a = [...input];
  const n = a.length;
  const steps: VisualStep[] = [];

  if (n === 0) {
    return { steps: [{ array: [], highlights: {}, message: "数组为空" }] };
  }

  const s = new Array(n).fill(0);
  s[0] = a[0];

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

  // Final step: clean result
  steps.push({
    array: [...a],
    highlights: { grid: [a.slice(), s.slice()] },
    message: "构建完成！前缀和数组已就绪，可使用下方交互操作查询区间和",
    line: 6,
  });

  return {
    steps,
    state: { original: a, prefixSum: s },
  };
}

function executeQuery(state: unknown, params: Record<string, number>): VisualStep[] {
  const { original, prefixSum } = state as { original: number[]; prefixSum: number[] };
  const n = original.length;
  let l = Math.max(0, Math.min(Math.floor(params.l), n - 1));
  let r = Math.max(0, Math.min(Math.floor(params.r), n - 1));
  if (l > r) [l, r] = [r, l];

  const result = l === 0 ? prefixSum[r] : prefixSum[r] - prefixSum[l - 1];
  const related: [number, number][] = l === 0
    ? [[1, r]]
    : [[1, r], [1, l - 1]];

  return [{
    array: [...original],
    highlights: {
      grid: [original.slice(), prefixSum.slice()],
      related,
    },
    message: `查询 [${l}, ${r}]: ${l === 0 ? `s[${r}]` : `s[${r}] - s[${l - 1}]`} = ${result}`,
    line: l === 0 ? 8 : 9,
    variables: { l, r, result },
  }];
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
  interactive: [
    {
      name: "区间查询",
      inputs: [
        { name: "l", label: "左端点 l", type: "number", default: 0, min: 0 },
        { name: "r", label: "右端点 r", type: "number", default: 4, min: 0 },
      ],
      execute: executeQuery,
    },
  ],
};

registerAlgorithm(prefixSum1d);
export default prefixSum1d;
