/**
 * C / C++ Monarch tokenizer（面向 Dev-C++ 主题）
 *
 * - {} () [] → operator.*（#FF0000）
 * - #include 等预处理 → preproc（绿色、不加粗）
 * - 字符字面量 → string.char（黑色）
 */

const keywords = [
  "abstract", "amp", "array", "auto", "bool", "break", "case", "catch", "char",
  "class", "const", "constexpr", "const_cast", "continue", "cpu", "decltype",
  "default", "delegate", "delete", "do", "double", "dynamic_cast", "each",
  "else", "enum", "event", "explicit", "export", "extern", "false", "final",
  "finally", "float", "for", "friend", "gcnew", "generic", "goto", "if", "in",
  "initonly", "inline", "int", "interface", "interior_ptr", "internal", "literal",
  "long", "mutable", "namespace", "new", "noexcept", "nullptr", "__nullptr",
  "operator", "override", "partial", "pascal", "pin_ptr", "private", "property",
  "protected", "public", "ref", "register", "reinterpret_cast", "restrict",
  "return", "safe_cast", "sealed", "short", "signed", "sizeof", "static",
  "static_assert", "static_cast", "struct", "switch", "template", "this",
  "thread_local", "throw", "tile_static", "true", "try", "typedef", "typeid",
  "typename", "union", "unsigned", "using", "virtual", "void", "volatile",
  "wchar_t", "where", "while",
  "_asm", "_based", "_cdecl", "_declspec", "_fastcall", "_if_exists",
  "_if_not_exists", "_inline", "_multiple_inheritance", "_pascal",
  "_single_inheritance", "_stdcall", "_virtual_inheritance", "_w64",
  "__abstract", "__alignof", "__asm", "__assume", "__based", "__box",
  "__builtin_alignof", "__cdecl", "__clrcall", "__declspec", "__delegate",
  "__event", "__except", "__fastcall", "__finally", "__forceinline", "__gc",
  "__hook", "__identifier", "__if_exists", "__if_not_exists", "__inline",
  "__int128", "__int16", "__int32", "__int64", "__int8", "__interface",
  "__leave", "__m128", "__m128d", "__m128i", "__m256", "__m256d", "__m256i",
  "__m512", "__m512d", "__m512i", "__m64", "__multiple_inheritance",
  "__newslot", "__nogc", "__noop", "__nounwind", "__novtordisp", "__pascal",
  "__pin", "__pragma", "__property", "__ptr32", "__ptr64", "__raise",
  "__restrict", "__resume", "__sealed", "__single_inheritance", "__stdcall",
  "__super", "__thiscall", "__try", "__try_cast", "__typeof", "__unaligned",
  "__unhook", "__uuidof", "__value", "__virtual_inheritance", "__w64",
  "__wchar_t",
];

const operators = [
  "=", ">", "<", "!", "~", "?", ":",
  "==", "<=", ">=", "!=", "&&", "||", "++", "--",
  "+", "-", "*", "/", "&", "|", "^", "%", "<<", ">>",
  "+=", "-=", "*=", "/=", "&=", "|=", "^=", "%=", "<<=", ">>=",
];

