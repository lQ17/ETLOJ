import { motion } from "framer-motion";

export interface GridData {
  grid: number[][];
  label?: string;
  highlights?: {
    current?: [number, number];
    related?: [number, number][];
    updated?: [number, number][];
  };
}

interface GridChartProps {
  grids: GridData[];
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
  highlights?: GridData["highlights"]
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
  const ratio = maxVal > 0 ? Math.min(Math.abs(value) / maxVal, 1) : 0;
  const r = Math.round(232 - ratio * 210);
  const g = Math.round(243 - ratio * 150);
  const b = Math.round(255 - ratio * 10);
  return `rgb(${r}, ${g}, ${b})`;
}

function isHighlighted(row: number, col: number, highlights?: GridData["highlights"]): boolean {
  if (!highlights) return false;
  if (highlights.current && highlights.current[0] === row && highlights.current[1] === col) return true;
  if (highlights.related?.some(([r, c]) => r === row && c === col)) return true;
  if (highlights.updated?.some(([r, c]) => r === row && c === col)) return true;
  return false;
}

function SingleGrid({ data, cols, cellSize, fontSize }: { data: GridData; cols: number; cellSize: number; fontSize: number }) {
  const { grid, label, highlights } = data;
  const maxVal = Math.max(...grid.flat().map(Math.abs), 1);
  const idxFontSize = Math.max(fontSize - 3, 9);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {label && (
        <div style={{ fontSize: 12, color: "#86909C", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      )}

      {/* Column index labels */}
      <div style={{ display: "flex", marginLeft: cellSize + 6 }}>
        {Array.from({ length: cols }, (_, c) => (
          <div key={c} style={{ width: cellSize, textAlign: "center", fontSize: idxFontSize, color: "#999", marginBottom: 2 }}>
            {c}
          </div>
        ))}
      </div>

      {/* Grid rows with row index labels */}
      {grid.map((row, r) => (
        <div key={r} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: cellSize, textAlign: "center", fontSize: idxFontSize, color: "#999", marginRight: 6, flexShrink: 0 }}>
            {r}
          </div>
          {row.map((val, c) => {
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
          })}
        </div>
      ))}
    </div>
  );
}

export default function GridChart({ grids }: GridChartProps) {
  if (!grids || grids.length === 0) return null;

  const allCols = grids.map((g) => Math.max(...g.grid.map((r) => r.length)));
  const cols = Math.max(...allCols);
  const cellSize = cols <= 5 ? 64 : cols <= 8 ? 52 : cols <= 12 ? 42 : 34;
  const fontSize = cols <= 5 ? 16 : cols <= 8 ? 14 : cols <= 12 ? 12 : 11;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 8px" }}>
      {grids.map((data, idx) => (
        <SingleGrid key={idx} data={data} cols={cols} cellSize={cellSize} fontSize={fontSize} />
      ))}
    </div>
  );
}
