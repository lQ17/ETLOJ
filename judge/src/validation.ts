import type { JudgeTask, RunTask } from "./types";
import { MAX_CODE_LENGTH, MAX_RUN_INPUT_LENGTH, SUPPORTED_LANGUAGES } from "./types";

/** 过滤 ANSI 转义序列和控制字符，防止终端注入 */
export function sanitizeStderr(output: string): string {
  return output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** 校验判题任务输入，返回错误信息或 null */
export function validateJudgeTask(task: JudgeTask): string | null {
  if (task.code.length > MAX_CODE_LENGTH) {
    return `代码长度超过限制（最大 ${MAX_CODE_LENGTH} 字符）`;
  }
  if (!SUPPORTED_LANGUAGES.includes(task.language)) {
    return `不支持的语言: ${task.language}`;
  }
  return null;
}

/** 校验自测运行任务输入，返回错误信息或 null */
export function validateRunTask(task: RunTask): string | null {
  if (task.code.length > MAX_CODE_LENGTH) {
    return `代码长度超过限制（最大 ${MAX_CODE_LENGTH} 字符）`;
  }
  if (!SUPPORTED_LANGUAGES.includes(task.language)) {
    return `不支持的语言: ${task.language}`;
  }
  if (task.input.length > MAX_RUN_INPUT_LENGTH) {
    return `输入长度超过限制（最大 ${MAX_RUN_INPUT_LENGTH} 字符）`;
  }
  return null;
}

/** 标准化输出：trim + 统一换行 + 去除行尾空格 */
export function normalizeOutput(text: string): string {
  return (text || "").trim().replace(/\r\n/g, "\n").split("\n").map(l => l.trimEnd()).join("\n");
}
