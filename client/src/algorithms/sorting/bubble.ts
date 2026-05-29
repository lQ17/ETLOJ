import type { AlgorithmDef, VisualStep, BarItem } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      if (arr[j] > arr[j + 1]) {
        swap(arr[j], arr[j + 1]);
      }
    }
  }
}`;

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const arr = [...input];
  const bars: BarItem[] = input.map((v, i) => ({ id: i, value: v }));
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组", bars: bars.map((b) => ({ ...b })), line: 1 });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      const jVal = arr[j];
      const j1Val = arr[j + 1];
      steps.push({
        array: [...arr],
        highlights: { comparing: [j, j + 1], sorted: [...sorted] },
        message: `比较 arr[${j}]=${jVal} 和 arr[${j + 1}]=${j1Val}`,
        bars: bars.map((b) => ({ ...b })),
        line: 5,
        variables: { i, j, "arr[j]": jVal, "arr[j+1]": j1Val },
      });

      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        [bars[j], bars[j + 1]] = [bars[j + 1], bars[j]];
        steps.push({
          array: [...arr],
          highlights: { swapping: [j, j + 1], sorted: [...sorted] },
          message: `交换 arr[${j}] 和 arr[${j + 1}]`,
          bars: bars.map((b) => ({ ...b })),
          line: 6,
          variables: { i, j, "arr[j]": arr[j], "arr[j+1]": arr[j + 1] },
        });
      }
    }
    sorted.unshift(n - 1 - i);
  }

  sorted.unshift(0);
  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
    bars: bars.map((b) => ({ ...b })),
    line: 9,
  });

  return { steps };
}

const bubbleSort: AlgorithmDef = {
  id: "bubble",
  name: "冒泡排序",
  category: "sorting",
  description: "重复遍历数组，比较相邻元素并交换顺序错误的元素，直到无需交换。",
  timeComplexity: "O(n²)",
  spaceComplexity: "O(1)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(bubbleSort);
export default bubbleSort;
