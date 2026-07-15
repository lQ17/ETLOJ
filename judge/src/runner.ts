import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { JudgeTask, JudgeResult, RunTask, RunResult, TestCaseResult } from "./types";
import { validateJudgeTask, validateRunTask, normalizeOutput } from "./validation";
import { goJudgeCompile, goJudgeRunOneTest } from "./goJudge";
import { localCompile, localRunOneTest } from "./localJudge";

// ─── go-judge 状态映射 ───

function mapGoJudgeStatus(raw: string, exitCode: number): string | null {
  if (raw === "Time Limit Exceeded") return "TLE";
  if (raw === "Memory Limit Exceeded") return "MLE";
  if (exitCode !== 0) return "RE";
  return null; // 正常退出
}

// ─── 统一判题核心 ───

type CompileResult = { ok: boolean; artifact?: string; error?: string };
type TestRunResult = { status: string; exitCode: number; time: number; memory: number; stdout: string; stderr: string };

async function judgeWithBackend(
  task: JudgeTask,
  compile: (code: string, lang: string) => Promise<CompileResult> | CompileResult,
  runTest: (lang: string, artifact: string | undefined, code: string, input: string, timeLimit: number, memoryLimit: number) => Promise<TestRunResult> | TestRunResult,
  mapStatus: (raw: string, exitCode: number) => string | null,
  getMemory: (r: TestRunResult) => number,
): Promise<JudgeResult> {
  const { submissionId, code, language, testcases, timeLimit, memoryLimit } = task;

  const compiled = await compile(code, language);
  if (!compiled.ok) {
    return { submissionId, status: "CE", timeUsed: 0, memoryUsed: 0, score: 0, testcases: [{ index: 1, status: "CE", timeUsed: 0, memoryUsed: 0 }] };
  }

  const totalCount = testcases.length;
  if (totalCount === 0) {
    return { submissionId, status: "SE", timeUsed: 0, memoryUsed: 0, score: 0, testcases: [] };
  }

  const testcaseResults: TestCaseResult[] = [];
  let passedCount = 0;
  let firstFailStatus = "";
  // 提交级 timeUsed / memoryUsed 取所有测试点的最大值（OJ 常规语义，非总和）
  let maxTime = 0;
  let maxMemory = 0;

  for (let i = 0; i < testcases.length; i++) {
    const tc = testcases[i];
    const r = await runTest(language, compiled.artifact, code, tc.input, timeLimit, memoryLimit);

    const mapped = mapStatus(r.status, r.exitCode);
    let caseStatus: string | null = mapped;

    if (caseStatus === null) {
      // 状态正常，检查输出
      const stdout = normalizeOutput(r.stdout);
      const expected = normalizeOutput(tc.expectedOutput);
      if (stdout !== expected) caseStatus = "WA";
    }

    // 每个已运行测试点都参与 max 统计（含后续失败点）
    maxTime = Math.max(maxTime, r.time);
    maxMemory = Math.max(maxMemory, getMemory(r));

    if (caseStatus === null) {
      passedCount++;
    } else if (!firstFailStatus) {
      firstFailStatus = caseStatus;
    }

    testcaseResults.push({
      index: i + 1,
      status: caseStatus || "AC",
      timeUsed: Math.round(r.time / 1e6),
      memoryUsed: Math.round(r.memory / 1024),
    });
  }

  if (passedCount === totalCount) {
    return { submissionId, status: "AC", timeUsed: Math.round(maxTime / 1e6), memoryUsed: Math.round(maxMemory / 1024), score: 100, testcases: testcaseResults };
  }

  return {
    submissionId,
    status: firstFailStatus,
    timeUsed: Math.round(maxTime / 1e6),
    memoryUsed: Math.round(maxMemory / 1024),
    score: Math.round((passedCount / totalCount) * 100),
    testcases: testcaseResults,
  };
}

// ─── 导出：判题入口 ───

export async function judge(task: JudgeTask): Promise<JudgeResult> {
  const validationError = validateJudgeTask(task);
  if (validationError) {
    console.warn(`[#${task.submissionId}] 任务校验失败: ${validationError}`);
    return { submissionId: task.submissionId, status: "SE", timeUsed: 0, memoryUsed: 0, score: 0, testcases: [] };
  }

  if (process.env.JUDGE_MODE === "local") {
    return judgeLocal(task);
  }
  return judgeGoJudge(task);
}

async function judgeGoJudge(task: JudgeTask): Promise<JudgeResult> {
  return judgeWithBackend(
    task,
    async (code, lang) => {
      const r = await goJudgeCompile(code, lang);
      return { ok: r.ok, artifact: r.artifact, error: r.error };
    },
    async (lang, artifactId, code, input, timeLimit, memoryLimit) => {
      const r = await goJudgeRunOneTest(lang, artifactId, code, input, timeLimit, memoryLimit);
      return { status: r.status, exitCode: r.exitCode, time: r.time, memory: r.memory, stdout: r.stdout, stderr: r.stderr };
    },
    mapGoJudgeStatus,
    (r) => r.memory,
  );
}

async function judgeLocal(task: JudgeTask): Promise<JudgeResult> {
  const workDir = mkdtempSync(join(tmpdir(), "etloj-judge-"));
  try {
    return await judgeWithBackend(
      task,
      (code, lang) => localCompile(code, lang, workDir),
      (lang, artifact, code, input, timeLimit) => localRunOneTest(lang, artifact!, input, timeLimit),
      (raw, exitCode) => {
        if (raw === "TLE") return "TLE";
        if (exitCode !== 0) return "RE";
        return null;
      },
      () => 0, // local 模式不追踪内存
    );
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── 导出：自测运行 ───

export async function runSingle(task: RunTask): Promise<RunResult> {
  const validationError = validateRunTask(task);
  if (validationError) {
    console.warn(`[RUN:${task.runId}] 任务校验失败: ${validationError}`);
    return { status: "SE", stdout: "", stderr: validationError, timeUsed: 0 };
  }

  const { code, language, input, timeLimit } = task;

  if (process.env.JUDGE_MODE === "local") {
    const workDir = mkdtempSync(join(tmpdir(), "etloj-run-"));
    try {
      const compiled = localCompile(code, language, workDir);
      if (!compiled.ok) {
        return { status: "CE", stdout: "", stderr: compiled.error || "Compile error", timeUsed: 0 };
      }
      const r = localRunOneTest(language, compiled.artifact!, input, timeLimit);
      return {
        status: r.status === "OK" ? "OK" : r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        timeUsed: Math.round(r.time / 1e6),
      };
    } finally {
      try { rmSync(workDir, { recursive: true, force: true }); } catch {}
    }
  }

  // go-judge mode
  const compiled = await goJudgeCompile(code, language);
  if (!compiled.ok) {
    return { status: "CE", stdout: "", stderr: compiled.error || "Compile error", timeUsed: 0 };
  }

  const r = await goJudgeRunOneTest(language, compiled.artifact, code, input, timeLimit, task.memoryLimit);
  const statusMap: Record<string, string> = {
    "Accepted": "OK",
    "Time Limit Exceeded": "TLE",
    "Memory Limit Exceeded": "MLE",
  };
  return {
    status: statusMap[r.status] || "RE",
    stdout: r.stdout,
    stderr: r.stderr,
    timeUsed: Math.round(r.time / 1e6),
  };
}
