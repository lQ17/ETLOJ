import type { AlgorithmDef, VisualStep, BarItem } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `function mergeSort(arr, left, right) {
  if (left >= right) return;
  const mid = Math.floor((left + right) / 2);
  mergeSort(arr, left, mid);
  mergeSort(arr, mid + 1, right);
  // 合并两个有序子数组
  let i = left, j = mid + 1;
  const temp = [];
  while (i <= mid && j <= right) {
    if (arr[i] <= arr[j]) temp.push(arr[i++]);
    else temp.push(arr[j++]);
  }
  while (i <= mid) temp.push(arr[i++]);
  while (j <= right) temp.push(arr[j++]);
  for (let k = 0; k < temp.length; k++)
    arr[left + k] = temp[k];
}`;

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const arr = [...input];
  const bars: BarItem[] = input.map((v, i) => ({ id: i, value: v }));
  const steps: VisualStep[] = [];
  const n = arr.length;
  const sorted: number[] = [];

  steps.push({ array: [...arr], highlights: {}, message: "初始数组", bars: bars.map((b) => ({ ...b })), line: 1 });

  function mergeSort(left: number, right: number) {
    if (left >= right) return;

    const mid = Math.floor((left + right) / 2);

    steps.push({
      array: [...arr],
      highlights: { active: Array.from({ length: right - left + 1 }, (_, i) => left + i), sorted: [...sorted] },
      message: `分治：排序区间 [${left}, ${right}]`,
      bars: bars.map((b) => ({ ...b })),
      line: 3,
      variables: { left, right, mid },
    });

    mergeSort(left, mid);
    mergeSort(mid + 1, right);

    const temp: number[] = [];
    const tempBars: BarItem[] = [];
    let i = left, j = mid + 1;

    while (i <= mid && j <= right) {
      steps.push({
        array: [...arr],
        highlights: { comparing: [i, j], sorted: [...sorted] },
        message: `比较 arr[${i}]=${arr[i]} 和 arr[${j}]=${arr[j]}`,
        bars: bars.map((b) => ({ ...b })),
        line: 10,
        variables: { left, right, mid, i, j, "arr[i]": arr[i], "arr[j]": arr[j] },
      });

      if (arr[i] <= arr[j]) {
        temp.push(arr[i]);
        tempBars.push(bars[i]);
        i++;
      } else {
        temp.push(arr[j]);
        tempBars.push(bars[j]);
        j++;
      }
    }

    while (i <= mid) { temp.push(arr[i]); tempBars.push(bars[i]); i++; }
    while (j <= right) { temp.push(arr[j]); tempBars.push(bars[j]); j++; }

    for (let k = 0; k < temp.length; k++) {
      arr[left + k] = temp[k];
      bars[left + k] = tempBars[k];
    }

    if (left === 0 && right === n - 1) {
      for (let k = 0; k < n; k++) sorted.push(k);
    }

    steps.push({
      array: [...arr],
      highlights: { active: Array.from({ length: right - left + 1 }, (_, i) => left + i), sorted: [...sorted] },
      message: `合并完成：[${left}, ${right}]`,
      bars: bars.map((b) => ({ ...b })),
      line: 15,
      variables: { left, right },
    });
  }

  mergeSort(0, n - 1);

  steps.push({
    array: [...arr],
    highlights: { sorted: Array.from({ length: n }, (_, i) => i) },
    message: "排序完成！",
    bars: bars.map((b) => ({ ...b })),
    line: 1,
  });

  return { steps };
}

const mergeSort: AlgorithmDef = {
  id: "merge",
  name: "归并排序",
  category: "sorting",
  description: "分治法：将数组分成两半分别排序，再合并两个有序数组。稳定排序。",
  timeComplexity: "O(n log n)",
  spaceComplexity: "O(n)",
  defaultInput: [64, 34, 25, 12, 22, 11, 90, 45, 67, 89],
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(mergeSort);
export default mergeSort;
