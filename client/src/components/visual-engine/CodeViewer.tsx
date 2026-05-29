import { useEffect, useRef, useMemo } from "react";

interface CodeViewerProps {
  sourceCode: string;
  activeLine?: number;
  variables?: Record<string, number | string>;
  array?: number[];
}

// C/C++ syntax highlighting
const KEYWORDS = new Set([
  "int", "void", "for", "while", "if", "else", "return", "const",
  "char", "float", "double", "long", "short", "unsigned", "signed",
  "struct", "class", "typedef", "sizeof", "NULL", "MAXN",
]);

const TYPES = new Set(["int", "void", "char", "float", "double", "long", "short"]);

function highlightLine(text: string): { text: string; color?: string }[] {
  const tokens: { text: string; color?: string }[] = [];
  let i = 0;

  while (i < text.length) {
    // Comment
    if (text[i] === "/" && text[i + 1] === "/") {
      tokens.push({ text: text.slice(i), color: "#6A9955" });
      return tokens;
    }

    // String
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      tokens.push({ text: text.slice(i, j + 1), color: "#CE9178" });
      i = j + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[0-9]/.test(text[j])) j++;
      tokens.push({ text: text.slice(i, j), color: "#B5CEA8" });
      i = j;
      continue;
    }

    // Word (keyword, type, identifier)
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_]/.test(text[j])) j++;
      const word = text.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, color: "#569CD6" });
      } else if (TYPES.has(word)) {
        tokens.push({ text: word, color: "#4EC9B0" });
      } else if (j < text.length && text[j] === "(") {
        tokens.push({ text: word, color: "#DCDCAA" }); // function call
      } else {
        tokens.push({ text: word }); // default
      }
      i = j;
      continue;
    }

    // Operators
    if ("=+-*/<>!&|".includes(text[i])) {
      let j = i + 1;
      if (j < text.length && "=+-<>|&".includes(text[j])) j++;
      tokens.push({ text: text.slice(i, j), color: "#D4D4D4" });
      i = j;
      continue;
    }

    // Brackets
    if ("(){}[]".includes(text[i])) {
      tokens.push({ text: text[i], color: "#FFD700" });
      i++;
      continue;
    }

    // Semicolons, commas
    if (";,".includes(text[i])) {
      tokens.push({ text: text[i], color: "#D4D4D4" });
      i++;
      continue;
    }

    // Whitespace and other
    tokens.push({ text: text[i] });
    i++;
  }

  return tokens;
}

export default function CodeViewer({ sourceCode, activeLine, variables, array }: CodeViewerProps) {
  const lines = sourceCode.split("\n");
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const highlightedLines = useMemo(
    () => lines.map((line) => highlightLine(line)),
    [sourceCode]
  );

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
          fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
          fontSize: 12,
          lineHeight: 1.7,
          maxHeight: 260,
          overflow: "auto",
          borderRadius: 6,
          background: "#1e1e1e",
          border: "1px solid #333",
        }}
      >
        {highlightedLines.map((tokens, idx) => {
          const lineNum = idx + 1;
          const isActive = lineNum === activeLine;
          return (
            <div
              key={idx}
              ref={isActive ? activeRef : undefined}
              style={{
                display: "flex",
                padding: "0 10px",
                background: isActive ? "rgba(22, 93, 255, 0.2)" : "transparent",
                borderLeft: isActive ? "3px solid #165DFF" : "3px solid transparent",
                transition: "background 0.2s",
              }}
            >
              <span
                style={{
                  width: 28,
                  textAlign: "right",
                  paddingRight: 10,
                  color: isActive ? "#8AB4F8" : "#5A5A5A",
                  userSelect: "none",
                  flexShrink: 0,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {lineNum}
              </span>
              <span style={{ whiteSpace: "pre" }}>
                {tokens.map((token, ti) => (
                  <span key={ti} style={{ color: token.color || "#D4D4D4" }}>
                    {token.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {(varEntries.length > 0 || array) && (
        <div
          style={{
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 6,
            background: "#1e1e1e",
            border: "1px solid #333",
            lineHeight: 1.6,
          }}
        >
          {varEntries.length > 0 && (
            <div>
              {varEntries.map(([key, val], idx) => (
                <span key={key}>
                  {idx > 0 && <span style={{ color: "#5A5A5A", margin: "0 6px" }}>|</span>}
                  <span style={{ color: "#9CDCFE", fontWeight: 500 }}>{key}</span>
                  <span style={{ color: "#D4D4D4" }}>=</span>
                  <span style={{ color: "#B5CEA8" }}>{val}</span>
                </span>
              ))}
            </div>
          )}
          {array && (
            <div style={{ marginTop: varEntries.length > 0 ? 2 : 0, color: "#808080" }}>
              arr = [{array.join(", ")}]
            </div>
          )}
        </div>
      )}
    </div>
  );
}
