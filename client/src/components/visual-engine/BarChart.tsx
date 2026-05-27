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
};

function getBarColor(index: number, highlights: VisualStep["highlights"]): string {
  if (highlights.sorted?.includes(index)) return COLORS.sorted;
  if (highlights.swapping?.includes(index)) return COLORS.swapping;
  if (highlights.comparing?.includes(index)) return COLORS.comparing;
  if (highlights.pivot === index) return COLORS.pivot;
  if (highlights.active?.includes(index)) return COLORS.active;
  return COLORS.default;
}

const CHART_HEIGHT = 360;

export default function BarChart({ step, bars: barsProp }: BarChartProps) {
  const { array, highlights } = step;
  const maxVal = Math.max(...array, 1);

  // bars: stable-id items ordered by current position
  const bars = useMemo(() => {
    if (barsProp) return barsProp;
    return array.map((value, index) => ({ id: index, value }));
  }, [barsProp, array]);

  return (
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
  );
}
