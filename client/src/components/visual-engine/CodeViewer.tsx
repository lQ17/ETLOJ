import { useEffect, useRef } from "react";

interface CodeViewerProps {
  sourceCode: string;
  activeLine?: number;
  variables?: Record<string, number | string>;
  array?: number[];
}

export default function CodeViewer({ sourceCode, activeLine, variables, array }: CodeViewerProps) {
  const lines = sourceCode.split("\n");
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeRef.current;
      const top = el.offsetTop - container.offsetTop;
      if (top < container.scrollTop || top + el.offsetHeight > container.scrollTop + container.clientHeight) {
        container.scrollTop = top - container.clientHeight / 3;
      }
    }
  }, [activeLine]);

  const varEntries = variables ? Object.entries(variables) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      <div
        ref={containerRef}
        style={{
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          fontSize: 12,
          lineHeight: 1.7,
          maxHeight: 220,
          overflow: "auto",
          borderRadius: 6,
          background: "var(--color-bg-2, #f7f8fa)",
          border: "1px solid var(--color-border, #e5e6eb)",
        }}
      >
        {lines.map((text, idx) => {
          const lineNum = idx + 1;
          const isActive = lineNum === activeLine;
          return (
            <div
              key={idx}
              ref={isActive ? activeRef : undefined}
              style={{
                display: "flex",
                padding: "0 10px",
                background: isActive ? "rgba(22, 93, 255, 0.1)" : "transparent",
                borderLeft: isActive ? "3px solid #165DFF" : "3px solid transparent",
                transition: "background 0.2s",
              }}
            >
              <span
                style={{
                  width: 28,
                  textAlign: "right",
                  paddingRight: 10,
                  color: isActive ? "#165DFF" : "var(--color-text-4, #c9cdd4)",
                  userSelect: "none",
                  flexShrink: 0,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {lineNum}
              </span>
              <span style={{ color: "var(--color-text-1, #1d2129)", whiteSpace: "pre" }}>
                {text}
              </span>
            </div>
          );
        })}
      </div>

      {(varEntries.length > 0 || array) && (
        <div
          style={{
            fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 6,
            background: "var(--color-bg-2, #f7f8fa)",
            border: "1px solid var(--color-border, #e5e6eb)",
            lineHeight: 1.6,
          }}
        >
          {varEntries.length > 0 && (
            <div>
              {varEntries.map(([key, val], idx) => (
                <span key={key}>
                  {idx > 0 && <span style={{ color: "var(--color-text-4, #c9cdd4)", margin: "0 6px" }}>|</span>}
                  <span style={{ color: "#722ED1", fontWeight: 500 }}>{key}</span>
                  <span style={{ color: "var(--color-text-3, #86909c)" }}>=</span>
                  <span style={{ color: "#165DFF" }}>{val}</span>
                </span>
              ))}
            </div>
          )}
          {array && (
            <div style={{ marginTop: varEntries.length > 0 ? 2 : 0, color: "var(--color-text-2, #4e5969)" }}>
              arr = [{array.join(", ")}]
            </div>
          )}
        </div>
      )}
    </div>
  );
}
