import { DIFFICULTY_CONFIG } from "../constants/difficulty";
import type { DifficultyLevel } from "../constants/difficulty";

interface DifficultyTagProps {
  difficulty: string;
  size?: 'small' | 'default';
  style?: React.CSSProperties;
}

export default function DifficultyTag({ difficulty, size, style }: DifficultyTagProps) {
  const config = DIFFICULTY_CONFIG[difficulty as DifficultyLevel];
  if (!config) {
    return (
      <span
        className="difficulty-badge"
        style={{ background: '#F3F4F6', color: '#6B7280', ...style, fontSize: size === 'small' ? 12 : 13 }}
      >
        {difficulty}
      </span>
    );
  }

  return (
    <span
      className={`difficulty-badge${config.animationClass ? ` ${config.animationClass}` : ''}`}
      style={{
        background: config.bgColor,
        color: config.textColor,
        fontSize: size === 'small' ? 12 : 13,
        ...style,
      }}
    >
      {config.label}
    </span>
  );
}
