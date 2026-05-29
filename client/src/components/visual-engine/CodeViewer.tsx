import { useEffect, useRef, useMemo } from "react";

interface CodeViewerProps {
  sourceCode: string;
  activeLine?: number;
  variables?: Record<string, number | string>;
  array?: number[];
}

// C/C++ syntax highlighting — VS Code Light+ theme
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
      tokens.push({ text: text.slice(i), color: "#008000" });
      return tokens;
    }

    // String
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      tokens.push({ text: text.slice(i, j + 1), color: "#A31515" });
      i = j + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[0-9]/.test(text[j])) j++;
      tokens.push({ text: text.slice(i, j), color: "#098658" });
      i = j;
      continue;
    }

    // Word (keyword, type, identifier)
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_]/.test(text[j])) j++;
      const word = text.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, color: "#0000FF" });
      } else if (TYPES.has(word)) {
        tokens.push({ text: word, color: "#267F99" });
      } else if (j < text.length && text[j] === "(") {
        tokens.push({ text: word, color: "#795E26" });
      } else {
        tokens.push({ text: word });
      }
      i = j;
      continue;
    }

    // Operators
    if ("=+-*/<>!&|".includes(text[i])) {
      let j = i + 1;
      if (j < text.length && "=+-<>|&".includes(text[j])) j++;
      tokens.push({ text: text.slice(i, j), color: "#000000" });
      i = j;
      continue;
    }

    // Brackets
    if ("(){}[]".includes(text[i])) {
      tokens.push({ text: text[i], color: "#000000" });
      i++;
      continue;
    }

    // Semicolons, commas
    if (";,".includes(text[i])) {
      tokens.push({ text: text[i], color: "#000000" });
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
          fontSize: 18,
          lineHeight: 1.7,
          maxHeight: 360,
          overflow: "auto",
          borderRadius: 6,
          background: "#FFFFFF",
          border: "1px solid #E5E6EB",
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
                padding: "0 12px",
                background: isActive ? "#E8F3FF" : "transparent",
                borderLeft: isActive ? "3px solid #165DFF" : "3px solid transparent",
                transition: "background 0.2s",
              }}
            >
              <span
                style={{
                  width: 36,
                  textAlign: "right",
                  paddingRight: 12,
                  color: isActive ? "#165DFF" : "#999",
                  userSelect: "none",
                  flexShrink: 0,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {lineNum}
              </span>
              <span style={{ whiteSpace: "pre" }}>
                {tokens.map((token, ti) => (
                  <span key={ti} style={{ color: token.color || "#000000" }}>
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
            fontSize: 18,
            padding: "8px 12px",
            borderRadius: 6,
            background: "#FFFFFF",
            border: "1px solid #E5E6EB",
            lineHeight: 1.6,
          }}
        >
          {varEntries.length > 0 && (
            <div>
              {varEntries.map(([key, val], idx) => (
                <span key={key}>
                  {idx > 0 && <span style={{ color: "#CCC", margin: "0 8px" }}>|</span>}
                  <span style={{ color: "#267F99", fontWeight: 500 }}>{key}</span>
                  <span style={{ color: "#000" }}>=</span>
                  <span style={{ color: "#098658" }}>{val}</span>
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
