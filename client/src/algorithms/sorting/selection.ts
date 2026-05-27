import type { AlgorithmDef, VisualStep, BarItem } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `function selectionSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
      }
    }
    if (minIdx !== i) {
      swap(arr[i], arr[minIdx]);
    }
  }
}`;

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const bars: BarItem[] = input.map((v, i) => ({ id: i, value: v }));
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组", bars: bars.map((b) => ({ ...b })), line: 1 });

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    steps.push({
      array: [...arr],
      highlights: { active: [i], sorted: [...sorted] },
      message: `从位置 ${i} 开始寻找最小值`,
      bars: bars.map((b) => ({ ...b })),
      line: 3,
      variables: { i, minIdx },
    });

    for (let j = i + 1; j < n; j++) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [minIdx, j], active: [i], sorted: [...sorted] },
        message: `比较 arr[${minIdx}]=${arr[minIdx]} 和 arr[${j}]=${arr[j]}`,
        bars: bars.map((b) => ({ ...b })),
        line: 6,
        variables: { i, j, minIdx, "arr[minIdx]": arr[minIdx], "arr[j]": arr[j] },
      });

      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        steps.push({
          array: [...arr],
          highlights: { active: [i], comparing: [minIdx], sorted: [...sorted] },
          message: `更新最小值位置为 ${minIdx}`,
          bars: bars.map((b) => ({ ...b })),
          line: 7,
          variables: { i, j, minIdx },
        });
      }
    }

    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      [bars[i], bars[minIdx]] = [bars[minIdx], bars[i]];
      steps.push({
        array: [...arr],
        highlights: { swapping: [i, minIdx], sorted: [...sorted] },
        message: `交换 arr[${i}] 和 arr[${minIdx}]`,
        bars: bars.map((b) => ({ ...b })),
        line: 11,
        variables: { i, minIdx },
      });
    }

    sorted.push(i);
  }

  sorted.push(n - 1);
  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
    bars: bars.map((b) => ({ ...b })),
    line: 13,
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
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(selectionSort);
export default selectionSort;
