/** Dev-C++ `oi` 语法主题 — Monaco 主题 ID 与 defineTheme 定义 */

export const DEV_CPP_THEME_ID = "dev-cpp";
export const DEV_CPP_THEME_LABEL = "Dev-C++";

/** 做题页编辑器主题合法取值（含内置 + 自定义） */
export const EDITOR_THEME_VALUES = ["vs", "vs-dark", "auto", DEV_CPP_THEME_ID] as const;
export type EditorThemeValue = (typeof EDITOR_THEME_VALUES)[number];

export function isEditorThemeValue(v: string): v is EditorThemeValue {
  return (EDITOR_THEME_VALUES as readonly string[]).includes(v);
}

/**
 * 注册 / 更新 Dev-C++ 主题。
 * 注意：defineTheme 更新后必须再 setTheme 才会刷新颜色（由调用方负责）。
 */
export function defineDevCppTheme(monaco: any): void {
  monaco.editor.defineTheme(DEV_CPP_THEME_ID, {
    base: "vs",
    inherit: false,
    rules: [
      // 关键字 / 类型：黑 + 粗
      { token: "keyword", foreground: "000000", fontStyle: "bold" },
      { token: "type", foreground: "000000", fontStyle: "bold" },

      // 预处理（独立 token，不挂在 keyword 下，避免继承 bold）
      { token: "preproc", foreground: "008000", fontStyle: "" },

      // 双引号字符串：蓝 + 粗
      { token: "string", foreground: "0000FF", fontStyle: "bold" },
      { token: "string.raw", foreground: "0000FF", fontStyle: "bold" },
      { token: "string.escape", foreground: "0000FF", fontStyle: "bold" },
      { token: "string.invalid", foreground: "0000FF", fontStyle: "bold" },

      // 字符字面量：黑、不加粗
      { token: "string.char", foreground: "000000", fontStyle: "" },

      // 运算符 / 括号 / 标点：#FF0000 + 粗
      { token: "operator", foreground: "FF0000", fontStyle: "bold" },
      { token: "operator.curly", foreground: "FF0000", fontStyle: "bold" },
      { token: "operator.paren", foreground: "FF0000", fontStyle: "bold" },
      { token: "operator.square", foreground: "FF0000", fontStyle: "bold" },
      { token: "operator.angle", foreground: "FF0000", fontStyle: "bold" },
      { token: "delimiter", foreground: "FF0000", fontStyle: "bold" },
      { token: "delimiter.curly", foreground: "FF0000", fontStyle: "bold" },
      { token: "delimiter.parenthesis", foreground: "FF0000", fontStyle: "bold" },
      { token: "delimiter.square", foreground: "FF0000", fontStyle: "bold" },
      { token: "delimiter.bracket", foreground: "FF0000", fontStyle: "bold" },
      { token: "delimiter.angle", foreground: "FF0000", fontStyle: "bold" },

      // 数字：紫
      { token: "number", foreground: "800080", fontStyle: "" },

      // 注释
      { token: "comment", foreground: "0078D7", fontStyle: "" },

      // 标识符
      { token: "identifier", foreground: "000000", fontStyle: "" },
      { token: "annotation", foreground: "000000", fontStyle: "" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#000000",
      "editorLineNumber.foreground": "#000000",
      "editorLineNumber.activeForeground": "#000000",
      // 当前行高亮（用户要求 #CCFFFF，非 Dev-C++ 默认 #FFFFCC）
      "editor.lineHighlightBackground": "#CCFFFF",
      "editor.lineHighlightBorder": "#00000000",
      // 选区：深蓝底 + 白字（selectionForeground 要求底色不透明才会生效）
      "editor.selectionBackground": "#000080",
      "editor.selectionForeground": "#FFFFFF",
      "editor.inactiveSelectionBackground": "#000080",
      "editor.inactiveSelectionForeground": "#FFFFFF",
      "editor.selectionHighlightBackground": "#00008055",
      "editorCursor.foreground": "#000000",
      "editorWhitespace.foreground": "#D4D4D4",
      "editorIndentGuide.background": "#D3D3D3",
      "editorIndentGuide.activeBackground": "#A9A9A9",
      // 括号对着色会盖掉 token 色，统一成 #FF0000（与 Dev-C++ Symbol 一致）
      "editorBracketHighlight.foreground1": "#FF0000",
      "editorBracketHighlight.foreground2": "#FF0000",
      "editorBracketHighlight.foreground3": "#FF0000",
      "editorBracketHighlight.foreground4": "#FF0000",
      "editorBracketHighlight.foreground5": "#FF0000",
      "editorBracketHighlight.foreground6": "#FF0000",
      "editorBracketHighlight.unexpectedBracket.foreground": "#FF0000",
      "editorBracketMatch.border": "#FF0000",
      "editorBracketMatch.background": "#00000000",
    },
  });
}
