import type { AlgorithmDef } from "./types";

const algorithms: AlgorithmDef[] = [];

export function registerAlgorithm(algo: AlgorithmDef) {
  algorithms.push(algo);
}

export function getAllAlgorithms(): AlgorithmDef[] {
  return algorithms;
}

export function getAlgorithmsByCategory(category: string): AlgorithmDef[] {
  return algorithms.filter((a) => a.category === category);
}

export function getAlgorithmById(id: string): AlgorithmDef | undefined {
  return algorithms.find((a) => a.id === id);
}

export function getCategories(): string[] {
  return [...new Set(algorithms.map((a) => a.category))];
}
