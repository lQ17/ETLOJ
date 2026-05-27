import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

function generateSteps(input: number[]): VisualStep[] {
  const arr = [...input];
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组" });

  function quickSort(low: number, high: number) {
    if (low >= high) {
      if (low === high) sorted.push(low);
      return;
    }

    const pivot = arr[high];
    let i = low;

    steps.push({
      array: [...arr],
      highlights: { pivot: high, active: Array.from({ length: high - low + 1 }, (_, k) => low + k), sorted: [...sorted] },
      message: `选择 pivot = arr[${high}]=${pivot}，分区 [${low}, ${high}]`,
    });

    for (let j = low; j < high; j++) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [j, high], pivot: high, sorted: [...sorted] },
        message: `比较 arr[${j}]=${arr[j]} 和 pivot=${pivot}`,
      });

      if (arr[j] < pivot) {
        if (i !== j) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          steps.push({
            array: [...arr],
            highlights: { swapping: [i, j], pivot: high, sorted: [...sorted] },
            message: `交换 arr[${i}] 和 arr[${j}]`,
          });
        }
        i++;
      }
    }

    if (i !== high) {
      [arr[i], arr[high]] = [arr[high], arr[i]];
      steps.push({
        array: [...arr],
        highlights: { swapping: [i, high], sorted: [...sorted] },
        message: `将 pivot 放到最终位置 ${i}`,
      });
    }

    sorted.push(i);

    quickSort(low, i - 1);
    quickSort(i + 1, high);
  }

  quickSort(0, n - 1);

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
  });

  return steps;
}

const quickSort: AlgorithmDef = {
  id: "quick",
  name: "快速排序",
  category: "sorting",
  description: "分治法：选一个基准值，将数组分为小于和大于基准的两部分，递归排序。",
  timeComplexity: "O(n log n) 平均",
  spaceComplexity: "O(log n)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  generateSteps,
};

registerAlgorithm(quickSort);
export default quickSort;
