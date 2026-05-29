import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `int lowerBound(int arr[], int n, int target) {
    int left = 0, right = n - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] < target)
            left = mid + 1;
        else
            right = mid - 1;
    }
    return left;
}`;

function buildEliminated(left: number, right: number, n: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < left || i > right) result.push(i);
  }
  return result;
}

function generateSteps(input: number[], target: number = 0): VisualStep[] {
  const arr = [...input];
  const n = arr.length;
  const steps: VisualStep[] = [];

  if (n === 0) {
    steps.push({ array: [], highlights: {}, message: "数组为空" });
    return steps;
  }

  let left = 0;
  let right = n - 1;

  steps.push({
    array: [...arr],
    highlights: { left, right, eliminated: [] },
    message: `初始化: left=0, right=${right}, target=${target}`,
    line: 2,
    variables: { left, right, target },
  });

  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);

    steps.push({
      array: [...arr],
      highlights: { left, right, mid, eliminated: buildEliminated(left, right, n) },
      message: `计算 mid = (${left} + ${right}) / 2 = ${mid}`,
      line: 4,
      variables: { left, right, mid, target, "arr[mid]": arr[mid] },
    });

    if (arr[mid] < target) {
      const oldLeft = left;
      left = mid + 1;
      steps.push({
        array: [...arr],
        highlights: { left, right, mid, eliminated: buildEliminated(left, right, n) },
        message: `arr[${mid}]=${arr[mid]} < target=${target}, left = ${oldLeft} → ${left}`,
        line: 6,
        variables: { left, right, mid, target, "arr[mid]": arr[mid] },
      });
    } else {
      const oldRight = right;
      right = mid - 1;
      steps.push({
        array: [...arr],
        highlights: { left, right, mid, eliminated: buildEliminated(left, right, n) },
        message: `arr[${mid}]=${arr[mid]} >= target=${target}, right = ${oldRight} → ${right}`,
        line: 8,
        variables: { left, right, mid, target, "arr[mid]": arr[mid] },
      });
    }
  }

  // result
  if (left < n) {
    steps.push({
      array: [...arr],
      highlights: { left, right, found: left, eliminated: buildEliminated(left, right, n) },
      message: `lower_bound(${target}) = ${left}, arr[${left}]=${arr[left]}`,
      line: 10,
      variables: { left, right, target, "arr[left]": arr[left] },
    });
  } else {
    steps.push({
      array: [...arr],
      highlights: { eliminated: Array.from({ length: n }, (_, i) => i) },
      message: `不存在 >= ${target} 的元素`,
      line: 10,
      variables: { left, right, target },
    });
  }

  return steps;
}

const lowerBound: AlgorithmDef = {
  id: "lower-bound",
  name: "lower_bound",
  category: "searching",
  description: "查找有序数组中第一个大于等于 target 的位置。",
  timeComplexity: "O(log n)",
  spaceComplexity: "O(1)",
  defaultInput: [5, 12, 18, 27, 35, 42, 51, 68, 79, 93],
  defaultTarget: 42,
  needTarget: true,
  sourceCode: SOURCE_CODE,
  generateSteps,
};

registerAlgorithm(lowerBound);
export default lowerBound;
