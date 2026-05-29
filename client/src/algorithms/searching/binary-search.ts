import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `int binarySearch(int arr[], int n, int target) {
    int left = 0, right = n - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target)
            return mid;
        else if (arr[mid] < target)
            left = mid + 1;
        else
            right = mid - 1;
    }
    return -1;
}`;

function buildEliminated(left: number, right: number, n: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < left || i > right) result.push(i);
  }
  return result;
}

function generateSteps(input: number[], target: number = 0): { steps: VisualStep[]; state?: unknown } {
  const arr = [...input];
  const n = arr.length;
  const steps: VisualStep[] = [];

  if (n === 0) {
    steps.push({ array: [], highlights: {}, message: "数组为空" });
    return { steps };
  }

  let left = 0;
  let right = n - 1;

  // initial step
  steps.push({
    array: [...arr],
    highlights: { left, right, eliminated: [] },
    message: `初始化: left=0, right=${right}, target=${target}`,
    line: 2,
    variables: { left, right, target },
  });

  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);

    // step: calculate mid
    steps.push({
      array: [...arr],
      highlights: { left, right, mid, eliminated: buildEliminated(left, right, n) },
      message: `计算 mid = (${left} + ${right}) / 2 = ${mid}`,
      line: 4,
      variables: { left, right, mid, target, "arr[mid]": arr[mid] },
    });

    if (arr[mid] === target) {
      // found
      steps.push({
        array: [...arr],
        highlights: { left, right, mid, found: mid, eliminated: buildEliminated(left, right, n) },
        message: `找到目标! arr[${mid}]=${target}`,
        line: 6,
        variables: { left, right, mid, target, "arr[mid]": arr[mid] },
      });
      return { steps };
    } else if (arr[mid] < target) {
      // step: move left
      const oldLeft = left;
      left = mid + 1;
      steps.push({
        array: [...arr],
        highlights: { left, right, mid, eliminated: buildEliminated(left, right, n) },
        message: `arr[${mid}]=${arr[mid]} < target=${target}, left = ${oldLeft} → ${left}`,
        line: 8,
        variables: { left, right, mid, target, "arr[mid]": arr[mid] },
      });
    } else {
      // step: move right
      const oldRight = right;
      right = mid - 1;
      steps.push({
        array: [...arr],
        highlights: { left, right, mid, eliminated: buildEliminated(left, right, n) },
        message: `arr[${mid}]=${arr[mid]} > target=${target}, right = ${oldRight} → ${right}`,
        line: 10,
        variables: { left, right, mid, target, "arr[mid]": arr[mid] },
      });
    }
  }

  // not found
  steps.push({
    array: [...arr],
    highlights: { eliminated: Array.from({ length: n }, (_, i) => i) },
    message: `未找到目标 ${target}`,
    line: 12,
    variables: { target },
  });

  return { steps };
}

const binarySearch: AlgorithmDef = {
  id: "binary-search",
  name: "简单二分",
  category: "searching",
  description: "在有序数组中查找目标值，找到返回下标，找不到返回 -1。",
  timeComplexity: "O(log n)",
  spaceComplexity: "O(1)",
  defaultInput: [5, 12, 18, 27, 35, 42, 51, 68, 79, 93],
  defaultTarget: 42,
  needTarget: true,
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(binarySearch);
export default binarySearch;