function createLanguage(tokenPostfix: string) {
  return {
    defaultToken: "",
    tokenPostfix,
    brackets: [
      { token: "operator.curly", open: "{", close: "}" },
      { token: "operator.paren", open: "(", close: ")" },
      { token: "operator.square", open: "[", close: "]" },
      { token: "operator.angle", open: "<", close: ">" },
    ],
    keywords,
    operators,
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[0abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    integersuffix: /([uU](ll|LL|l|L)|(ll|LL|l|L)?[uU]?)/,
    floatsuffix: /[fFlL]?/,
    encoding: /u|u8|U|L/,
    tokenizer: {
      root: [
        [/@encoding?R"(?:([^ ()\\\t]*))\(/, { token: "string.raw.begin", next: "@raw.$1" }],

        // 预处理：独立 preproc（绿、不加粗）
        [/^\s*#\s*include\b/, { token: "preproc", next: "@include" }],
        [/^\s*#\s*\w+/, "preproc"],

        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": { token: "keyword.$0" },
              "@default": "identifier",
            },
          },
        ],

        { include: "@whitespace" },

        [/\[\s*\[/, { token: "annotation", next: "@annotation" }],

        // {} () [] 全部走 operator（与 ; = 同一 token 族，保证 #FF0000）
        [/[{}()\[\]]/, "operator"],

        [
          /@symbols/,
          {
            cases: {
              "@operators": "operator",
              "@default": "operator",
            },
          },
        ],

        [/\d*\d+[eE]([-+]?\d+)?(@floatsuffix)/, "number.float"],
        [/\d*\.\d+([eE][-+]?\d+)?(@floatsuffix)/, "number.float"],
        [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, "number.hex"],
        [/0[0-7']*[0-7](@integersuffix)/, "number.octal"],
        [/0[bB][0-1']*[0-1](@integersuffix)/, "number.binary"],
        [/\d[\d']*\d(@integersuffix)/, "number"],
        [/\d(@integersuffix)/, "number"],

        [/[;,.]/, "operator"],

        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],

        [/'[^\\']'/, "string.char"],
        [/(')(@escapes)(')/, ["string.char", "string.char", "string.char"]],
        [/'/, "string.invalid"],
      ],

      whitespace: [
        [/[ \t\r\n]+/, ""],
        [/\/\*\*(?!\/)/, "comment.doc", "@doccomment"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*\\$/, "comment", "@linecomment"],
        [/\/\/.*$/, "comment"],
      ],

      comment: [
        [/[^\/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],

      linecomment: [
        [/.*[^\\]$/, "comment", "@pop"],
        [/[^]+/, "comment"],
      ],

      doccomment: [
        [/[^\/*]+/, "comment.doc"],
        [/\*\//, "comment.doc", "@pop"],
        [/[\/*]/, "comment.doc"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string", "@pop"],
      ],

      raw: [
        [/[^)]+/, "string.raw"],
        [/\)$S2"/, { token: "string.raw.end", next: "@pop" }],
        [/\)/, "string.raw"],
      ],

      annotation: [
        { include: "@whitespace" },
        [/using|alignas/, "keyword"],
        [/[a-zA-Z0-9_]+/, "annotation"],
        [/[,:]/, "operator"],
        [/[()]/, "operator"],
        [/\]\s*\]/, { token: "annotation", next: "@pop" }],
      ],

      include: [
        [
          /(\s*)(<)([^<>]*)(>)/,
          ["", "preproc", "preproc", { token: "preproc", next: "@pop" }],
        ],
        [
          /(\s*)(")([^"]*)(")/,
          ["", "preproc", "preproc", { token: "preproc", next: "@pop" }],
        ],
        [/\s*$/, "", "@pop"],
        [/./, "preproc", "@pop"],
      ],
    },
  };
}

/** 仅刷新 Monarch provider（可重复调用），并强制已打开模型重新分词 */
export function applyCppDevCppTokens(monaco: any): void {
  monaco.languages.setMonarchTokensProvider("cpp", createLanguage(".cpp"));
  monaco.languages.setMonarchTokensProvider("c", createLanguage(".c"));

  // 已打开的 model 可能仍缓存旧 token，重置 language 触发重分词
  try {
    for (const model of monaco.editor.getModels()) {
      const id = model.getLanguageId?.();
      if (id === "cpp" || id === "c") {
        monaco.editor.setModelLanguage(model, id);
      }
    }
  } catch {
    /* ignore */
  }
}

let languageHooksInstalled = false;

/** 注册 tokenizer，并在语言首次加载时再次覆盖内置定义 */
export function registerCppDevCppTokens(monaco: any): void {
  applyCppDevCppTokens(monaco);

  if (languageHooksInstalled) return;
  languageHooksInstalled = true;

  // 内置 basic-languages 可能在首次使用 language 时才 setMonarch，延迟一帧再盖一次
  const reapply = () => {
    applyCppDevCppTokens(monaco);
    // 再延迟一次，压过异步加载的内置 grammar
    setTimeout(() => applyCppDevCppTokens(monaco), 0);
    setTimeout(() => applyCppDevCppTokens(monaco), 50);
  };

  monaco.languages.onLanguage("cpp", reapply);
  monaco.languages.onLanguage("c", reapply);
}
