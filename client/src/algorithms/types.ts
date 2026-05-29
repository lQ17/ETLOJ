export interface BarItem {
  id: number;
  value: number;
}

export interface VisualStep {
  array: number[];
  highlights: {
    comparing?: number[];
    swapping?: number[];
    sorted?: number[];
    pivot?: number;
    active?: number[];
    left?: number;
    right?: number;
    mid?: number;
    eliminated?: number[];
    found?: number;
  };
  message?: string;
  bars?: BarItem[];
  line?: number;
  variables?: Record<string, number | string>;
}

export type AlgorithmCategory = "sorting" | "graph" | "string" | "data-structure" | "searching";

export interface AlgorithmDef {
  id: string;
  name: string;
  category: AlgorithmCategory;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  defaultInput: number[];
  sourceCode?: string;
  needTarget?: boolean;
  defaultTarget?: number;
  generateSteps(input: number[], target?: number): VisualStep[];
}
