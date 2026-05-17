export type DifficultyLevel =
  | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  | 'DIAMOND' | 'MASTER' | 'CHAMPION' | 'LEGENDARY';

export const DIFFICULTY_VALUES: DifficultyLevel[] = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'DIAMOND', 'MASTER', 'CHAMPION', 'LEGENDARY',
];

export interface DifficultyConfig {
  label: string;
  hexColor: string;
  defaultScore: number;
  animated: boolean;
  animationClass?: string;
}

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, DifficultyConfig> = {
  IRON:      { label: '黑铁', hexColor: '#5c5c5c', defaultScore: 10,  animated: false },
  BRONZE:    { label: '青铜', hexColor: '#8B5E3C', defaultScore: 20,  animated: false },
  SILVER:    { label: '白银', hexColor: '#9CA3AF', defaultScore: 35,  animated: false },
  GOLD:      { label: '黄金', hexColor: '#EAB308', defaultScore: 55,  animated: false },
  PLATINUM:  { label: '铂金', hexColor: '#8B9DAF', defaultScore: 80,  animated: false },
  DIAMOND:   { label: '钻石', hexColor: '#60A5FA', defaultScore: 110, animated: true, animationClass: 'difficulty-shimmer-ice' },
  MASTER:    { label: '大师', hexColor: '#A78BFA', defaultScore: 150, animated: true, animationClass: 'difficulty-shimmer-purple' },
  CHAMPION:  { label: '王者', hexColor: '#F59E0B', defaultScore: 200, animated: true, animationClass: 'difficulty-shimmer-gold' },
  LEGENDARY: { label: '传说', hexColor: '#D4A017', defaultScore: 270, animated: true, animationClass: 'difficulty-shimmer-legendary' },
};

export function getDifficultyLabel(d: string): string {
  return DIFFICULTY_CONFIG[d as DifficultyLevel]?.label ?? d;
}

export function getDifficultyHexColor(d: string): string {
  return DIFFICULTY_CONFIG[d as DifficultyLevel]?.hexColor ?? '#86909c';
}
