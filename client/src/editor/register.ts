import { defineDevCppTheme, DEV_CPP_THEME_ID } from "./themes/dev-cpp";
import { applyCppDevCppTokens, registerCppDevCppTokens } from "./languages/cpp-devcpp";

let hooksInstalled = false;

/**
 * 注册 Monaco 扩展：Dev-C++ 主题 + C/C++ Monarch。
 * - 主题每次 redefine（HMR 后颜色才能更新）
 * - tokenizer 可重复 apply；onLanguage 钩子只装一次
 */
export function registerMonacoExtras(monaco: any): void {
  defineDevCppTheme(monaco);

  if (!hooksInstalled) {
    registerCppDevCppTokens(monaco);
    hooksInstalled = true;
  } else {
    applyCppDevCppTokens(monaco);
  }
}

/**
 * 强制应用主题。
 * Monaco 规定：defineTheme 更新后必须再 setTheme，CSS 才会刷新。
 */
export function applyEditorTheme(monaco: any, themeId: string): void {
  if (themeId === DEV_CPP_THEME_ID) {
    defineDevCppTheme(monaco);
    applyCppDevCppTokens(monaco);
  }
  monaco.editor.setTheme(themeId);
}
