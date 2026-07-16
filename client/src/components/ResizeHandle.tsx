import type { CSSProperties } from "react";

interface ResizeHandleProps {
  /** col = vertical bar (resize width); row = horizontal bar (resize height) */
  direction: "col" | "row";
  dragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

/**
 * Thin drag handle between resizable panels.
 * Double-click resets to default (when onDoubleClick is provided).
 */
export default function ResizeHandle({
  direction,
  dragging = false,
  onPointerDown,
  onDoubleClick,
  style,
  className = "",
  title = "拖动调整大小，双击恢复默认",
}: ResizeHandleProps) {
  const isCol = direction === "col";

  return (
    <div
      role="separator"
      aria-orientation={isCol ? "vertical" : "horizontal"}
      title={title}
      className={`panel-resize-handle panel-resize-handle-${direction}${dragging ? " is-dragging" : ""} ${className}`.trim()}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      style={style}
    />
  );
}
