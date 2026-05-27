export interface VisualStep {
  array: number[];
  highlights: {
    comparing?: number[];
    swapping?: number[];
    sorted?: number[];
    pivot?: number;
    active?: number[];
  };
  message?: string;
}

export type AlgorithmCategory = "sorting" | "graph" | "string" | "data-structure";

export interface AlgorithmDef {
  id: string;
  name: string;
  category: AlgorithmCategory;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  defaultInput: number[];
  generateSteps(input: number[]): VisualStep[];
}
