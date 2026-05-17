export const DIFFICULTY_VALUES = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'DIAMOND', 'MASTER', 'CHAMPION', 'LEGENDARY',
] as const;

export type DifficultyLevel = typeof DIFFICULTY_VALUES[number];

export const DIFFICULTY_DEFAULT_SCORES: Record<DifficultyLevel, number> = {
  IRON: 10,
  BRONZE: 20,
  SILVER: 35,
  GOLD: 55,
  PLATINUM: 80,
  DIAMOND: 110,
  MASTER: 150,
  CHAMPION: 200,
  LEGENDARY: 270,
};

export const MAX_SCORE = 270;

export function getDefaultScore(difficulty: string): number {
  return DIFFICULTY_DEFAULT_SCORES[difficulty as DifficultyLevel] ?? 10;
}
