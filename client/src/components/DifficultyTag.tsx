import { DIFFICULTY_CONFIG } from "../constants/difficulty";
import type { DifficultyLevel } from "../constants/difficulty";
import { useState } from "react";

interface DifficultyTagProps {
  difficulty: string;
  size?: 'small' | 'default';
  style?: React.CSSProperties;
}

export default function DifficultyTag({ difficulty, size, style }: DifficultyTagProps) {
  const config = DIFFICULTY_CONFIG[difficulty as DifficultyLevel];
  const [imgError, setImgError] = useState(false);
  const height = size === 'small' ? 22 : 28;

  // SVG 加载失败或无配置时，回退到文字 badge
  if (!config || imgError) {
    return (
      <span
        className="difficulty-badge"
        style={{ background: '#F3F4F6', color: '#6B7280', ...style, fontSize: size === 'small' ? 12 : 13 }}
      >
        {config?.label ?? difficulty}
      </span>
    );
  }

  return (
    <img
      src={config.svg}
      alt={config.label}
      onError={() => setImgError(true)}
      style={{ height, width: 'auto', display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  );
}
