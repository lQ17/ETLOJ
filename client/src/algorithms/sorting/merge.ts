import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组" });

  function mergeSort(left: number, right: number) {
    if (left >= right) return;

    const mid = Math.floor((left + right) / 2);

    steps.push({
      array: [...arr],
      highlights: { active: Array.from({ length: right - left + 1 }, (_, i) => left + i), sorted: [...sorted] },
      message: `分治：排序区间 [${left}, ${right}]`,
    });

    mergeSort(left, mid);
    mergeSort(mid + 1, right);

    const temp: number[] = [];
    let i = left, j = mid + 1;

    while (i <= mid && j <= right) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [i, j], sorted: [...sorted] },
        message: `比较 arr[${i}]=${arr[i]} 和 arr[${j}]=${arr[j]}`,
      });

      if (arr[i] <= arr[j]) {
        temp.push(arr[i++]);
      } else {
        temp.push(arr[j++]);
      }
    }

    while (i <= mid) temp.push(arr[i++]);
    while (j <= right) temp.push(arr[j++]);

    for (let k = 0; k < temp.length; k++) {
      arr[left + k] = temp[k];
    }

    if (left === 0 && right === n - 1) {
      for (let k = 0; k < n; k++) sorted.push(k);
    }

    steps.push({
      array: [...arr],
      highlights: { active: Array.from({ length: right - left + 1 }, (_, i) => left + i), sorted: [...sorted] },
      message: `合并完成：[${left}, ${right}]`,
    });
  }

  mergeSort(0, n - 1);

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const mergeSort: AlgorithmDef = {
  id: "merge",
  name: "归并排序",
  category: "sorting",
  description: "分治法：将数组分成两半分别排序，再合并两个有序数组。稳定排序。",
  timeComplexity: "O(n log n)",
  spaceComplexity: "O(n)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(mergeSort);
export default mergeSort;
