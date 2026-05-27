import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [0];

  steps.push({
    array: [...arr],
    highlights: { sorted: [0] },
    message: "初始数组，第一个元素视为已排序",
  });

  for (let i = 1; i < n; i++) {
    const key = arr[i];
    let j = i - 1;

    steps.push({
      array: [...arr],
      highlights: { active: [i], sorted: [...sorted] },
      message: `取出 arr[${i}]=${key}，准备插入已排序区间`,
    });

    while (j >= 0 && arr[j] > key) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [j, j + 1], sorted: [...sorted] },
        message: `arr[${j}]=${arr[j]} > ${key}，右移`,
      });

      arr[j + 1] = arr[j];
      j--;

      steps.push({
        array: [...arr],
        highlights: { swapping: [j + 1, j + 2], sorted: [...sorted] },
        message: `右移完成`,
      });
    }

    arr[j + 1] = key;
    sorted.push(i);

    steps.push({
      array: [...arr],
      highlights: { sorted: [...sorted] },
      message: `将 ${key} 插入到位置 ${j + 1}`,
    });
  }

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const insertionSort: AlgorithmDef = {
  id: "insertion",
  name: "插入排序",
  category: "sorting",
  description: "将每个元素插入到已排序区间的正确位置，类似整理扑克牌。",
  timeComplexity: "O(n²)",
  spaceComplexity: "O(1)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(insertionSort);
export default insertionSort;
