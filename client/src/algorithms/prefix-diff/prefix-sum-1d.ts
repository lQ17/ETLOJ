import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `// 构建前缀和（下标从1开始）
int s[MAXN];
s[0] = 0;
for (int i = 1; i <= n; i++)
    s[i] = s[i-1] + a[i];
// 查询 [l, r] 区间和
int query(int l, int r) {
    return s[r] - s[l-1];
}`;

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const n = input.length;
  const steps: VisualStep[] = [];

  if (n === 0) {
    return { steps: [{ array: [], highlights: {}, message: "数组为空" }] };
  }

  // 1-indexed: prepend 0 at index 0
  const a = [0, ...input];
  const s = new Array(n + 1).fill(0);
  // s[0] = 0 already

  steps.push({
    array: a.slice(),
    highlights: {
      grid: [a.slice(), s.slice()],
    },
    message: `初始化: s[0] = 0, 数组 a[1..${n}] 已就绪`,
    line: 2,
    variables: { n, "a[1]": a[1] },
  });

  for (let i = 1; i <= n; i++) {
    s[i] = s[i - 1] + a[i];
    steps.push({
      array: a.slice(),
      highlights: {
        grid: [a.slice(), s.slice()],
        current: [1, i],
        related: [[0, i], [1, i - 1]],
      },
      message: `s[${i}] = s[${i - 1}] + a[${i}] = ${s[i - 1]} + ${a[i]} = ${s[i]}`,
      line: 4,
      variables: { i, "a[i]": a[i], "s[i-1]": s[i - 1], "s[i]": s[i] },
    });
  }

  // Final step: clean result
  steps.push({
    array: a.slice(),
    highlights: { grid: [a.slice(), s.slice()] },
    message: "构建完成！前缀和数组已就绪，可使用下方交互操作查询区间和",
    line: 5,
  });

  return {
    steps,
    state: { original: a, prefixSum: s, n },
  };
}

function executeQuery(state: unknown, params: Record<string, number>): VisualStep[] {
  const { original, prefixSum, n } = state as { original: number[]; prefixSum: number[]; n: number };
  let l = Math.max(1, Math.min(Math.floor(params.l), n));
  let r = Math.max(1, Math.min(Math.floor(params.r), n));
  if (l > r) [l, r] = [r, l];

  const result = prefixSum[r] - prefixSum[l - 1];

  return [{
    array: original.slice(),
    highlights: {
      grid: [original.slice(), prefixSum.slice()],
      related: [[1, r], [1, l - 1]],
    },
    message: `查询 [${l}, ${r}]: s[${r}] - s[${l - 1}] = ${prefixSum[r]} - ${prefixSum[l - 1]} = ${result}`,
    line: 8,
    variables: { l, r, "s[r]": prefixSum[r], "s[l-1]": prefixSum[l - 1], result },
  }];
}

const prefixSum1d: AlgorithmDef = {
  id: "prefix-sum-1d",
  name: "一维前缀和",
  category: "prefix-diff",
  description: "构建一维前缀和数组（下标从1开始），支持 O(1) 区间和查询。",
  timeComplexity: "O(n)",
  spaceComplexity: "O(n)",
  defaultInput: [1, 3, 5, 7, 9, 2, 4, 6, 8, 10],
  sourceCode: SOURCE_CODE,
  generateSteps,
  interactive: [
    {
      name: "区间查询",
      inputs: [
        { name: "l", label: "左端点 l", type: "number", default: 1, min: 1 },
        { name: "r", label: "右端点 r", type: "number", default: 5, min: 1 },
      ],
      execute: executeQuery,
    },
  ],
};

registerAlgorithm(prefixSum1d);
export default prefixSum1d;
