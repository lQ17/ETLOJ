import { motion } from "framer-motion";

interface GridChartProps {
  grid: number[][];
  highlights?: {
    current?: [number, number];
    related?: [number, number][];
    updated?: [number, number][];
  };
  label?: string;
}

const COLORS = {
  cellBg: "#E8F3FF",
  cellBorder: "#C9DCF0",
  current: "#FF7D00",
  related: "#722ED1",
  updated: "#00B42A",
  text: "#1D2129",
};

function getCellColor(
  row: number,
  col: number,
  value: number,
  maxVal: number,
  highlights?: GridChartProps["highlights"]
): string {
  if (highlights?.current && highlights.current[0] === row && highlights.current[1] === col) {
    return COLORS.current;
  }
  if (highlights?.related?.some(([r, c]) => r === row && c === col)) {
    return COLORS.related;
  }
  if (highlights?.updated?.some(([r, c]) => r === row && c === col)) {
    return COLORS.updated;
  }
  // Default: blue intensity based on value
  const ratio = maxVal > 0 ? Math.min(Math.abs(value) / maxVal, 1) : 0;
  const r = Math.round(232 - ratio * 210); // 232 -> 22
  const g = Math.round(243 - ratio * 150); // 243 -> 93
  const b = Math.round(255 - ratio * 10);  // 255 -> 245
  return `rgb(${r}, ${g}, ${b})`;
}

function isHighlighted(row: number, col: number, highlights?: GridChartProps["highlights"]): boolean {
  if (!highlights) return false;
  if (highlights.current && highlights.current[0] === row && highlights.current[1] === col) return true;
  if (highlights.related?.some(([r, c]) => r === row && c === col)) return true;
  if (highlights.updated?.some(([r, c]) => r === row && c === col)) return true;
  return false;
}

export default function GridChart({ grid, highlights, label }: GridChartProps) {
  if (!grid || grid.length === 0) return null;

  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  const maxVal = Math.max(...grid.flat().map(Math.abs), 1);

  const cellSize = cols <= 5 ? 64 : cols <= 8 ? 52 : cols <= 12 ? 42 : 34;
  const fontSize = cols <= 5 ? 16 : cols <= 8 ? 14 : cols <= 12 ? 12 : 11;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px" }}>
      {label && (
        <div style={{ fontSize: 13, color: "#86909C", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gap: 3,
        }}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const highlighted = isHighlighted(r, c, highlights);
            const bgColor = getCellColor(r, c, val, maxVal, highlights);

            return (
              <motion.div
                key={`${r}-${c}`}
                animate={{
                  backgroundColor: bgColor,
                  scale: highlighted ? 1.08 : 1,
                }}
                transition={{ duration: 0.25 }}
                style={{
                  width: cellSize,
                  height: cellSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  border: highlighted
                    ? `2px solid ${bgColor}`
                    : "1px solid #C9DCF0",
                  fontSize,
                  fontWeight: highlighted ? 700 : 500,
                  color: highlighted ? "#fff" : COLORS.text,
                  cursor: "default",
                }}
              >
                {val}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
