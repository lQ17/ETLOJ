export type DifficultyLevel =
  | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  | 'DIAMOND' | 'MASTER' | 'CHAMPION' | 'LEGENDARY';

export const DIFFICULTY_VALUES: DifficultyLevel[] = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'DIAMOND', 'MASTER', 'CHAMPION', 'LEGENDARY',
];

export interface DifficultyConfig {
  label: string;
  bgColor: string;
  textColor: string;
  defaultScore: number;
  animated: boolean;
  animationClass?: string;
}

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, DifficultyConfig> = {
  IRON:      { label: '黑铁', bgColor: '#F3F4F6', textColor: '#6B7280', defaultScore: 10,  animated: false },
  BRONZE:    { label: '青铜', bgColor: '#FFF7ED', textColor: '#C2410C', defaultScore: 20,  animated: false },
  SILVER:    { label: '白银', bgColor: '#F1F5F9', textColor: '#64748B', defaultScore: 35,  animated: false },
  GOLD:      { label: '黄金', bgColor: '#FEF3C7', textColor: '#B45309', defaultScore: 55,  animated: false },
  PLATINUM:  { label: '铂金', bgColor: '#E0F2FE', textColor: '#0284C7', defaultScore: 80,  animated: false },
  DIAMOND:   { label: '钻石', bgColor: '#3B82F6', textColor: '#FFFFFF', defaultScore: 110, animated: true, animationClass: 'difficulty-shimmer-ice' },
  MASTER:    { label: '大师', bgColor: '#8B5CF6', textColor: '#FFFFFF', defaultScore: 150, animated: true, animationClass: 'difficulty-shimmer-purple' },
  CHAMPION:  { label: '王者', bgColor: '#EC4899', textColor: '#FFFFFF', defaultScore: 200, animated: true, animationClass: 'difficulty-shimmer-pink' },
  LEGENDARY: { label: '传说', bgColor: '#111111', textColor: '#F59E0B', defaultScore: 270, animated: true, animationClass: 'difficulty-shimmer-legendary' },
};

export function getDifficultyLabel(d: string): string {
  return DIFFICULTY_CONFIG[d as DifficultyLevel]?.label ?? d;
}

export function getDifficultyHexColor(d: string): string {
  return DIFFICULTY_CONFIG[d as DifficultyLevel]?.textColor ?? '#86909c';
}
