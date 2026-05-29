import { useMemo } from "react";
import { motion } from "framer-motion";
import type { VisualStep, BarItem } from "../../algorithms/types";

interface BarChartProps {
  step: VisualStep;
  bars?: BarItem[];
}

const COLORS = {
  default: "#165DFF",
  comparing: "#FF7D00",
  swapping: "#F53F3F",
  sorted: "#00B42A",
  pivot: "#722ED1",
  active: "#86909C",
  eliminated: "#E5E6EB",
  mid: "#FF7D00",
  found: "#00B42A",
};

function getBarColor(index: number, highlights: VisualStep["highlights"]): string {
  if (highlights.found === index) return COLORS.found;
  if (highlights.sorted?.includes(index)) return COLORS.sorted;
  if (highlights.swapping?.includes(index)) return COLORS.swapping;
  if (highlights.mid === index) return COLORS.mid;
  if (highlights.comparing?.includes(index)) return COLORS.comparing;
  if (highlights.eliminated?.includes(index)) return COLORS.eliminated;
  if (highlights.pivot === index) return COLORS.pivot;
  if (highlights.active?.includes(index)) return COLORS.active;
  return COLORS.default;
}

const CHART_HEIGHT = 360;

function PointerMarkers({ highlights, barCount }: { highlights: VisualStep["highlights"]; barCount: number }) {
  const { left, right, mid, found } = highlights;
  if (left === undefined && right === undefined && mid === undefined && found === undefined) {
    return null;
  }

  const pct = (i: number) => `${(i / barCount) * 100}%`;

  return (
    <div style={{ position: "relative", height: 44, margin: "4px 10px 0" }}>
      {/* mid / found tags row */}
      <div style={{ display: "flex", position: "relative" }}>
        {Array.from({ length: barCount }, (_, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
            {found === i ? (
              <span style={{ background: COLORS.found, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>FOUND</span>
            ) : mid === i ? (
              <span style={{ background: COLORS.mid, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>mid={i}</span>
            ) : null}
          </div>
        ))}
      </div>
      {/* L/R row */}
      <div style={{ display: "flex", position: "relative", marginTop: 2 }}>
        {Array.from({ length: barCount }, (_, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
            {left === i && right === i ? (
              <span style={{ background: "#165DFF", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>L=R={i}</span>
            ) : left === i ? (
              <span style={{ background: "#165DFF", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>L={i}</span>
            ) : right === i ? (
              <span style={{ background: "#165DFF", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>R={i}</span>
            ) : null}
          </div>
        ))}
      </div>
      {/* bracket */}
      {left !== undefined && right !== undefined && left <= right && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: pct(left),
          width: `calc(${pct(right - left + 1)})`,
          borderBottom: "2px solid #165DFF",
          borderLeft: "2px solid #165DFF",
          borderRight: "2px solid #165DFF",
          height: 8,
          borderRadius: "0 0 4px 4px",
        }} />
      )}
    </div>
  );
}

export default function BarChart({ step, bars: barsProp }: BarChartProps) {
  const { array, highlights } = step;
  const maxVal = Math.max(...array, 1);

  const bars = useMemo(() => {
    if (barsProp) return barsProp;
    return array.map((value, index) => ({ id: index, value }));
  }, [barsProp, array]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 2,
          height: CHART_HEIGHT,
          padding: "20px 10px 0",
        }}
      >
        {bars.map((bar, index) => {
          const barHeight = (bar.value / maxVal) * (CHART_HEIGHT - 24);
          const color = getBarColor(index, highlights);

          return (
            <motion.div
              key={bar.id}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                width: `${Math.max(100 / bars.length - 1, 2)}%`,
                maxWidth: 60,
                minWidth: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {bars.length <= 30 && (
                <motion.span
                  animate={{ color }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontSize: bars.length <= 15 ? 12 : 10,
                    marginBottom: 4,
                    fontWeight: 500,
                    color: "var(--color-text-2)",
                  }}
                >
                  {bar.value}
                </motion.span>
              )}
              <motion.div
                animate={{
                  height: barHeight,
                  backgroundColor: color,
                }}
                transition={{ duration: 0.2 }}
                style={{
                  width: "100%",
                  borderRadius: "3px 3px 0 0",
                  minHeight: 4,
                }}
              />
            </motion.div>
          );
        })}
      </div>
      <PointerMarkers highlights={highlights} barCount={bars.length} />
    </div>
  );
}
