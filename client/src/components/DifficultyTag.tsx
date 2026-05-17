import { Tag } from "@arco-design/web-react";
import { DIFFICULTY_CONFIG, getDifficultyLabel } from "../constants/difficulty";
import type { DifficultyLevel } from "../constants/difficulty";

interface DifficultyTagProps {
  difficulty: string;
  size?: 'small' | 'default';
  style?: React.CSSProperties;
}

export default function DifficultyTag({ difficulty, size, style }: DifficultyTagProps) {
  const config = DIFFICULTY_CONFIG[difficulty as DifficultyLevel];
  if (!config) {
    return <Tag color="gray" size={size} style={style}>{difficulty}</Tag>;
  }

  if (config.animated) {
    return (
      <Tag
        size={size}
        className={config.animationClass}
        style={{
          color: '#fff',
          border: 'none',
          fontWeight: 600,
          ...style,
        }}
      >
        {config.label}
      </Tag>
    );
  }

  return (
    <Tag
      size={size}
      style={{
        background: config.hexColor,
        color: '#fff',
        border: 'none',
        fontWeight: 500,
        ...style,
      }}
    >
      {config.label}
    </Tag>
  );
}
